import { env } from "cloudflare:workers";

import { PERSONAS, PROMPTS, SYSTEM_PROMPT } from "./demo-data";

const MODEL = "dynamic/support";
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2_000;

type ChatMessage = {
	role: "user" | "assistant";
	content: string;
};

type ChatRequest = {
	personaId?: string;
	sessionId?: string;
	messages?: ChatMessage[];
};

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/api/config" && request.method === "GET") {
			return Response.json({
				mode: "gateway",
				model: MODEL,
				gatewayId: env.GATEWAY_ID,
				personas: Object.entries(PERSONAS).map(([id, persona]) => ({
					id,
					label: persona.label,
					team: persona.team,
					role: persona.role,
				})),
				prompts: PROMPTS,
			});
		}

		if (url.pathname === "/api/chat" && request.method === "POST") {
			return chat(request);
		}

		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler;

async function chat(request: Request): Promise<Response> {
	let body: ChatRequest;
	try {
		body = await request.json<ChatRequest>();
	} catch {
		return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
	}

	const persona = PERSONAS[body.personaId as keyof typeof PERSONAS];
	if (!persona) {
		return Response.json({ error: "Choose a valid support persona." }, { status: 400 });
	}
	if (!/^[a-z0-9-]{8,64}$/.test(body.sessionId ?? "")) {
		return Response.json({ error: "Start a new conversation and try again." }, { status: 400 });
	}
	if (!/^[a-f\d]{32}$/i.test(env.ACCOUNT_ID) || !env.CF_AIG_TOKEN) {
		return Response.json(
			{ error: "Configure a valid ACCOUNT_ID in cloudflare.config.ts and CF_AIG_TOKEN in .dev.vars." },
			{ status: 503 },
		);
	}

	const messages = normalizeMessages(body.messages);
	if (!messages.length || messages.at(-1)?.role !== "user") {
		return Response.json({ error: "The conversation must end with a user message." }, { status: 400 });
	}

	const startedAt = Date.now();
	try {
		const metadata = {
			user_id: persona.user_id,
			session_id: body.sessionId,
			team: persona.team,
			application: "support-copilot",
			case_id: "general-support",
		};
		const response = await fetch(`https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${env.GATEWAY_ID}/compat/chat/completions`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"cf-aig-authorization": `Bearer ${env.CF_AIG_TOKEN}`,
				"cf-aig-metadata": JSON.stringify(metadata),
			},
			body: JSON.stringify({
				model: MODEL,
				messages: [
					{ role: "system", content: `${SYSTEM_PROMPT} ${persona.instructions}` },
					...messages,
				],
				max_tokens: 512,
				stream: false,
			}),
		});
		const result: unknown = await response.json().catch(() => null);
		const trace = {
			mode: "gateway",
			model: response.headers.get("cf-aig-model") ?? MODEL,
			provider: response.headers.get("cf-aig-provider"),
			cacheStatus: response.headers.get("cf-aig-cache-status"),
			logId: response.headers.get("cf-aig-log-id"),
			status: response.status,
			durationMs: Date.now() - startedAt,
		};

		if (!response.ok) {
			return Response.json({ error: gatewayError(result, response.status), trace }, { status: response.status });
		}

		const responseText = gatewayResponseText(result);

		if (!responseText) {
			return Response.json({ error: "The Gateway returned an empty response.", trace }, { status: 502 });
		}

		return Response.json({ message: responseText, trace });
	} catch (error) {
		return Response.json(
			{
				error: error instanceof Error ? error.message : "The model request failed.",
			},
			{ status: 502 },
		);
	}
}

function gatewayResponseText(result: unknown): string | undefined {
	if (typeof result !== "object" || result === null || !("choices" in result) || !Array.isArray(result.choices)) {
		return undefined;
	}
	const firstChoice = result.choices[0];
	if (typeof firstChoice !== "object" || firstChoice === null || !("message" in firstChoice)) return undefined;
	const message = firstChoice.message;
	if (typeof message !== "object" || message === null || !("content" in message)) return undefined;
	return typeof message.content === "string" ? message.content : undefined;
}

function gatewayError(result: unknown, status: number): string {
	if (typeof result === "object" && result !== null && "error" in result) {
		const error = result.error;
		if (typeof error === "string") return error;
		if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
			return error.message;
		}
		if (
			Array.isArray(error) &&
			typeof error[0] === "object" &&
			error[0] !== null &&
			"message" in error[0] &&
			typeof error[0].message === "string"
		) {
			return error[0].message;
		}
	}
	return `AI Gateway returned HTTP ${status}.`;
}

function normalizeMessages(input: ChatRequest["messages"]): ChatMessage[] {
	if (!Array.isArray(input)) return [];

	return input
		.filter(
			(message) =>
				(message.role === "user" || message.role === "assistant") &&
				typeof message.content === "string" &&
				message.content.trim().length > 0,
		)
		.slice(-MAX_MESSAGES)
		.map((message) => ({
			role: message.role,
			content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
		}));
}
