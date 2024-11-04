import { Request } from 'express';
import * as url from 'url';
import { APIGatewayProxyEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import QueryString from 'qs';

export function httpRequestToEvent(request: Request): APIGatewayProxyEvent {
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

    const bodyString = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : '';
    const shouldSendBase64 = request.method === 'GET' ? false : bodyString.includes('Content-Disposition: form-data');

    const cookies = request.headers.cookie ? request.headers.cookie.split('; ') : [];

    return {
        resource: "/{proxy+}",
        path: request.path,
        httpMethod: request.method,
        multiValueHeaders: {"fake": []},
        headers: {
            'x-forwarded-proto': request.protocol,
            'x-forwarded-port': `${request.socket.localPort}`,
            'x-forwarded-for': request.ip,
            ...headers,
        },
        queryStringParameters,
        multiValueQueryStringParameters: {},
        body: shouldSendBase64 ? request.body.toString('base64') : bodyString,
        pathParameters: {},
        isBase64Encoded: shouldSendBase64,
        stageVariables: {},
        requestContext: {
            httpMethod: request.method,
            path: request.path,
            protocol: request.protocol,
            identity: {
                sourceIp: String(request.ip),
                user: null,
                accessKey: null,
                accountId: null,
                apiKey: null,
                apiKeyId: null,
                caller: null,
                clientCert: null,
                cognitoAuthenticationProvider: null,
                cognitoAuthenticationType: null,
                cognitoIdentityId: null,
                cognitoIdentityPoolId: null,
                principalOrgId: null,
                userArn: null,
                userAgent: request.header('User-Agent') ?? '',
            },
            authorizer: null,
            accountId: '123456789012',
            apiId: 'api-id',
            domainName: 'localhost',
            domainPrefix: '',
            requestId: 'id',
            routeKey: '$default',
            stage: '$default',
            requestTime: new Date().toISOString(),
            requestTimeEpoch: Date.now(),
            resourceId: '',
            resourcePath: ''
        },
    };
}

function objectMap<In, Out>(object: Record<string, In>, mapFn: (value: In, key: string) => Out): Record<string, Out> {
    return Object.keys(object).reduce((result: Record<string, Out>, key) => {
        result[key] = mapFn(object[key], key);
        return result;
    }, {});
}
