"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { McqWithChoices } from "@/lib/services/mcq-service";

type McqPreviewProps = {
	mcqId: string;
};

export function McqPreview({ mcqId }: McqPreviewProps) {
	const [mcq, setMcq] = useState<McqWithChoices | null>(null);
	const [selectedChoiceId, setSelectedChoiceId] = useState<string>("");
	const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		async function loadMcq() {
			setIsLoading(true);
			setError(null);

			try {
				const response = await fetch(`/api/mcqs/${mcqId}`);
				const body = (await response.json()) as {
					mcq?: McqWithChoices;
					error?: string;
				};

				if (!response.ok || !body.mcq) {
					setError(body.error ?? "MCQ not found.");
					return;
				}

				setMcq(body.mcq);
			} catch {
				setError("Failed to load question.");
			} finally {
				setIsLoading(false);
			}
		}

		void loadMcq();
	}, [mcqId]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!selectedChoiceId) {
			setError("Select an answer before submitting.");
			return;
		}

		setError(null);
		setIsSubmitting(true);

		try {
			const response = await fetch(`/api/mcqs/${mcqId}/attempts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ choiceId: selectedChoiceId }),
			});
			const body = (await response.json()) as {
				attempt?: { isCorrect: boolean };
				error?: string;
			};

			if (!response.ok || !body.attempt) {
				setError(body.error ?? "Failed to submit answer.");
				return;
			}

			setResult(body.attempt.isCorrect ? "correct" : "incorrect");
		} catch {
			setError("Failed to submit answer.");
		} finally {
			setIsSubmitting(false);
		}
	}

	if (isLoading) {
		return (
			<div className="mx-auto w-full max-w-2xl p-6 md:p-10">
				<p className="text-sm text-muted-foreground">Loading preview...</p>
			</div>
		);
	}

	if (!mcq) {
		return (
			<div className="mx-auto w-full max-w-2xl p-6 md:p-10">
				<p className="text-sm text-destructive" role="alert">
					{error ?? "MCQ not found."}
				</p>
				<Button render={<Link href="/mcq" />} nativeButton={false} className="mt-4">
					Back to list
				</Button>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-2xl p-6 md:p-10">
			<Card>
				<CardHeader>
					<CardTitle>{mcq.name}</CardTitle>
					<CardDescription>Preview mode — submit an answer to record an attempt.</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-6">
						<p className="text-base font-medium">{mcq.question}</p>

						<RadioGroup
							value={selectedChoiceId}
							onValueChange={setSelectedChoiceId}
							disabled={result !== null}
						>
							{mcq.choices.map((choice) => (
								<div key={choice.id} className="flex items-center gap-2">
									<RadioGroupItem
										value={choice.id}
										id={`preview-${choice.id}`}
										aria-label={choice.choiceText}
									/>
									<Label htmlFor={`preview-${choice.id}`}>{choice.choiceText}</Label>
								</div>
							))}
						</RadioGroup>

						{error ? <FieldError role="alert">{error}</FieldError> : null}

						{result ? (
							<p
								className={
									result === "correct"
										? "text-sm font-medium text-green-700 dark:text-green-400"
										: "text-sm font-medium text-destructive"
								}
								role="status"
							>
								{result === "correct" ? "Correct!" : "Incorrect."}
							</p>
						) : null}

						<div className="flex flex-wrap gap-2">
							<Button type="submit" disabled={isSubmitting || result !== null}>
								{isSubmitting ? "Submitting..." : "Submit answer"}
							</Button>
							<Button render={<Link href="/mcq" />} nativeButton={false} variant="outline">
								Back to list
							</Button>
							<Button
								render={<Link href={`/mcq/${mcqId}/edit`} />}
								nativeButton={false}
								variant="outline"
							>
								Edit
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
