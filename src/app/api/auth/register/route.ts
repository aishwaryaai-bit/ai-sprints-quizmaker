import { getCloudflareContext } from "@opennextjs/cloudflare";
import { internalErrorResponse, validationErrorResponse } from "@/lib/api/responses";
import { createUserService, DuplicateUserError } from "@/lib/services/user-service";
import { registerSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
	try {
		const json: unknown = await request.json();
		const parsed = registerSchema.safeParse(json);

		if (!parsed.success) {
			return validationErrorResponse(parsed.error);
		}

		const { env } = await getCloudflareContext();
		const userService = createUserService(env.DB);
		const user = await userService.createUser(parsed.data);

		return Response.json({ success: true, user }, { status: 201 });
	} catch (error) {
		if (error instanceof DuplicateUserError) {
			return Response.json(
				{ error: "Username or email already exists" },
				{ status: 409 },
			);
		}

		return internalErrorResponse();
	}
}
