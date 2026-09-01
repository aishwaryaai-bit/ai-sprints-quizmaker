import type { ZodError } from "zod";

export function validationErrorResponse(error: ZodError) {
	return Response.json(
		{
			error: "Validation failed",
			details: error.issues.map((issue) => ({
				path: issue.path,
				message: issue.message,
			})),
		},
		{ status: 400 },
	);
}

export function internalErrorResponse() {
	return Response.json({ error: "Internal server error" }, { status: 500 });
}
