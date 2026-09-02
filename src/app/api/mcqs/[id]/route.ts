import { getCloudflareContext } from "@opennextjs/cloudflare";
import { internalErrorResponse, validationErrorResponse } from "@/lib/api/responses";
import { createMcqService, McqNotFoundError } from "@/lib/services/mcq-service";
import { updateMcqSchema } from "@/lib/validators/mcq";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
	try {
		const { id } = await context.params;
		const { env } = await getCloudflareContext();
		const mcqService = createMcqService(env.DB);
		const mcq = await mcqService.getMcqById(id);

		if (!mcq) {
			return Response.json({ error: "MCQ not found" }, { status: 404 });
		}

		return Response.json({ mcq });
	} catch {
		return internalErrorResponse();
	}
}

export async function PUT(request: Request, context: RouteContext) {
	try {
		const { id } = await context.params;
		const json: unknown = await request.json();
		const parsed = updateMcqSchema.safeParse(json);

		if (!parsed.success) {
			return validationErrorResponse(parsed.error);
		}

		const { env } = await getCloudflareContext();
		const mcqService = createMcqService(env.DB);
		const mcq = await mcqService.updateMcq(id, parsed.data);

		return Response.json({ mcq });
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return Response.json({ error: "MCQ not found" }, { status: 404 });
		}

		return internalErrorResponse();
	}
}

export async function DELETE(_request: Request, context: RouteContext) {
	try {
		const { id } = await context.params;
		const { env } = await getCloudflareContext();
		const mcqService = createMcqService(env.DB);
		const existing = await mcqService.getMcqById(id);

		if (!existing) {
			return Response.json({ error: "MCQ not found" }, { status: 404 });
		}

		await mcqService.deleteMcq(id);

		return Response.json({ success: true });
	} catch {
		return internalErrorResponse();
	}
}
