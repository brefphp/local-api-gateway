This project lets you run HTTP Lambda applications locally.

## Why

AWS Lambda containers (like Bref containers) can run locally, but they must be invoked via the [Runtime Interface Emulator API](https://docs.aws.amazon.com/lambda/latest/dg/images-test.html)), which is not practical. Here's an example with `curl`:

```bash
# Run your Lambda function
docker run --rm -it -p 8080:8080 -v $(PWD):/var/task bref/php-80-fpm public/index.php

# Call your function
curl -XPOST "http://localhost:8080/2015-03-31/functions/function/invocations" -d '{ http event goes here }'
```

That sucks 👎

If you use Lambda + API Gateway, you probably just want **to access your app via HTTP**… like any other HTTP application. This project does that.

## Usage

This project publishes a `bref/local-api-gateway` Docker image. 

This image creates a local API Gateway (i.e. HTTP server) that forwards HTTP requests to your Lambda function running in Docker.

The only thing it needs is a `TARGET` environment variable that contains the endpoint of your Lambda function: `<host>:<port>` (the default port of Lambda [RIE](https://docs.aws.amazon.com/lambda/latest/dg/images-test.html) is `8080`).

### Example

Example of `docker-compose.yml`:

```yaml
version: "3.5"

services:
    # This container runs API Gateway locally
    web:
        image: bref/local-api-gateway
        ports: ['8000:8000']
        environment:
            # <host>:<port> -> the host here is "php" because that's the name of the second container
            TARGET: 'php:8080'
    # Example of container runs AWS Lambda locally
    php:
        image: bref/php-80-fpm
        # The command should contain the Lambda handler
        command: public/index.php
        volumes:
            - .:/var/task:ro
```

## Static assets

If you want a quick and easy way to serve static assets, mount your files in the `bref/local-api-gateway` container and set the `DOCUMENT_ROOT` env var to the root of the assets.

`DOCUMENT_ROOT` is relative to `/var/task` (the root of the app), so it can contain `.` if your assets are in the root of the app.

For example:

```yaml
services:
    web:
        image: bref/local-api-gateway
        ports: ['8000:8000']
        volumes:
            - .:/var/task:ro
        environment:
            TARGET: 'php:8080'
            DOCUMENT_ROOT: public
            
    # ...
```

## FAQ

### This vs Serverless Offline

[Serverless Offline](https://www.serverless.com/plugins/serverless-offline) doesn't work with Bref, and doesn't work great if you run your Lambda in containers.

This project will be useful to you if you are in that case, or simply if you don't use Serverless Framework.

However, if you use Serverless Framework with JS, Python or another supported language, Serverless Offline is probably a better choice.

### Does this support API Gateway routes?

No. To discover routes (and how they map to Lambda functions), we would have to parse CloudFormation templates/serverless.yml/CDK files/Terraform files/Pulumi files/etc. That's too much work for now :)

This project is mostly useful for people running web frameworks (like Laravel, Symfony, etc.) in Lambda, and don't use API Gateway's routing.

### Does this support API Gateway features?

No, this is a very simple HTTP server. It does not support API Gateway features like CORS, authorizers, etc.
