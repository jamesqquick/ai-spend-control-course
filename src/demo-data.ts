const PROMPT = "Reply with OK only.";

export const CALLERS = {
	free: {
		label: "Free user",
		tier: "free",
		task: "quick-summary",
		prompt: PROMPT,
	},
	pro: {
		label: "Pro user",
		tier: "pro",
		task: "deep-analysis",
		prompt: PROMPT,
	},
	bot: {
		label: "Background bot",
		tier: "background",
		task: "ticket-review",
		prompt: PROMPT,
	},
} as const;

export type Caller = keyof typeof CALLERS;
