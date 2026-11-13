# AI spend control course solution

The lab sends the same three callers through AI Gateway. The Worker adds caller metadata, reads the Gateway log for the recorded metadata and model, and shows each result in the existing receipt.

## Configure the Gateway

Create a Gateway with ID `support-copilot` and a Dynamic Route named `support`. The final route should:

- Send `metadata.task == "quick-summary"` to `@cf/openai/gpt-oss-20b`.
- Send other tasks to `@cf/openai/gpt-oss-120b`.
- Fall back from the 120B model to the 20B model.
- For `metadata.caller == "bot"`, allow 3 requests per hour to use the 120B model, then send later requests to the 20B model.

The Worker sends `caller`, `tier`, and `task` metadata from `src/demo-data.ts`. The receipt shows the metadata and model recorded in the Gateway log. Bot requests answered by the smaller model show as **Downgraded**. A spend-limit rejection shows as **Blocked**.

## Run locally

Requires Node.js 22.23+ and the Cloudflare `cf` CLI. The selected account must own the Gateway and have Workers AI enabled.

```sh
npm install
cf auth login
export CLOUDFLARE_ACCOUNT_ID=your-account-id
npm run dev
```

## Deploy

```sh
npm run deploy
```

Protect deployed labs with Cloudflare Access. The sample caller buttons are not authentication.
