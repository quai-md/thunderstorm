type GoogleDocs_UpdateText = {
	type: 'text',
	content: string,
};

type GoogleDocs_UpdateList = {
	type: 'list',
	items: string[],
};

type GoogleDocs_UpdateTable = {
	type: 'table',
	headers: string[],
	rows: string[][],
};

export type GoogleDocs_UpdateRequest = GoogleDocs_UpdateText | GoogleDocs_UpdateList | GoogleDocs_UpdateTable;