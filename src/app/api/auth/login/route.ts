import { getCloudflareContext } from "@opennextjs/cloudflare";
import { internalErrorResponse, validationErrorResponse } from "@/lib/api/responses";
import { createUserService } from "@/lib/services/user-service";
import { loginSchema } from "@/lib/validators/auth";

const INVALID_CREDENTIALS_MESSAGE = "Invalid username or password";

export async function POST(request: Request) {
	try {
		const json: unknown = await request.json();
		const parsed = loginSchema.safeParse(json);

		if (!parsed.success) {
			return validationErrorResponse(parsed.error);
		}

		const { env } = await getCloudflareContext();
		const userService = createUserService(env.DB);
		const userRecord = await userService.findByUsernameOrEmail(parsed.data.usernameOrEmail);

		if (!userRecord) {
			return Response.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
		}

		const passwordMatches = await userService.verifyPassword(
			userRecord.passwordHash,
			parsed.data.passwordHash,
		);

		if (!passwordMatches) {
			return Response.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
		}

		const { passwordHash: _unused, ...user } = userRecord;
		void _unused;

		return Response.json({ success: true, user }, { status: 200 });
	} catch {
		return internalErrorResponse();
	}
}
