This directory let us run the local API Gateway with a fake Lambda handler (written in bash for simplicity).

## How to run

First, compile the project at the project root.

Then move to the test folder:

```bash
docker compose up
```

Then either hit http://localhost:8000/ or open [index.html](./index.html) in your browser.
