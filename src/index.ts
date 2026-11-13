import { env } from "cloudflare:workers";

import { CALLERS, type Caller } from "./demo-data";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/api/config" && request.method === "GET") {
			return Response.json({
				mode: "direct",
				model: MODEL,
				callers: (Object.keys(CALLERS) as Caller[]).map((id) => ({
					id,
					label: CALLERS[id].label,
				})),
			});
		}

		if (url.pathname === "/api/run" && request.method === "POST") {
			return run(request);
		}

		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler;

async function run(request: Request): Promise<Response> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
	}

	if (typeof body !== "object" || body === null) {
		return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
	}
	const caller = "caller" in body ? body.caller : undefined;
	if (!isCaller(caller)) {
		return Response.json({ error: "Choose a valid caller." }, { status: 400 });
	}

	const startedAt = Date.now();
	try {
		await env.AI.run(MODEL, {
			messages: [{ role: "user", content: CALLERS[caller].prompt }],
			max_tokens: 256,
		});
		return Response.json({
			caller,
			callerLabel: CALLERS[caller].label,
			seenAs: "not routed through Gateway",
			model: MODEL,
			modelSize: "big",
			status: "ok",
			durationMs: Date.now() - startedAt,
			logId: null,
		});
	} catch (error) {
		return Response.json(
			{
				caller,
				callerLabel: CALLERS[caller].label,
				seenAs: "not routed through Gateway",
				model: MODEL,
				modelSize: "big",
				status: "error",
				error: error instanceof Error ? error.message : "The model request failed.",
				durationMs: Date.now() - startedAt,
				logId: null,
			},
			{ status: 502 },
		);
	}
}

function isCaller(value: unknown): value is Caller {
	return typeof value === "string" && Object.prototype.hasOwnProperty.call(CALLERS, value);
}
