export const DomainNamespace_AIPrompt = 'ai-prompt';

export const AIPromptType = {
	system: 'system',
	user: 'user',
} as const;

export const AIPromptTypes = [AIPromptType.system, AIPromptType.user] as const;

export type AIPromptType = typeof AIPromptTypes[number];

export const PermissionKey_AIPromptView = 'permission-key--ai-prompt-view';
export const PermissionKey_AIPromptEdit = 'permission-key--ai-prompt-edit';
