import { McqForm } from "@/components/mcq-form";

type EditMcqPageProps = {
	params: Promise<{ id: string }>;
};

export default async function EditMcqPage({ params }: EditMcqPageProps) {
	const { id } = await params;

	return <McqForm mode="edit" mcqId={id} />;
}
