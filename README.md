# AI spend control course

A three-caller lab for seeing what AI Gateway can record, route, and control.

- The `starter` branch sends the free user, pro user, and background bot straight to Workers AI. AI Gateway has no logs for those requests.
- The `solution` branch sends the same callers through the `support` Dynamic Route and shows Gateway-recorded metadata, model, and outcome in the receipt.

## Run the starter

Requires Node.js 22.23+ and the Cloudflare `cf` CLI.

```sh
npm install
cf auth login
export CLOUDFLARE_ACCOUNT_ID=your-account-id
npm run dev
```

Open the local URL printed by `cf dev`. Local development uses the remote Workers AI binding, so the selected Cloudflare account must have Workers AI enabled. The app discards model-generated answers so the lab can focus on the request receipt and Gateway logs. Direct Workers AI requests do not create AI Gateway logs.

The bot button sends 4 requests in sequence. The buttons use fixed synthetic prompts. If you deploy the lab, put it behind Cloudflare Access; the caller selector is a teaching fixture, not authentication.

## Course path

1. Run all 3 callers on `starter`. The receipt says they are not routed through Gateway, and the Gateway logs stay empty.
2. Add AI Gateway to the Worker. Requests appear in Gateway logs, and the receipt reads the logged model and status. Before caller metadata is added, the receipt shows `anonymous`.
3. Add `caller`, `tier`, and `task` metadata from the Worker's caller table. The receipt then shows the metadata recorded by Gateway. Route the quick summary to a smaller model, keep the pro analysis on a larger model, and leave the bot on the larger model.
4. Give the bot its own hard cap or route limit. The receipt shows when Gateway blocks it or answers it with the smaller model.

## Compare with the solution

```sh
git diff starter..solution
```

Gateway IDs, Dynamic Route steps, and spend limits live in AI Gateway configuration. The starter already reads each Gateway log, so no separate receipt-code change is needed while following the course.
