export const AIPromptType = {
	system: 'system',
	user: 'user',
} as const;

export const AIPromptTypes = [AIPromptType.system, AIPromptType.user] as const;
export type AIPromptType = typeof AIPromptTypes[number];