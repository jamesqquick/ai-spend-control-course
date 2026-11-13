import { env } from "cloudflare:workers";

import { CALLERS, type Caller } from "./demo-data";

const MODEL = "dynamic/support";

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/api/config" && request.method === "GET") {
			return Response.json({
				mode: "gateway",
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

	let failed = false;
	let errorMessage: string | undefined;
	try {
		await env.AI.run(
			MODEL,
			{
				messages: [{ role: "user", content: CALLERS[caller].prompt }],
				max_tokens: 256,
			},
			{
				gateway: {
					id: env.GATEWAY_ID,
					collectLog: true,
					skipCache: true,
					metadata: {
						caller,
						tier: CALLERS[caller].tier,
						task: CALLERS[caller].task,
					},
				},
			},
		);
	} catch (error) {
		failed = true;
		errorMessage = error instanceof Error ? error.message : "The model request failed.";
	}

	const trace = await getGatewayTrace();
	const status = classifyStatus(trace.statusCode, failed, errorMessage, caller, trace.model);
	return Response.json(
		{
			caller,
			callerLabel: CALLERS[caller].label,
			seenAs: trace.available ? formatMetadata(trace.metadata) : "Gateway log unavailable",
			model: trace.model,
			modelSize: modelSize(trace.model),
			status,
			statusCode: trace.statusCode,
			logId: trace.logId,
			...(failed ? { error: errorMessage } : {}),
		},
		{ status: responseStatus(status, trace.statusCode) },
	);
}

async function getGatewayTrace() {
	const logId = env.AI.aiGatewayLogId ?? null;
	const trace = { model: MODEL, statusCode: null, metadata: null, logId, available: false };
	if (!logId) return trace;

	try {
		const log = await env.AI.gateway(env.GATEWAY_ID).getLog(logId);
		return {
			model: log.model || MODEL,
			statusCode: log.status_code,
			metadata: log.metadata ?? null,
			logId,
			available: true,
		};
	} catch {
		return trace;
	}
}

function isCaller(value: unknown): value is Caller {
	return typeof value === "string" && Object.prototype.hasOwnProperty.call(CALLERS, value);
}

function formatMetadata(metadata: Record<string, string | number | boolean | null | bigint> | null | undefined): string {
	if (!metadata || Object.keys(metadata).length === 0) return "anonymous";
	return Object.entries(metadata).map(([key, value]) => `${key}=${value}`).join(", ");
}

function classifyStatus(
	statusCode: number | null | undefined,
	failed: boolean,
	errorMessage: string | undefined,
	caller: Caller,
	model: string,
): "ok" | "error" | "blocked" | "downgraded" {
	if (statusCode === 429 || /spend limit/i.test(errorMessage ?? "")) return "blocked";
	if (failed || (statusCode !== null && statusCode !== undefined && statusCode >= 400)) return "error";
	if (caller === "bot" && modelSize(model) === "small") return "downgraded";
	return "ok";
}

function responseStatus(status: "ok" | "error" | "blocked" | "downgraded", statusCode: number | null | undefined): number {
	if (status === "blocked") return 429;
	if (status === "error") return statusCode && statusCode >= 400 ? statusCode : 502;
	return 200;
}

function modelSize(model: string): string {
	if (model.startsWith("dynamic/")) return "routed";
	if (/gpt-oss-20b|gemma|granite/i.test(model)) return "small";
	if (/gpt-oss-120b|llama/i.test(model)) return "big";
	return "unknown";
}
