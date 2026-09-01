import { getCloudflareContext } from "@opennextjs/cloudflare";
import { internalErrorResponse, validationErrorResponse } from "@/lib/api/responses";
import { ChoiceNotFoundError, createMcqService } from "@/lib/services/mcq-service";
import { attemptSchema } from "@/lib/validators/mcq";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
	try {
		const { id } = await context.params;
		const json: unknown = await request.json();
		const parsed = attemptSchema.safeParse(json);

		if (!parsed.success) {
			return validationErrorResponse(parsed.error);
		}

		const { env } = await getCloudflareContext();
		const mcqService = createMcqService(env.DB);
		const attempt = await mcqService.createAttempt(id, parsed.data.choiceId);

		return Response.json({ attempt }, { status: 201 });
	} catch (error) {
		if (error instanceof ChoiceNotFoundError) {
			return Response.json({ error: "Choice not found" }, { status: 404 });
		}

		return internalErrorResponse();
	}
}
