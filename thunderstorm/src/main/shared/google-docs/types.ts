export const UpdateType_Text = 'text';
export type GoogleDocs_UpdateText = {
	type: typeof UpdateType_Text,
	content: string,
};

export const UpdateType_List = 'list';

export type GoogleDocs_UpdateList = {
	type: typeof UpdateType_List,
	items: (string | GoogleDocs_UpdateList_Nested)[], // Support nested lists
};

export type GoogleDocs_UpdateList_Nested = {
	items: (string | GoogleDocs_UpdateList_Nested)[], // Nested list items (recursive up to 3 levels)
};

export const UpdateType_Table = 'table';
export type GoogleDocs_UpdateTable = {
	type: typeof UpdateType_Table,
	headers: string[],
	rows: string[][],
};

export type GoogleDocs_UpdateRequest = GoogleDocs_UpdateText | GoogleDocs_UpdateList | GoogleDocs_UpdateTable;
export type GoogleDocs_ParamRange = {
	startIndex: number;
	endIndex: number
}