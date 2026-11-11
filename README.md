# AI Spend Control Course

A small support-copilot app for learning how Cloudflare AI Gateway makes AI usage visible and controllable. The app keeps the same chat interface throughout the course; the request path changes in the Worker.

- `main` is the working starter: requests go directly to Workers AI.
- `solution` is the completed course implementation: requests pass through AI Gateway, carry server-generated team metadata, and use a Dynamic Route.

## Run the starter

Requirements: Node.js 22.23+ and the Cloudflare `cf` CLI.

```sh
npm install
cf login
export CLOUDFLARE_ACCOUNT_ID=your-account-id
npm run dev
```

Open the local URL printed by `cf dev`. Local development uses the remote Workers AI binding, so the Cloudflare account must have Workers AI enabled. No model API key is needed.

Set `CLOUDFLARE_ACCOUNT_ID` when your Cloudflare login has more than one account. Find the ID in the account details in the Cloudflare dashboard.

The starter calls `@cf/meta/llama-3.3-70b-instruct-fp8-fast` directly. The browser sends a persona ID, not trusted team metadata; the Worker maps that identity to server-side attributes in the solution.

## Course path

1. Send a prompt and inspect the direct Workers AI request.
2. Add AI Gateway between the Worker and the model.
3. Attach trusted `team`, `user_id`, and `session_id` metadata on the server.
4. Route intern and escalation requests with a Dynamic Route.
5. Add a spend limit for the `interns` team, then compare both personas.

Use synthetic support questions only. If you deploy the app while learning, put it behind Cloudflare Access; the starter endpoint is intentionally a simple teaching fixture.

## Compare with the solution

```sh
git switch solution
git diff main..solution
```

The solution README has the Gateway setup steps and local configuration. Gateway policies and spend limits are configured in the Cloudflare dashboard; this repository contains the app-side request changes.
