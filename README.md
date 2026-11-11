# AI Spend Control Course — Solution

This branch routes the Fieldstone support copilot through Cloudflare AI Gateway. The Worker attaches trusted team metadata and calls the `dynamic/support` route; the browser never receives the Gateway token or chooses a model.

## Configure AI Gateway

In the Cloudflare dashboard, in the account you will use for development:

1. Create an AI Gateway with ID `support-copilot` and create an AI Gateway token for authenticated requests.
2. Create a Dynamic Route named `support`.
3. Add a route condition for `metadata.team` equal to `interns`, using `@cf/meta/llama-3.1-8b-instruct-fp8`.
4. Route `metadata.team` equal to `escalations` to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
5. Save and deploy the route. Leave caching off while testing the team spend limit.

The Worker sends five flat metadata values: `user_id`, `session_id`, `team`, `application`, and `case_id`. The persona is selected in the UI, but the Worker maps it to the team and user ID.

## Run locally

Requirements: Node.js 22.23+ and the Cloudflare `cf` CLI.

```sh
npm install
cf login
```

In `cloudflare.config.ts`, replace `your-account-id` with the Cloudflare account ID that owns the Gateway. Keep `GATEWAY_ID` as `support-copilot`, or change it to match your Gateway.

```sh
cp .dev.vars.example .dev.vars
```

Put the Gateway token value in `.dev.vars` as `CF_AIG_TOKEN`, then start the app:

```sh
export CLOUDFLARE_ACCOUNT_ID=your-account-id
npm run dev
```

Open the local URL printed by `cf dev`. Set `CLOUDFLARE_ACCOUNT_ID` when your login has more than one account. The Gateway account must have Workers AI enabled.

Choose Riley to send `team: interns`; choose Sam to send `team: escalations`. The Request Path panel shows the model, provider, cache status, response status, and Gateway log ID returned for each request. A spend-limit response is shown in the chat and remains visible in the request trace.

## Observe the spend limit

Create a Spend Limit rule in AI Gateway scoped to `team = interns`, then send a prompt as Riley and as Sam. The interns rule should affect Riley's requests while Sam's requests continue through the escalation route. Spend estimates can be delayed and may overshoot the configured limit.

## Deploy

Deploy with the local secrets file. `.dev.vars` is gitignored:

```sh
cf deploy --secrets-file .dev.vars
```

If you deploy this teaching app, protect it with Cloudflare Access. Its demo persona selector is not user authentication.
