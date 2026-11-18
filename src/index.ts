import { env } from "cloudflare:workers";

import { USER_TYPES, type UserType } from "./demo-data";
import { getGatewayMode, getGatewayTrace } from "./gateway-trace";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/api/config" && request.method === "GET") {
			return Response.json({
				mode: getGatewayMode(),
				model: MODEL,
				userTypes: (Object.keys(USER_TYPES) as UserType[]).map((id) => ({
					id,
					label: USER_TYPES[id].label,
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
	const userType = "user_type" in body ? body.user_type : undefined;
	if (!isUserType(userType)) {
		return Response.json({ error: "Choose a valid user type." }, { status: 400 });
	}

	const startedAt = Date.now();
	let failed = false;
	let errorMessage: string | undefined;
	try {
		await env.AI.run(MODEL, {
			messages: [{ role: "user", content: USER_TYPES[userType].prompt }],
			max_tokens: 8,
		});
	} catch (error) {
		failed = true;
		errorMessage = error instanceof Error ? error.message : "The model request failed.";
	}

	const trace = await getGatewayTrace(MODEL);
	const status = classifyStatus(trace.statusCode, failed, errorMessage, userType, trace.model);
	return Response.json(
		{
			user_type: userType,
			userTypeLabel: USER_TYPES[userType].label,
			seenAs: trace.available
				? formatMetadata(trace.metadata)
				: getGatewayMode() === "gateway"
					? "Gateway log unavailable"
					: "not routed through Gateway",
			model: trace.model,
			modelSize: modelSize(trace.model),
			status,
			statusCode: trace.statusCode,
			durationMs: Date.now() - startedAt,
			logId: trace.logId,
			...(failed ? { error: errorMessage } : {}),
		},
		{ status: responseStatus(status, trace.statusCode) },
	);
}

function isUserType(value: unknown): value is UserType {
	return typeof value === "string" && Object.prototype.hasOwnProperty.call(USER_TYPES, value);
}

function formatMetadata(metadata: Record<string, string | number | boolean | null | bigint> | null | undefined): string {
	if (!metadata || Object.keys(metadata).length === 0) return "anonymous";
	return Object.entries(metadata).map(([key, value]) => `${key}=${value}`).join(", ");
}

function classifyStatus(
	statusCode: number | null | undefined,
	failed: boolean,
	errorMessage: string | undefined,
	userType: UserType,
	model: string,
): "ok" | "error" | "blocked" | "downgraded" {
	if (statusCode === 429 || /spend limit/i.test(errorMessage ?? "")) return "blocked";
	if (failed || (statusCode !== null && statusCode !== undefined && statusCode >= 400)) return "error";
	if (userType === "bot" && modelSize(model) === "small") return "downgraded";
	return "ok";
}

function responseStatus(
	status: "ok" | "error" | "blocked" | "downgraded",
	statusCode: number | null | undefined,
): number {
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
