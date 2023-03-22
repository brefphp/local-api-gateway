import { Request } from 'express';
import * as url from 'url';
import { APIGatewayProxyEventV2 } from 'aws-lambda/trigger/api-gateway-proxy';
import QueryString from 'qs';

export function httpRequestToEvent(request: Request): APIGatewayProxyEventV2 {
    const headers = objectMap(request.headers, (value): string | undefined => {
        if (Array.isArray(value)) {
            return value.join(',');
        }
        if (typeof value === 'object' && value !== null) {
            throw new Error('Unexpected header value');
        }
        return value;
    });

    const queryStringParameters: Record<string, string> = {};
    objectMap(
        request.query,
        (value: string | QueryString.ParsedQs | string[] | QueryString.ParsedQs[] | undefined, key: string) => {
            if (Array.isArray(value)) {
                queryStringParameters[`${key}[]`] = value.join(',');
            } else if (typeof value === 'object' && value !== null) {
                Object.entries(value).forEach(([k, v]) => {
                    if (Array.isArray(v)) {
                        queryStringParameters[`${key}[${k}][]`] = v.join(',');
                    } else {
                        queryStringParameters[`${key}[${k}]`] = (v ?? '').toString();
                    }
                });
            } else {
                queryStringParameters[key] = value ?? '';
            }
        }
    );

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

function objectMap<In, Out>(object: Record<string, In>, mapFn: (value: In, key: string) => Out): Record<string, Out> {
    return Object.keys(object).reduce((result: Record<string, Out>, key) => {
        result[key] = mapFn(object[key], key);
        return result;
    }, {});
}
