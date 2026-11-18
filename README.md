# AI spend control course

A lab with three user types for seeing what AI Gateway can record, route, and control.

- The `main` branch contains the course starter. It sends the free user, pro user, and background bot straight to Workers AI. AI Gateway has no logs for those requests.
- The `solution` branch sends the same user types through the `support` dynamic route and shows Gateway-recorded metadata, model, and outcome in the receipt.

## Run the starter

Requires Node.js 22.23+ and the Cloudflare `cf` CLI.

```sh
npm install
cf auth login
export CLOUDFLARE_ACCOUNT_ID=your-account-id
npm run dev
```

Open the local URL printed by `cf dev`. Local development uses the remote Workers AI binding, so the selected Cloudflare account must have Workers AI enabled. The app discards model-generated answers so the lab can focus on the request receipt and Gateway logs. Direct Workers AI requests do not create AI Gateway logs.

The bot button sends 4 requests in sequence. All three user types use the same short test prompt defined in `src/demo-data.ts`. The lab compares routing policies, not answer quality. If you deploy the lab, put it behind Cloudflare Access; the user-type selector is a teaching fixture, not authentication.

## Course path

1. Run all 3 user types on `main`. The receipt says they are not routed through Gateway, and the Gateway logs stay empty.
2. Add AI Gateway to the Worker. Requests appear in Gateway logs, and the receipt reads the logged model and status. Before user-type metadata is added, the receipt shows `anonymous`.
3. Add one metadata property, `user_type`, with a value of `free`, `pro`, or `bot`. The Worker validates the selected type against `USER_TYPES` before attaching metadata. The receipt then shows the value recorded by Gateway.
4. Create a dynamic route that sends Free users to a small model and Pro users and the bot to a big model, with a backup if the big model fails. Swap the Free-user model by publishing a route version without changing the Worker.
5. Add a bot-only allowance of 3 big-model requests per hour. Later bot requests go to the small model while Free and Pro users keep their existing routing. This limits big-model usage, not total requests or dollar spend.

The browser submits `POST /api/run` with `user_type` set to `free`, `pro`, or `bot`, for example `{ "user_type": "free" }`. In a real application, derive the user type from trusted account or job information rather than a browser selection.

## Compare with the solution

```sh
git diff main..solution
```

Gateway IDs and dynamic route steps live in AI Gateway configuration. The solution includes a complete `route.json`. The starter already reads each Gateway log, so no separate receipt-code change is needed while following the course.
