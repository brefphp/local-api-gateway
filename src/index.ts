import express, { NextFunction, Request, Response } from 'express';
import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { InvocationType, InvokeCommand, InvokeCommandOutput, LambdaClient } from '@aws-sdk/client-lambda';
import { httpRequestToEvent } from './apiGateway';

const app = express();
const port = 8000;

if (process.env.DOCUMENT_ROOT) {
    app.use(express.static(process.env.DOCUMENT_ROOT));
}

const target = process.env.TARGET;
if (!target) {
    throw new Error(
        'The TARGET environment variable must be set and contain the domain + port of the target lambda container (for example, "localhost:9000")'
    );
}
const client = new LambdaClient({
    region: 'us-east-1',
    endpoint: `http://${target}`,
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.all('*', async (req: Request, res: Response, next) => {
    const event = httpRequestToEvent(req);

    let result: InvokeCommandOutput;
    try {
        result = await client.send(
            new InvokeCommand({
                FunctionName: 'function',
                Payload: Buffer.from(JSON.stringify(event)),
                InvocationType: InvocationType.RequestResponse,
            })
        );
    } catch (e) {
        return next(e);
    }

    if (!result.Payload) {
        return res.status(500).send('No payload in Lambda response');
    }
    const payload = Buffer.from(result.Payload).toString();
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
        for (const cookie of lambdaResponse.cookies) {
            res.setHeader('Set-Cookie', cookie);
        }
    }

    let body = lambdaResponse.body;
    if (body && lambdaResponse.isBase64Encoded) {
        body = Buffer.from(body, 'base64').toString('utf-8');
    }
    res.send(body);
});

app.listen(port, () => {
    console.log(`⚡️ Server is running at http://localhost:${port}`);
});

type LambdaInvokeError = {
    errorType: string;
    errorMessage: string;
};
