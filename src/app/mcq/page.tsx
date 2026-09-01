import { LogoutButton } from "@/components/logout-button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function McqPage() {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-lg">
				<Card>
					<CardHeader>
						<CardTitle>MCQ Test Bank — Coming Soon</CardTitle>
						<CardDescription>
							Question authoring and collaboration will be built in the next sprint.
							You&apos;ve reached the workspace stub after signing in.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<LogoutButton />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
