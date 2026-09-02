"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { getStoredUserId } from "@/lib/auth-session";
import type { McqWithChoices } from "@/lib/services/mcq-service";

type McqFormProps = {
	mode: "create" | "edit";
	mcqId?: string;
};

type ChoiceField = {
	choiceText: string;
};

const EMPTY_CHOICES: ChoiceField[] = [{ choiceText: "" }, { choiceText: "" }];

export function McqForm({ mode, mcqId }: McqFormProps) {
	const router = useRouter();
	const [name, setName] = useState("");
	const [question, setQuestion] = useState("");
	const [choices, setChoices] = useState<ChoiceField[]>(EMPTY_CHOICES);
	const [correctIndex, setCorrectIndex] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLoading, setIsLoading] = useState(mode === "edit");

	useEffect(() => {
		if (mode !== "edit" || !mcqId) {
			return;
		}

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

				setName(body.mcq.name);
				setQuestion(body.mcq.question);
				setChoices(body.mcq.choices.map((choice) => ({ choiceText: choice.choiceText })));
				setCorrectIndex(
					Math.max(
						0,
						body.mcq.choices.findIndex((choice) => choice.isCorrect),
					),
				);
			} catch {
				setError("Failed to load question.");
			} finally {
				setIsLoading(false);
			}
		}

		void loadMcq();
	}, [mode, mcqId]);

	function addChoice() {
		if (choices.length >= 6) {
			return;
		}
		setChoices([...choices, { choiceText: "" }]);
	}

	function removeChoice(index: number) {
		if (choices.length <= 2) {
			return;
		}

		const nextChoices = choices.filter((_, choiceIndex) => choiceIndex !== index);
		setChoices(nextChoices);

		if (correctIndex === index) {
			setCorrectIndex(0);
		} else if (correctIndex > index) {
			setCorrectIndex(correctIndex - 1);
		}
	}

	function updateChoiceText(index: number, value: string) {
		setChoices(
			choices.map((choice, choiceIndex) =>
				choiceIndex === index ? { choiceText: value } : choice,
			),
		);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setIsSubmitting(true);

		const payloadChoices = choices.map((choice, index) => ({
			choiceText: choice.choiceText.trim(),
			isCorrect: index === correctIndex,
		}));

		const payload = {
			name: name.trim(),
			question: question.trim(),
			choices: payloadChoices,
		};

		try {
			if (mode === "create") {
				const createdByUserId = getStoredUserId();
				if (!createdByUserId) {
					setError("Please log in before creating a question.");
					return;
				}

				const response = await fetch("/api/mcqs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ ...payload, createdByUserId }),
				});
				const body = (await response.json()) as { error?: string };

				if (!response.ok) {
					setError(body.error ?? "Failed to create question.");
					return;
				}
			} else if (mcqId) {
				const response = await fetch(`/api/mcqs/${mcqId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				const body = (await response.json()) as { error?: string };

				if (!response.ok) {
					setError(body.error ?? "Failed to update question.");
					return;
				}
			}

			router.push("/mcq");
		} catch {
			setError("Failed to save question.");
		} finally {
			setIsSubmitting(false);
		}
	}

	if (isLoading) {
		return (
			<div className="mx-auto w-full max-w-2xl p-6 md:p-10">
				<p className="text-sm text-muted-foreground">Loading question...</p>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-2xl p-6 md:p-10">
			<Card>
				<CardHeader>
					<CardTitle>{mode === "create" ? "Create MCQ" : "Edit MCQ"}</CardTitle>
					<CardDescription>
						Provide the question prompt and between 2 and 6 answer choices. Mark exactly
						one choice as correct.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="name">Name</FieldLabel>
								<Input
									id="name"
									value={name}
									onChange={(event) => setName(event.target.value)}
									required
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="question">Question</FieldLabel>
								<Textarea
									id="question"
									value={question}
									onChange={(event) => setQuestion(event.target.value)}
									required
								/>
							</Field>

							<div className="space-y-4">
								<div className="flex items-center justify-between gap-2">
									<p className="text-sm font-medium">Choices</p>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={addChoice}
										disabled={choices.length >= 6}
									>
										Add choice
									</Button>
								</div>

								<RadioGroup
									value={String(correctIndex)}
									onValueChange={(value) => setCorrectIndex(Number(value))}
								>
									{choices.map((choice, index) => (
										<div
											key={`choice-${index}`}
											className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
										>
											<div className="flex items-center gap-2">
												<RadioGroupItem
													value={String(index)}
													id={`correct-${index}`}
													aria-label={`Mark ${choice.choiceText || `choice ${index + 1}`} as correct`}
												/>
												<Label htmlFor={`choice-${index}`} className="sr-only">
													Choice text
												</Label>
											</div>
											<Input
												id={`choice-${index}`}
												aria-label="Choice text"
												value={choice.choiceText}
												onChange={(event) =>
													updateChoiceText(index, event.target.value)
												}
												placeholder={`Choice ${index + 1}`}
												required
												className="flex-1"
											/>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => removeChoice(index)}
												disabled={choices.length <= 2}
											>
												Remove choice
											</Button>
										</div>
									))}
								</RadioGroup>
							</div>

							{error ? <FieldError role="alert">{error}</FieldError> : null}

							<div className="flex flex-wrap gap-2">
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Saving..." : "Save"}
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => router.push("/mcq")}
								>
									Cancel
								</Button>
							</div>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
