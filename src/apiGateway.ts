import { Request } from 'express';
import * as url from 'url';
import { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda/trigger/api-gateway-proxy';
import QueryString from 'qs';


export function httpRequestToEvent(request: Request, version?: string): APIGatewayProxyEvent | APIGatewayProxyEventV2 {
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

    const bodyString = request.method === 'GET' ? '' : request.body.toString('utf8');
    const shouldSendBase64 = request.method === 'GET' ? false : bodyString.includes('Content-Disposition: form-data');

    const cookies = request.headers.cookie ? request.headers.cookie.split('; ') : [];
        if (version === "1") {
            return {
                version: '1.0',
                resource: request.path,
                path: request.path,
                httpMethod: request.method,
                headers: {
                    'x-forwarded-proto': request.protocol,
                    'x-forwarded-port': `${request.socket.localPort}`,
                    'x-forwarded-for': request.ip,
                    ...headers,
                },
                queryStringParameters,
                requestContext: {
                    path: request.path,
                    requestTimeEpoch: Date.now(),
                    resourceId: 'resource-id',
                    resourcePath: request.path,
                    http: {
                        method: request.method,
                        path: request.path,
                        protocol: request.protocol,
                        sourceIp: request.ip || '',
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
                    authorizer: null,
                    protocol: '',
                    httpMethod: '',
                    identity: {
                        accessKey: null,
                        accountId: null,
                        caller: null,
                        cognitoAuthenticationProvider: null,
                        cognitoAuthenticationType: null,
                        cognitoIdentityId: null,
                        cognitoIdentityPoolId: null,
                        principalOrgId: null,
                        sourceIp: "192.0.2.1",
                        user: null,
                        userAgent: "user-agent",
                        userArn: null,
                        clientCert: {
                          clientCertPem: "CERT_CONTENT",
                          subjectDN: "www.example.com",
                          issuerDN: "Example issuer",
                          serialNumber: "a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1:a1",
                          validity: {
                            notBefore: "May 28 12:30:02 2019 GMT",
                            notAfter: "Aug  5 09:36:04 2021 GMT"
                          },
                        },
                        apiKey: null,
                        apiKeyId: null,
                    },
                },
                pathParameters: {},
                stageVariables: {},
                body: shouldSendBase64 ? request.body.toString('base64') : bodyString,
                isBase64Encoded: shouldSendBase64,
                cookies: cookies,
                multiValueHeaders: {},
                multiValueQueryStringParameters: {},
            };
        }

    return {
        version: '2.0',
        routeKey: '$default',
        rawPath: request.path,
        rawQueryString: url.parse(request.originalUrl).query ?? '',
        cookies: cookies,
        headers: {
            'x-forwarded-proto': request.protocol,
            'x-forwarded-port': `${request.socket.localPort}`,
            'x-forwarded-for': request.ip,
            ...headers,
        },
        queryStringParameters,
        body: shouldSendBase64 ? request.body.toString('base64') : bodyString,
        pathParameters: {},
        isBase64Encoded: shouldSendBase64,
        stageVariables: {},
        requestContext: {
            http: {
                method: request.method,
                path: request.path,
                protocol: request.protocol,
                sourceIp: request.ip || '',
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
