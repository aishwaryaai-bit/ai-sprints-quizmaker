import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function Home() {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-lg">
				<Card>
					<CardHeader>
						<CardTitle>Greenfield Quiz Maker</CardTitle>
						<CardDescription>
							Collaborate with other teachers to build a shared test bank of
							multiple-choice questions.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3 sm:flex-row">
						<Button render={<Link href="/register" />} nativeButton={false}>
							Register
						</Button>
						<Button
							render={<Link href="/login" />}
							nativeButton={false}
							variant="outline"
						>
							Login
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
