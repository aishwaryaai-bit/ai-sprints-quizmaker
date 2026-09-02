import { createHash } from "node:crypto";

const baseUrl = process.env.PREVIEW_URL ?? "http://127.0.0.1:8787";
const password = "password123";
const passwordHash = createHash("sha256").update(password).digest("hex");

const username = `smoke${Date.now()}`;
const registerBody = {
	firstName: "Smoke",
	lastName: "Test",
	username,
	email: `${username}@school.edu`,
	passwordHash,
};

async function request(path, options = {}) {
	const { method = "POST", body } = options;
	const response = await fetch(`${baseUrl}${path}`, {
		method,
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await response.text();
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		json = text;
	}
	return { status: response.status, body: json };
}

async function main() {
	const results = [];

	const register = await request("/api/auth/register", { body: registerBody });
	results.push({ step: "register", ...register });

	const userId = register.body?.user?.id;
	if (!userId) {
		console.log(
			JSON.stringify(
				{ username, passwordHashSent: true, results, error: "Missing user id from register" },
				null,
				2,
			),
		);
		process.exitCode = 1;
		return;
	}

	results.push({
		step: "login",
		...(await request("/api/auth/login", {
			body: { usernameOrEmail: username, passwordHash },
		})),
	});
	results.push({
		step: "logout",
		...(await request("/api/auth/logout")),
	});
	results.push({
		step: "duplicate-register",
		...(await request("/api/auth/register", { body: registerBody })),
	});

	const createMcq = await request("/api/mcqs", {
		body: {
			name: "Smoke test MCQ",
			question: "Which planet is closest to the Sun?",
			createdByUserId: userId,
			choices: [
				{ choiceText: "Venus", isCorrect: false },
				{ choiceText: "Mercury", isCorrect: true },
			],
		},
	});
	results.push({ step: "mcq-create", ...createMcq });

	const mcqId = createMcq.body?.mcq?.id;

	if (!mcqId) {
		console.log(
			JSON.stringify(
				{
					username,
					passwordHashSent: true,
					results,
					error: "Missing mcq id from create",
				},
				null,
				2,
			),
		);
		process.exitCode = 1;
		return;
	}

	results.push({
		step: "mcq-list",
		...(await request("/api/mcqs", { method: "GET" })),
	});
	results.push({
		step: "mcq-get",
		...(await request(`/api/mcqs/${mcqId}`, { method: "GET" })),
	});
	const updateMcq = await request(`/api/mcqs/${mcqId}`, {
		method: "PUT",
		body: {
			name: "Smoke test MCQ (updated)",
			question: "Which planet is closest to the Sun?",
			choices: [
				{ choiceText: "Venus", isCorrect: false },
				{ choiceText: "Mercury", isCorrect: true },
			],
		},
	});
	results.push({ step: "mcq-update", ...updateMcq });

	const attemptChoiceId = updateMcq.body?.mcq?.choices?.find((choice) => choice.isCorrect)?.id;
	if (!attemptChoiceId) {
		console.log(
			JSON.stringify(
				{
					username,
					passwordHashSent: true,
					results,
					error: "Missing correct choice id after update",
				},
				null,
				2,
			),
		);
		process.exitCode = 1;
		return;
	}

	results.push({
		step: "mcq-attempt",
		...(await request(`/api/mcqs/${mcqId}/attempts`, {
			body: { choiceId: attemptChoiceId },
		})),
	});
	results.push({
		step: "mcq-delete",
		...(await request(`/api/mcqs/${mcqId}`, { method: "DELETE" })),
	});

	const pages = ["/", "/register", "/login", "/mcq", "/mcq/new"];
	for (const path of pages) {
		const response = await fetch(`${baseUrl}${path}`);
		results.push({ step: `page${path}`, status: response.status });
	}

	console.log(JSON.stringify({ username, passwordHashSent: true, results }, null, 2));

	const failed = results.filter(
		(r) =>
			(r.step === "register" && r.status !== 201) ||
			(r.step === "login" && r.status !== 200) ||
			(r.step === "logout" && r.status !== 200) ||
			(r.step === "duplicate-register" && r.status !== 409) ||
			(r.step === "mcq-create" && r.status !== 201) ||
			(r.step === "mcq-list" && r.status !== 200) ||
			(r.step === "mcq-get" && r.status !== 200) ||
			(r.step === "mcq-update" && r.status !== 200) ||
			(r.step === "mcq-attempt" && r.status !== 201) ||
			(r.step === "mcq-delete" && r.status !== 200) ||
			(r.step.startsWith("page") && r.status !== 200),
	);

	if (failed.length > 0) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
