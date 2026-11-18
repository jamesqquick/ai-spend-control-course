# AI spend control course solution

The lab sends three user types through AI Gateway. The Worker attaches a single metadata property, `user_type`, reads the Gateway log for the recorded metadata and model, and shows each result in the receipt. All three user types send the same short test prompt.

## Configure the Gateway

Create an AI Gateway with ID `support-copilot`, logging enabled, and caching disabled:

```sh
cf ai-gateway gateways create --id support-copilot --authentication true \
  --collect-logs true --cache-ttl 0 --cache-invalidate-on-update true \
  --rate-limiting-interval 0 --rate-limiting-limit 0 --rate-limiting-technique sliding
```

Then create the `support` dynamic route from the included `route.json`:

```sh
cf ai-gateway dynamic-routing create support-copilot --name support --elements @route.json
```

If the Gateway already exists, reuse it. If the route already exists, create and deploy a new version instead:

```sh
cf ai-gateway dynamic-routing versions create <route-id> --gateway-id support-copilot --elements @route.json
cf ai-gateway dynamic-routing deployments create <route-id> --gateway-id support-copilot --version-id <version-id>
```

The final route uses only `metadata.user_type`:

| User type | Model selection |
| --- | --- |
| `free` | GPT-OSS 20B, `@cf/openai/gpt-oss-20b` |
| `pro` | GPT-OSS 120B, `@cf/openai/gpt-oss-120b`, with GPT-OSS 20B as backup |
| `bot` | GPT-OSS 120B for 3 requests per hour, then GPT-OSS 20B |

The `bot_budget` step counts only bot requests, keyed by `metadata.user_type`. Its allowance applies to the big model, not total requests or dollar spend. Free and Pro requests bypass that step. To change the allowance, edit its `limit` or `window` and publish another route version. To try a different small model without changing the Worker, edit the `small` step's model and publish a new version.

The browser submits `POST /api/run` with `user_type` set to `free`, `pro`, or `bot`, for example `{ "user_type": "free" }`. The Worker validates the type against `USER_TYPES` in `src/demo-data.ts` before attaching `{ user_type: userType }` as Gateway metadata. In a real application, derive the user type from trusted account or job information.

The receipt shows the metadata and model recorded in the Gateway log. Click Background bot to send 4 requests in sequence. With a fresh allowance and successful big-model calls, the first 3 use the big model, and the fourth uses the small model and shows **Downgraded**. A big-model failure can also select its smaller backup, so inspect Gateway logs to distinguish it from an exhausted allowance. A spend-limit rejection shows as **Blocked**.

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

Protect deployed labs with Cloudflare Access. The sample user-type buttons are not authentication.
