import { USER_TYPES, type UserType } from "./demo-data";
import { getGatewayMode, getGatewayTrace } from "./gateway-trace";

type ReceiptInput = {
	model: string;
	userType: UserType;
	startedAt: number;
	errorMessage?: string;
};

export async function createReceiptResponse({ model, userType, startedAt, errorMessage }: ReceiptInput): Promise<Response> {
	const failed = errorMessage !== undefined;
	const trace = await getGatewayTrace(model);
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
