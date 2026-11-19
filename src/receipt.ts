import { USER_TYPES, type UserType } from "./demo-data";
import { getGatewayMode } from "./gateway-trace";

type ReceiptInput = {
	model: string;
	userType: UserType;
	metadata?: Record<string, string>;
	response?: Response;
	errorMessage?: string;
};

export async function createReceiptResponse({ model, userType, metadata, response, errorMessage }: ReceiptInput): Promise<Response> {
	let payload: unknown;
	try {
		payload = await response?.json();
	} catch {
		errorMessage ??= "The model returned an invalid JSON response.";
	}
	const responseModel = getResponseModel(payload) ?? model;
	const statusCode = response?.status ?? null;
	const failed = !response?.ok || errorMessage !== undefined;
	const status = classifyStatus(statusCode, failed, errorMessage, userType, responseModel);
	if (failed) errorMessage ??= statusCode ? `The model request failed with HTTP ${statusCode}.` : "The model request failed.";
	return Response.json(
		{
			user_type: userType,
			userTypeLabel: USER_TYPES[userType].label,
			seenAs: getGatewayMode() === "gateway" ? formatMetadata(metadata) : "not routed through Gateway",
			model: responseModel,
			modelSize: modelSize(responseModel),
			status,
			statusCode,
			logId: response?.headers.get("cf-aig-log-id") ?? null,
			...(failed ? { error: errorMessage } : {}),
		},
		{ status: responseStatus(status, statusCode) },
	);
}

function getResponseModel(payload: unknown): string | undefined {
	if (typeof payload !== "object" || payload === null) return;
	if ("model" in payload && typeof payload.model === "string") return payload.model;
	const result = "result" in payload ? payload.result : undefined;
	if (typeof result === "object" && result !== null && "model" in result && typeof result.model === "string") return result.model;
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
