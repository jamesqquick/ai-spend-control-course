export const CALLERS = {
	free: {
		label: "Free user",
		tier: "free",
		task: "quick-summary",
		prompt: "Summarize this ticket in one line: my password reset email never arrived.",
	},
	pro: {
		label: "Pro user",
		tier: "pro",
		task: "deep-analysis",
		prompt: "Analyze this ticket and propose a fix plan: SSO login fails for 30% of our users since Monday.",
	},
	bot: {
		label: "Background bot",
		tier: "background",
		task: "ticket-review",
		prompt: "Review this ticket and tag it with one category: the printer shows error 50.4.",
	},
} as const;

export type Caller = keyof typeof CALLERS;
