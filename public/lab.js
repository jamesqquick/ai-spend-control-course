const buttons = [...document.querySelectorAll(".user-type-button")];
const receipt = document.querySelector("#receipt");
const breakdown = document.querySelector("#breakdown");
const breakdownEmpty = document.querySelector("#breakdown-empty");
const requestCount = document.querySelector("#request-count");
let config;
let totalRequests = 0;
const activeUserTypes = new Set();
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

function addReceipt(result, userType) {
	const emptyRow = receipt.querySelector(".receipt-empty-row");
	emptyRow?.remove();
	const row = document.createElement("tr");
	row.className = `receipt-row receipt-${result.status || "error"}`;
	if (result.error) row.title = result.error;
	const userTypeInfo = config.userTypes.find((item) => item.id === userType);
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
	appendCell(row, result.userTypeLabel ?? userTypeInfo?.label ?? userType);
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

async function runRequest(userType) {
	try {
		const response = await fetch("/api/run", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ user_type: userType }),
		});
		const payload = await response.json().catch(() => null);
		const result = payload && typeof payload === "object" ? payload : {};
		if (!result.status) result.status = response.ok ? "ok" : "error";
		addReceipt(result, userType);
	} catch (error) {
		addReceipt({
			status: "error",
			seenAs: "Gateway status unavailable",
			model: config.model,
			error: error instanceof Error ? error.message : "The request failed.",
		}, userType);
	}
}

function renderButtons() {
	for (const button of buttons) {
		const running = activeUserTypes.has(button.dataset.userType);
		button.disabled = running || !config;
		button.querySelector(".run-spinner").hidden = !running;
		if (running) button.setAttribute("aria-busy", "true");
		else button.removeAttribute("aria-busy");
	}
}

for (const button of buttons) {
	button.addEventListener("click", async () => {
		const userType = button.dataset.userType;
		if (!config || activeUserTypes.has(userType)) return;
		const count = Math.max(1, Number(button.dataset.count) || 1);
		activeUserTypes.add(userType);
		renderButtons();
		try {
			for (let index = 0; index < count; index += 1) await runRequest(userType);
		} finally {
			activeUserTypes.delete(userType);
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
