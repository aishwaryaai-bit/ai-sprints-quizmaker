"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MoreVertical } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Mcq } from "@/lib/services/mcq-service";

async function fetchMcqs(): Promise<{ mcqs: Mcq[]; error: string | null }> {
	try {
		const response = await fetch("/api/mcqs");
		const body = (await response.json()) as { mcqs?: Mcq[]; error?: string };

		if (!response.ok) {
			return { mcqs: [], error: body.error ?? "Failed to load questions." };
		}

		return { mcqs: body.mcqs ?? [], error: null };
	} catch {
		return { mcqs: [], error: "Failed to load questions." };
	}
}

export function McqList() {
	const router = useRouter();
	const [mcqs, setMcqs] = useState<Mcq[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Mcq | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const loadMcqs = useCallback(async (options?: { showLoading?: boolean }) => {
		if (options?.showLoading ?? true) {
			setLoading(true);
		}
		setError(null);

		const { mcqs: nextMcqs, error: nextError } = await fetchMcqs();
		setMcqs(nextMcqs);
		setError(nextError);
		setLoading(false);
	}, []);

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			const { mcqs: nextMcqs, error: nextError } = await fetchMcqs();
			if (cancelled) {
				return;
			}
			setMcqs(nextMcqs);
			setError(nextError);
			setLoading(false);
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	async function handleDeleteConfirm() {
		if (!deleteTarget) {
			return;
		}

		setIsDeleting(true);

		try {
			const response = await fetch(`/api/mcqs/${deleteTarget.id}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				setError("Failed to delete question.");
				return;
			}

			setDeleteTarget(null);
			await loadMcqs();
		} catch {
			setError("Failed to delete question.");
		} finally {
			setIsDeleting(false);
		}
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 md:p-10">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold">MCQ Test Bank</h1>
					<p className="text-sm text-muted-foreground">
						Create, edit, preview, and manage multiple-choice questions.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button render={<Link href="/mcq/new" />} nativeButton={false}>
						Create MCQ
					</Button>
					<LogoutButton />
				</div>
			</div>

			{error ? (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}

			{loading ? (
				<p className="text-sm text-muted-foreground">Loading questions...</p>
			) : mcqs.length === 0 ? (
				<div className="rounded-lg border border-dashed p-8 text-center">
					<p className="text-sm text-muted-foreground">
						No multiple-choice questions yet. Create your first MCQ to get started.
					</p>
				</div>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Question</TableHead>
							<TableHead className="w-[80px] text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{mcqs.map((mcq) => (
							<TableRow key={mcq.id}>
								<TableCell className="font-medium">{mcq.name}</TableCell>
								<TableCell className="max-w-md truncate text-muted-foreground">
									{mcq.question}
								</TableCell>
								<TableCell className="text-right">
									<DropdownMenu>
										<DropdownMenuTrigger
											render={
												<Button
													variant="ghost"
													size="icon-sm"
													aria-label={`Actions for ${mcq.name}`}
												/>
											}
										>
											<MoreVertical />
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												onClick={() => router.push(`/mcq/${mcq.id}/edit`)}
											>
												Edit
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => router.push(`/mcq/${mcq.id}/preview`)}
											>
												Preview
											</DropdownMenuItem>
											<DropdownMenuItem
												variant="destructive"
												onClick={() => setDeleteTarget(mcq)}
											>
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<AlertDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTarget(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete MCQ?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently removes &quot;{deleteTarget?.name}&quot; and all of its
							choices and attempts.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={isDeleting}
							onClick={() => void handleDeleteConfirm()}
						>
							{isDeleting ? "Deleting..." : "Delete MCQ"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
