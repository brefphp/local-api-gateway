import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { InvocationResponse, LambdaClient, ServiceInputTypes, ServiceOutputTypes } from '@aws-sdk/client-lambda';

process.env.TARGET = 'localhost:9000';

import { server as app } from '../src/index';

describe('server', () => {
    let lambda: AwsStub<ServiceInputTypes, ServiceOutputTypes>;

    beforeEach(() => {
        lambda = mockClient(LambdaClient);
        lambda.resolves({
            Payload: Buffer.from(
                JSON.stringify({
                    statusCode: 200,
                    cookies: ['cookie1=a', 'cookie2=b'],
                })
            ),
        });
    });

    it('handles simple GET requests', async () => {
        const response = await request(app).get('/');
        expect(response.status).toEqual(200);
        expect(response.body).toStrictEqual({});

        expect(getEventFromLambdaApiCall(lambda, 0)).toStrictEqual({
            version: '2.0',
            body: '',
            headers: {
                'accept-encoding': 'gzip, deflate',
                connection: 'close',
                'x-forwarded-for': '127.0.0.1',
                'x-forwarded-port': '8000',
                'x-forwarded-proto': 'http',
            },
            isBase64Encoded: false,
            pathParameters: {},
            queryStringParameters: {},
            rawPath: '/',
            rawQueryString: '',
            requestContext: {
                accountId: '123456789012',
                apiId: 'api-id',
                domainName: 'localhost',
                domainPrefix: '',
                http: {
                    method: 'GET',
                    path: '/',
                    protocol: 'http',
                    sourceIp: '127.0.0.1',
                    userAgent: '',
                },
                requestId: 'id',
                routeKey: '$default',
                stage: '$default',
            },
            routeKey: '$default',
            stageVariables: {},
        });
    });

    it('sets cookies', async () => {
        const response = await request(app).post('/');
        expect(response.header['set-cookie']).toEqual(['cookie1=a', 'cookie2=b']);
    });

    it('forwards the HTTP method', async () => {
        const response = await request(app).post('/');
        expect(response.status).toEqual(200);

        expect(getEventFromLambdaApiCall(lambda, 0).requestContext.http.method).toBe('POST');
    });

    it('forwards the body', async () => {
        const response = await request(app).post('/').send('Hello world');
        expect(response.status).toEqual(200);

        expect(getEventFromLambdaApiCall(lambda, 0).body).toBe('Hello world');
    });

    it('forwards headers', async () => {
        const response = await request(app).get('/').set('X-My-Header', 'foo');
        expect(response.status).toEqual(200);

        expect(getEventFromLambdaApiCall(lambda, 0).headers).toStrictEqual({
            'accept-encoding': 'gzip, deflate',
            connection: 'close',
            'x-forwarded-for': '127.0.0.1',
            'x-forwarded-port': '8000',
            'x-forwarded-proto': 'http',
            'x-my-header': 'foo',
        });
    });

    it('forwards query parameters', async () => {
        const queryString =
            'foo=bar' + // simple
            '&' +
            'array[]=value1&array[]=value2' + // array
            '&' +
            'shapes[a]=foo&shapes[b][]=square&shapes[b][]=triangle'; // indexed array
        const response = await request(app).get(`/${queryString}`).query(queryString);
        expect(response.status).toEqual(200);

        const event = getEventFromLambdaApiCall(lambda, 0);
        expect(event.queryStringParameters).toStrictEqual({
            foo: 'bar',
            'array[]': 'value1,value2',
            'shapes[a]': 'foo',
            'shapes[b][]': 'square,triangle',
        });
        expect(event.rawQueryString).toStrictEqual(queryString);
    });
});

function getEventFromLambdaApiCall(lambda: AwsStub<ServiceInputTypes, ServiceOutputTypes>, call: number) {
    const callParam = lambda.call(call).args[0].input as InvocationResponse;
    const event = JSON.parse(Buffer.from(callParam.Payload ?? '').toString());
    cleanEvent(event);
    return event;
}

function cleanEvent(event: Record<string, any>) {
    delete event.headers.host;
    delete event.requestContext.time;
    delete event.requestContext.timeEpoch;
}
