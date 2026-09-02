export const USER_ID_STORAGE_KEY = "quizmaker:userId";

export function getStoredUserId(): string | null {
	if (typeof window === "undefined") {
		return null;
	}
	return sessionStorage.getItem(USER_ID_STORAGE_KEY);
}

export function storeUserId(userId: string): void {
	sessionStorage.setItem(USER_ID_STORAGE_KEY, userId);
}
