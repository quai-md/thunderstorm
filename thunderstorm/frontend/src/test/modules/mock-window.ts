type MessageHandler = (event: MessageEvent) => void;

const handlers: MessageHandler[] = [];

const mockWindow = {
	addEventListener(type: string, handler: EventListener) {
		if (type !== 'message')
			return;

		handlers.push(handler as MessageHandler);
	},
	removeEventListener(type: string, handler: EventListener) {
		if (type !== 'message')
			return;

		const index = handlers.indexOf(handler as MessageHandler);
		if (index >= 0)
			handlers.splice(index, 1);
	},
};

(globalThis as {window?: typeof mockWindow}).window = mockWindow;

export function emitWindowMessage(origin: string, data: unknown) {
	const event = {origin, data} as MessageEvent;
	handlers.slice().forEach(handler => handler(event));
}

export function messageListenerCount() {
	return handlers.length;
}
