import {AsyncVoidFunction, BadImplementationException, exists, LogClient_MemBuffer, removeItemFromArray} from '@nu-art/ts-common';
import {ConsoleScreen} from '@nu-art/commando/console/ConsoleScreen';
import {BlessedWidget} from '@nu-art/commando/console/types';


export class RunningProcessLogs
	extends ConsoleScreen<{ logs: { key: string, logClient: LogClient_MemBuffer }[] }> {

	private onTerminateCallbacks: AsyncVoidFunction[] = [];

	constructor() {
		let killed = false;
		super({
				smartCSR: true,
				title: 'Runtime-Logs',
			}, [
				{
					keys: ['C-c'],  // Example to submit form with Enter key
					callback: async () => {
						if (killed)
							return;

						killed = true;
						// this.dispose();
						await Promise.all(this.onTerminateCallbacks.map(callback => callback()));
						process.exit(0);
					}
				},
				{
					keys: ['up'], // Scroll up on Control-U
					callback: () => this.scrollFocusedLog(-1),
				},
				{
					keys: ['down'], // Scroll down on Control-D
					callback: () => this.scrollFocusedLog(1),
				},
			]
		);

		this.state = {logs: []};
	}

	scrollFocusedLog(direction: number): void {
		const focusedWidget = this.getFocusedWidget() as BlessedWidget['log'];
		focusedWidget.scroll(direction);
		focusedWidget.setLabel(`scroll pos: ${focusedWidget.getScroll()}`);
	}

	protected createContent() {
		const logs = this.state.logs;

		const fittingGrid = gridPreset[logs.length - 1];
		if (!exists(fittingGrid))
			return;

		if (!fittingGrid)
			throw new Error(`No preset available for this number of cells ${logs.length}`);

		let index = 0;
		let xPos = 0;
		fittingGrid.forEach(column => {
			let yPos = 0;
			column.forEach(cell => {
				const [fracWidth, fracHeight] = cell;
				const width = 100 * fracWidth;
				const height = 100 * fracHeight;

				this.createWidget('log', {
					top: `${yPos}%`,
					left: `${xPos}%`,
					width: `${width}%`,
					height: `${height}%`,
					label: ` Log for ${logs[index++].key} `,
					border: {type: 'line'},
					style: {
						focus: {border: {fg: 'blue'}}, border: {fg: 'green'}, hover: {border: {fg: 'red'}}
					},
					scrollable: true,
					scrollbar: {
						ch: ' ',
						track: {
							bg: 'grey'
						},
						style: {
							inverse: true
						}
					},
				});

				yPos += height;  // Assumes all cells in a column have the same height
			});
			xPos += column[0][0] * 100;
		});
	}

	registerApp(appKey: string, logClient: LogClient_MemBuffer) {
		const logs = this.state.logs;
		const foundLog = logs.find(log => log.key === appKey);
		if (foundLog)
			throw new BadImplementationException(`already have log for appkey: ${appKey}`);

		logs.push({key: appKey, logClient});
		this.dispose();
		this.create();

		logClient.setLogAppendedListener(() => {
			this.render();
			// might have a leak.. need to remove the listener at some point
		});
		this.setState({logs});
	}

	unregisterApp(appKey: string) {
		const foundLog = this.state.logs.find(log => log.key === appKey);
		if (!foundLog)
			throw new BadImplementationException(`Could not find log for appkey: ${appKey}`);

		const logs = this.state.logs;
		removeItemFromArray(logs, foundLog);

		this.dispose();
		this.create();

		this.setState({logs});
	}

	protected render(): void {
		try {
			this.state.logs.forEach((log, i) => {
				(this.widgets[i] as BlessedWidget['log'])?.setContent(log.logClient.buffers[0] ?? 'asdsd');
			});
		} catch (e) {
			console.log(e);
		}
	}

	public addOnTerminateCallback = (callback: AsyncVoidFunction) => {
		this.onTerminateCallbacks.push(callback);
	};
}

type GridCell = [number, number];  // Represents [fractionWidth, fractionHeight]
type GridColumn = GridCell[];
const columnOf1_halfWidth: GridColumn = [[0.5, 1]];
const columnOf2_halfWidth: GridColumn = [[0.5, 0.5], [0.5, 0.5]];
const columnOf3_halfWidth: GridColumn = [[0.5, 1 / 3], [0.5, 1 / 3], [0.5, 1 / 3]];
const columnOf2_3rdWidth: GridColumn = [[1 / 3, 0.5], [1 / 3, 0.5]];
const columnOf3_3rdWidth: GridColumn = [[1 / 3, 1 / 3], [1 / 3, 1 / 3], [1 / 3, 1 / 3]];
const gridPreset: GridColumn[][] = [
	[[[1, 1]]],
	[columnOf1_halfWidth, columnOf1_halfWidth],
	[columnOf2_halfWidth, columnOf1_halfWidth],
	[columnOf2_halfWidth, columnOf2_halfWidth],
	[columnOf3_halfWidth, columnOf2_halfWidth],
	[columnOf3_halfWidth, columnOf3_halfWidth],
	[columnOf3_3rdWidth, columnOf2_3rdWidth, columnOf2_3rdWidth],
	[columnOf3_3rdWidth, columnOf3_3rdWidth, columnOf2_3rdWidth],
	[columnOf3_3rdWidth, columnOf3_3rdWidth, columnOf3_3rdWidth],
];