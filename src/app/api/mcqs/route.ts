import { getCloudflareContext } from "@opennextjs/cloudflare";
import { internalErrorResponse, validationErrorResponse } from "@/lib/api/responses";
import { createMcqService } from "@/lib/services/mcq-service";
import { createMcqSchema } from "@/lib/validators/mcq";

export async function GET() {
	try {
		const { env } = await getCloudflareContext();
		const mcqService = createMcqService(env.DB);
		const mcqs = await mcqService.listMcqs();

		return Response.json({ mcqs });
	} catch {
		return internalErrorResponse();
	}
}

export async function POST(request: Request) {
	try {
		const json: unknown = await request.json();
		const parsed = createMcqSchema.safeParse(json);

		if (!parsed.success) {
			return validationErrorResponse(parsed.error);
		}

		const { env } = await getCloudflareContext();
		const mcqService = createMcqService(env.DB);
		const mcq = await mcqService.createMcq(parsed.data);

		return Response.json({ mcq }, { status: 201 });
	} catch {
		return internalErrorResponse();
	}
}
