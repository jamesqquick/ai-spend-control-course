const buttons = [...document.querySelectorAll(".caller-button")];
const receipt = document.querySelector("#receipt");
const breakdown = document.querySelector("#breakdown");
const breakdownEmpty = document.querySelector("#breakdown-empty");
const requestCount = document.querySelector("#request-count");
let config;
let totalRequests = 0;
const activeCallers = new Set();
const breakdownCounts = new Map();

function appendCell(row, text) {
	const cell = document.createElement("td");
	cell.textContent = text ?? "";
	row.append(cell);
}

function renderBreakdown() {
	breakdown.replaceChildren();
	breakdownEmpty.hidden = breakdownCounts.size > 0;
	for (const [label, count] of breakdownCounts) {
		const item = document.createElement("div");
		item.className = "breakdown-item";
		const heading = document.createElement("div");
		heading.className = "breakdown-item-heading";
		const name = document.createElement("strong");
		name.textContent = label;
		const tally = document.createElement("span");
		tally.textContent = `${count} of ${totalRequests}`;
		heading.append(name, tally);
		const track = document.createElement("div");
		track.className = "breakdown-track";
		const fill = document.createElement("span");
		fill.className = "breakdown-fill";
		fill.style.width = `${(count / totalRequests) * 100}%`;
		track.append(fill);
		item.append(heading, track);
		breakdown.append(item);
	}
}

function addReceipt(result, caller) {
	const emptyRow = receipt.querySelector(".receipt-empty-row");
	emptyRow?.remove();
	const row = document.createElement("tr");
	row.className = `receipt-row receipt-${result.status || "error"}`;
	if (result.error) row.title = result.error;
	const callerInfo = config.callers.find((item) => item.id === caller);
	const model = result.modelSize && result.model
		? `${result.modelSize} · ${result.model}`
		: result.model ?? config.model;
	const status = result.status === "ok"
		? "OK"
		: result.status === "blocked"
			? "Blocked"
			: result.status === "downgraded"
				? "Downgraded"
				: "Error";
	appendCell(row, new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }));
	appendCell(row, result.callerLabel ?? callerInfo?.label ?? caller);
	appendCell(row, result.seenAs ?? "Unavailable");
	appendCell(row, model);
	appendCell(row, result.statusCode ? `${status} · HTTP ${result.statusCode}` : status);
	receipt.prepend(row);

	totalRequests += 1;
	requestCount.textContent = `${totalRequests} ${totalRequests === 1 ? "request" : "requests"}`;
	const seenAs = result.seenAs ?? "Unavailable";
	breakdownCounts.set(seenAs, (breakdownCounts.get(seenAs) ?? 0) + 1);
	renderBreakdown();
}

async function runRequest(caller) {
	const startedAt = performance.now();
	try {
		const response = await fetch("/api/run", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ caller }),
		});
		const payload = await response.json().catch(() => null);
		const result = payload && typeof payload === "object" ? payload : {};
		if (!result.status) result.status = response.ok ? "ok" : "error";
		if (!result.durationMs) result.durationMs = Math.round(performance.now() - startedAt);
		addReceipt(result, caller);
	} catch (error) {
		addReceipt({
			status: "error",
			seenAs: "Gateway status unavailable",
			model: config.model,
			error: error instanceof Error ? error.message : "The request failed.",
		}, caller);
	}
}

function renderButtons() {
	for (const button of buttons) {
		const running = activeCallers.has(button.dataset.caller);
		button.disabled = running || !config;
		button.querySelector(".run-spinner").hidden = !running;
		if (running) button.setAttribute("aria-busy", "true");
		else button.removeAttribute("aria-busy");
	}
}

for (const button of buttons) {
	button.addEventListener("click", async () => {
		const caller = button.dataset.caller;
		if (!config || activeCallers.has(caller)) return;
		const count = Math.max(1, Number(button.dataset.count) || 1);
		activeCallers.add(caller);
		renderButtons();
		try {
			for (let index = 0; index < count; index += 1) await runRequest(caller);
		} finally {
			activeCallers.delete(caller);
			renderButtons();
		}
	});
}

async function initialize() {
	try {
		const response = await fetch("/api/config");
		if (!response.ok) throw new Error("Could not load lab configuration.");
		config = await response.json();
		renderButtons();
	} catch (error) {
		console.error("Unable to load lab configuration.", error);
	}
}

void initialize();
