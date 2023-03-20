#!/bin/sh

set -euo pipefail

function handler() {
    EVENT_DATA=$1
#    echo "$EVENT_DATA" 1>&2;
    sleep 1
    RESPONSE='{
                "statusCode": 200,
                "body": "Hello world!"
    }'
    echo "$RESPONSE"
}

# Processing
while true
do
    HEADERS="$(mktemp)"
    # Get an event. The HTTP request will block until one is received
    EVENT_DATA=$(curl -sS -LD "$HEADERS" -X GET "http://${AWS_LAMBDA_RUNTIME_API}/2018-06-01/runtime/invocation/next")

    # Extract request ID by scraping response headers received above
    REQUEST_ID=$(grep -Fi Lambda-Runtime-Aws-Request-Id "$HEADERS" | tr -d '[:space:]' | cut -d: -f2)

    # Run the handler function from the script
    RESPONSE=$(handler "$EVENT_DATA")

    # Send the response
    curl -s -X POST "http://${AWS_LAMBDA_RUNTIME_API}/2018-06-01/runtime/invocation/$REQUEST_ID/response"  -d "$RESPONSE"
done
