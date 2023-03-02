import { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { httpRequestToEvent } from '../src/apiGateway';

describe('httpRequestToEvent', () => {
    it('converts simple GET requests', () => {
        const event = httpRequestToEvent(fakeRequest({}));
        cleanEvent(event);

        expect(event).toStrictEqual({
            version: '2.0',
            body: '',
            cookies: [],
            headers: {},
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
                    protocol: undefined,
                    sourceIp: undefined,
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

    it('forwards the HTTP method', () => {
        const event = httpRequestToEvent(
            fakeRequest({
                method: 'POST',
            })
        );
        cleanEvent(event);

        expect(event.requestContext.http.method).toBe('POST');
    });

    it('forwards the body', () => {
        const event = httpRequestToEvent(
            fakeRequest({
                method: 'POST',
                body: 'Hello world',
            })
        );
        cleanEvent(event);

        expect(event.body).toBe('Hello world');
    });
});

function fakeRequest({ method, body }: { method?: string; body?: string }): Request {
    return {
        originalUrl: 'http://localhost:8000',
        headers: {},
        header() {
            return undefined;
        },
        query: {},
        body: body ?? '',
        method: method ?? 'GET',
        path: '/',
        cookies: [],
    } as any as Request;
}

function cleanEvent(event: Record<string, any>) {
    delete event.requestContext.time;
    delete event.requestContext.timeEpoch;
}
