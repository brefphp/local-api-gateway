#!/bin/sh

set -e

# Run the fake API Gateway
# (forces fake AWS credentials so that the Lambda client works)
AWS_ACCESS_KEY_ID='fake' AWS_SECRET_ACCESS_KEY='fake' \
    TARGET=localhost:8080 \
    node /local-api-gateway/dist/index.js &

# Run the original AWS Lambda entrypoint (RIE) with the handler argument
/lambda-entrypoint.sh "handler"
