import express, { NextFunction, Request, Response } from 'express';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import queue from 'express-queue';
import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { InvocationType, InvokeCommand, InvokeCommandOutput, LambdaClient } from '@aws-sdk/client-lambda';
import { httpRequestToEvent } from './apiGateway.js';
import { runDockerCommand } from "./docker";
import bodyParser from 'body-parser';

const app = express();
const address = process.env.LISTEN_ADDRESS || '0.0.0.0';
const port = Number(process.env.LISTEN_PORT) || 8000;

if (process.env.DOCUMENT_ROOT) {
    app.use(express.static(process.env.DOCUMENT_ROOT));
}

const target = process.env.TARGET;
if (!target || !target.includes(":")) {
    throw new Error(
        'The TARGET environment variable must be set and contain the domain + port of the target lambda container (for example, "localhost:9000")'
    );
}

// Logging levels: 'none', 'info', 'debug'
const doInfoLogging = ['info', 'debug'].includes(process.env.LOG_LEVEL ?? 'none');
const doDebugLogging = process.env.LOG_LEVEL === 'debug';

// Determine whether to use Docker CLI or AWS Lambda RIE for execution
const dockerHost = process.env.TARGET_CONTAINER ?? target.split(":")[0];
const dockerHandler = process.env.TARGET_HANDLER ?? '';
const mode = (dockerHost && dockerHandler) ? "docker": "rie";
if (doInfoLogging) {
    if (mode === "docker") {
        console.log(`Using docker CLI on '${dockerHost}' via '${dockerHandler}'`);
    } else {
        console.log("Using AWS Lambda RIE environment - set TARGET_CONTAINER and TARGET_HANDLER environment variables to enable docker CLI mode");
    }
}
const maxParallelRequests = process.env.DEV_MAX_REQUESTS_IN_PARALLEL ?? 10;
const maxQueuedRequests = process.env.DEV_MAX_REQUESTS_IN_QUEUE ?? -1;

// Prevent parallel requests as Lambda RIE can only handle one request at a time
// The solution here is to use a request "queue":
// incoming requests are queued until the previous request is finished.
// See https://github.com/brefphp/bref/issues/1471
const requestQueue = queue({
    // max requests to process simultaneously (set to 1 for RIE mode)
    activeLimit: (mode === "docker") ? maxParallelRequests : 1,
    // max requests in queue until reject (-1 means do not reject)
    queuedLimit: maxQueuedRequests,
    // handler to call when queuedLimit is reached (see below)
    rejectHandler: (req: Request, res: Response) => {
        res.status(503);
        res.send(
            'Too many requests in parallel, set the `DEV_MAX_REQUESTS_IN_PARALLEL` and `DEV_MAX_REQUESTS_IN_QUEUE` environment variables to control the limit'
        );
    },
});
app.use(requestQueue);

const client = new LambdaClient({
    region: 'us-east-1',
    endpoint: `http://${target}`,
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Populate `req.body` with the raw body content (buffer).
// We use a Buffer to avoid issues with binary data during file upload.
// See https://stackoverflow.com/a/18710277/245552
app.use(bodyParser.raw({
    inflate: true,
    limit: '10mb',
    type: '*/*'
}));

app.all('*', async (req: Request, res: Response, next) => {
    const event = httpRequestToEvent(req);

    let result: string;
    const requestContext = event?.requestContext?.http ?? {};
    try {
        const payload = Buffer.from(JSON.stringify(event)).toString();
        if (doInfoLogging) {
            console.log(`START [${mode.toUpperCase()}] ${requestContext?.method} ${requestContext?.path}`, doDebugLogging ? payload : '');
        }
        if (mode === "docker") {
            // Run via Docker
            result = await runDockerCommand(dockerHost, dockerHandler, payload);
        } else {
            // Run via Lambda RIE SDK
            const invokeCommand = new InvokeCommand({
                FunctionName: 'function',
                Payload: payload,
                InvocationType: InvocationType.RequestResponse,
            });
            const invokeResponse: InvokeCommandOutput = await client.send(invokeCommand);
            result = String(invokeResponse.Payload);
        }
        if (doInfoLogging) {
            console.log(`END [${mode.toUpperCase()}] ${requestContext?.method} ${requestContext?.path}`, doDebugLogging ? result : `${result.length} bytes`);
        }

    } catch (e) {
        console.error(`END [ERROR] ${requestContext?.method} ${requestContext?.path}`, e);
        res.send(JSON.stringify(e));

        return next(e);
    }

    if (!result) {
        return res.status(500).send('No payload in Lambda response');
    }
    const payload = Buffer.from(result).toString();
    let lambdaResponse: APIGatewayProxyStructuredResultV2;
    try {
        lambdaResponse = JSON.parse(payload) as APIGatewayProxyStructuredResultV2;
    } catch (e) {
        return res.status(500).send('Invalid Lambda response: ' + payload);
    }

    if ((lambdaResponse as LambdaInvokeError).errorType) {
        return res.status(500).send('Lambda error: ' + (lambdaResponse as LambdaInvokeError).errorMessage);
    }

    res.status(lambdaResponse.statusCode ?? 200);
    for (const [key, value] of Object.entries(lambdaResponse.headers ?? {})) {
        res.setHeader(key, value.toString());
    }
    // Set cookies in header
    if (lambdaResponse.cookies) {
        res.setHeader('Set-Cookie', lambdaResponse.cookies);
    }

    const body = lambdaResponse.body;
    if (body && lambdaResponse.isBase64Encoded) {
        res.end(Buffer.from(body, 'base64'));
    } else {
        res.end(body);
    }
});

export const server = app.listen(port, address, () => {
    const userFriendlyAddress = address === '0.0.0.0' && !process.env.LISTEN_ADDRESS ? 'localhost' : address;
    console.log(`⚡️ Server is running at http://${userFriendlyAddress}:${port}`);
});

const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
        console.log('Server shutdown.');
    });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

type LambdaInvokeError = {
    errorType: string;
    errorMessage: string;
};

export default app;
