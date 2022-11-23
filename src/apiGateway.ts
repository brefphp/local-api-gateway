import { Request } from 'express';
import * as url from 'url';
import { APIGatewayProxyEventV2 } from 'aws-lambda/trigger/api-gateway-proxy';

export function httpRequestToEvent(request: Request): APIGatewayProxyEventV2 {
    const headers = objectMap(request.headers, (value): string | undefined => {
        if (Array.isArray(value)) {
            return value.join(',');
        }
        if (typeof value === 'object' && value !== null) {
            throw new Error('Unexpected query parameter value');
        }
        return value;
    });
    const queryStringParameters = objectMap(request.query, (value): string | undefined => {
        if (Array.isArray(value)) {
            return value.join(',');
        }
        if (typeof value === 'object' && value !== null) {
            throw new Error('Unexpected query parameter value');
        }
        return value;
    });

    return {
        version: '2.0',
        routeKey: '$default',
        rawPath: request.path,
        rawQueryString: url.parse(request.originalUrl).query ?? '',
        cookies: request.cookies,
        headers,
        queryStringParameters,
        body: request.body,
        pathParameters: {},
        isBase64Encoded: false,
        stageVariables: {},
        requestContext: {
            http: {
                method: request.method,
                path: request.path,
                protocol: request.protocol,
                sourceIp: request.ip,
                userAgent: request.header('User-Agent') ?? '',
            },
            accountId: '123456789012',
            apiId: 'api-id',
            domainName: 'localhost',
            domainPrefix: '',
            requestId: 'id',
            routeKey: '$default',
            stage: '$default',
            time: new Date().toISOString(),
            timeEpoch: Date.now(),
        },
    };
}

function objectMap<In, Out>(object: Record<string, In>, mapFn: (value: In) => Out): Record<string, Out> {
    return Object.keys(object).reduce((result: Record<string, Out>, key) => {
        result[key] = mapFn(object[key]);
        return result;
    }, {});
}
