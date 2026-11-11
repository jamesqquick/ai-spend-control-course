const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const thread = document.querySelector("#thread");
const sendButton = document.querySelector("#send-button");
const personaSelect = document.querySelector("#persona-select");
const traceResult = document.querySelector("#trace-result");
const messages = [];
let sessionId = createSessionId();
let config;
sendButton.disabled = true;
input.disabled = true;

const escapeHtml = (value) =>
	value.replace(/[&<>"']/g, (character) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	})[character]);

function createSessionId() {
	return crypto.randomUUID().replaceAll("-", "");
}

function currentPersona() {
	return config.personas.find((persona) => persona.id === personaSelect.value);
}

function updatePersona() {
	const persona = currentPersona();
	if (!persona) return;
	document.querySelector("#persona-avatar").textContent = persona.label[0];
	document.querySelector("#tiny-avatar").textContent = persona.label[0];
	document.querySelector("#persona-name").textContent = persona.label;
	document.querySelector("#persona-team").textContent = `${persona.role} · ${persona.team}`;
}

function addMessage(role, text, state = "") {
	const row = document.createElement("div");
	row.className = `message-row ${role}${state ? ` ${state}` : ""}`;
	const author = role === "user" ? currentPersona().label : "Fieldstone copilot";
	const icon = role === "user" ? currentPersona().label[0] : "✳";
	const avatarClass = role === "user" ? "persona-avatar" : "copilot-avatar";
	const content = state === "pending"
		? '<span class="typing-dots" aria-label="Thinking"><i></i><i></i><i></i></span>'
		: escapeHtml(text).replaceAll("\n", "<br>");
	row.innerHTML = `<span class="${avatarClass}" aria-hidden="true">${escapeHtml(icon)}</span><div class="message-body"><div class="message-byline"><strong>${escapeHtml(author)}</strong><span>${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div><div class="message-copy">${content}</div></div>`;
	thread.append(row);
	thread.scrollTop = thread.scrollHeight;
	return row;
}

function updateTrace(trace) {
	traceResult.classList.add("has-result");
	const facts = [
		`HTTP ${trace.status}`,
		`${trace.durationMs} ms`,
		trace.logId ? `log ${trace.logId}` : null,
		trace.provider ? `provider ${trace.provider}` : null,
		trace.cacheStatus ? `cache ${trace.cacheStatus}` : null,
	].filter(Boolean);
	traceResult.innerHTML = `<span class="trace-empty-icon" aria-hidden="true">✓</span><span>${facts.map(escapeHtml).join(" · ")}</span>`;
	if (trace.model) document.querySelector("#model-name").textContent = trace.model;
}

async function sendMessage(text) {
	const cleanText = text.trim();
	if (!cleanText || sendButton.disabled) return;

	messages.push({ role: "user", content: cleanText });
	addMessage("user", cleanText);
	const pending = addMessage("assistant", "", "pending");
	input.value = "";
	document.querySelector("#char-count").textContent = "0";
	sendButton.disabled = true;
	input.disabled = true;

	try {
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ personaId: personaSelect.value, sessionId, messages }),
		});
		const result = await response.json();
		if (result.trace) updateTrace(result.trace);
		if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);

		messages.push({ role: "assistant", content: result.message });
		pending.remove();
		addMessage("assistant", result.message);
	} catch (error) {
		pending.remove();
		messages.pop();
		thread.querySelector(".message-row.user:last-of-type")?.remove();
		addMessage("assistant", error instanceof Error ? error.message : "The request failed.", "error");
	} finally {
		sendButton.disabled = false;
		input.disabled = false;
		input.focus();
	}
}

function resetConversation() {
	messages.length = 0;
	sessionId = createSessionId();
	thread.querySelectorAll(".message-row").forEach((row) => row.remove());
	input.value = "";
	document.querySelector("#char-count").textContent = "0";
	traceResult.classList.remove("has-result");
	traceResult.innerHTML = '<span class="trace-empty-icon">◌</span><span>Send a prompt to see the request details.</span>';
	if (config?.model) document.querySelector("#model-name").textContent = config.model;
}

form.addEventListener("submit", (event) => {
	event.preventDefault();
	void sendMessage(input.value);
});

input.addEventListener("input", () => {
	document.querySelector("#char-count").textContent = String(input.value.length);
});

input.addEventListener("keydown", (event) => {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		form.requestSubmit();
	}
});

personaSelect.addEventListener("change", updatePersona);
document.querySelector("#new-chat").addEventListener("click", resetConversation);

async function initialize() {
	try {
		const configResponse = await fetch("/api/config");
		config = await configResponse.json();
		document.querySelector("#model-name").textContent = config.model;
		document.querySelector("#route-name").textContent = config.mode === "gateway"
			? "Through AI Gateway"
			: "Direct to Workers AI";
		if (config.mode === "gateway") {
			const routeVisual = document.querySelector(".route-visual");
			routeVisual.classList.add("gateway-route");
			routeVisual.setAttribute("aria-label", "Your app connects through AI Gateway to Workers AI");
			document.querySelector(".gateway-node").hidden = false;
			document.querySelector(".gateway-line").hidden = false;
			document.querySelector("#route-name").textContent = `AI Gateway · ${config.model}`;
			document.querySelector("#attribution-caption").textContent = "Team, user, session, and case metadata are attached by the Worker.";
			document.querySelector("#lesson-title").textContent = "Spend is attributed by team";
			document.querySelector("#lesson-copy").textContent = "Use the team=interns metadata filter to put a spend limit on intern traffic.";
			document.querySelector("#lesson-link").textContent = "Open AI Gateway docs ↗";
		}
		document.querySelector("#prompt-list").innerHTML = config.prompts.map((prompt) =>
			`<button class="prompt-chip" type="button" data-prompt="${escapeHtml(prompt.text)}">${escapeHtml(prompt.label)}</button>`,
		).join("");
		document.querySelectorAll(".prompt-chip").forEach((button) => {
			button.addEventListener("click", () => {
				input.value = button.dataset.prompt;
				input.dispatchEvent(new Event("input"));
				input.focus();
			});
		});
		updatePersona();
		sendButton.disabled = false;
		input.disabled = false;
	} catch {
		document.querySelector("#model-name").textContent = "Unable to load configuration";
		traceResult.textContent = "The app could not load its Worker configuration. Refresh to try again.";
	}
}

void initialize();
