import * as React from 'react';
import {ComponentSync} from '../../core/ComponentSync.js';
import {ModuleFE_Dialog} from '../../component-modules/ModuleFE_Dialog.js';
import {LL_H_C, LL_V_L} from '../../components/Layouts/index.js';
import {TS_Icons} from '@nu-art/ts-styles';
import {TS_Checkbox} from '../../components/TS_Checkbox/TS_Checkbox.js';
import {Button} from '../../components/Button/Button.js';
import {QueueV2} from '@nu-art/ts-common/utils/queue-v2';
import {ModuleFE_SyncEnvV2} from '../../modules/sync-env/ModuleFE_SyncEnvV2.js';
import './Dialog_SyncEnvFromProd.scss';


type CollectionStatus = 'idle' | 'running' | 'done' | 'failed';

type CollectionRow = {
	dbKey: string
	wipe: boolean
	status: CollectionStatus
	error?: string
};

type State = {
	collections?: CollectionRow[]
	running: boolean
	error?: string
};

const Const_SyncEnv_ModalParallel = 2;

export class Dialog_SyncEnvFromProd
	extends ComponentSync<{}, State> {

	static show = () => {
		ModuleFE_Dialog.show({
			content: <Dialog_SyncEnvFromProd/>,
		});
	};

	protected deriveStateFromProps(nextProps: {}, state: State): State {
		state.running ??= false;
		return state;
	}

	async componentDidMount() {
		try {
			const collections = await ModuleFE_SyncEnvV2.fetchSyncableCollections();
			this.setState({
				collections: collections.map(dbKey => ({dbKey, wipe: false, status: 'idle'})),
			});
		} catch (e: any) {
			this.setState({error: e.message});
		}
	}

	private patchRow = (dbKey: string, patch: Partial<CollectionRow>) => {
		this.setState(prev => ({
			collections: prev.collections?.map(row => row.dbKey === dbKey ? {...row, ...patch} : row),
		}));
	};

	private syncCollections = async (dbKeys: string[]) => {
		if (this.state.running || !this.state.collections)
			return;

		this.setState({running: true});
		const queue = new QueueV2<string>('sync-from-prod', async dbKey => {
			this.patchRow(dbKey, {status: 'running', error: undefined});
			const row = this.state.collections!.find(collection => collection.dbKey === dbKey);
			await ModuleFE_SyncEnvV2.syncFromProd({
				selectedModules: [dbKey],
				deleteMissing: true,
				cleanSync: row?.wipe,
			});
		}).setParallelCount(Const_SyncEnv_ModalParallel);

		for (const dbKey of dbKeys)
			queue.addItemImpl(
				dbKey,
				() => this.patchRow(dbKey, {status: 'done'}),
				error => this.patchRow(dbKey, {status: 'failed', error: error.message}),
			);

		await queue.executeSync();
		this.setState({running: false});
	};

	render() {
		return <LL_V_L id={'dialog__sync-env-from-prod'}>
			{this.renderHeader()}
			{this.renderBody()}
			{this.renderFooter()}
		</LL_V_L>;
	}

	private renderHeader = () => {
		return <LL_H_C className={'dialog__sync-env-from-prod__header'}>
			<div className={'dialog__sync-env-from-prod__header__title'}>Sync DB from Prod</div>
			<TS_Icons.x.component onClick={() => ModuleFE_Dialog.close()}/>
		</LL_H_C>;
	};

	private renderBody = () => {
		if (this.state.error)
			return <div className={'dialog__sync-env-from-prod__error'}>{this.state.error}</div>;

		if (!this.state.collections)
			return <div className={'dialog__sync-env-from-prod__loading'}>Loading collections…</div>;

		return <LL_V_L className={'dialog__sync-env-from-prod__list'}>
			{this.state.collections.map(row => this.renderRow(row))}
		</LL_V_L>;
	};

	private renderRow = (row: CollectionRow) => {
		return <LL_H_C key={row.dbKey} className={'dialog__sync-env-from-prod__row'}>
			<div className={'dialog__sync-env-from-prod__row__name'}>{row.dbKey}</div>
			<TS_Checkbox
				disabled={this.state.running}
				checked={row.wipe}
				onCheck={wipe => this.patchRow(row.dbKey, {wipe})}
			>
				Wipe
			</TS_Checkbox>
			<div className={`dialog__sync-env-from-prod__row__status status-${row.status}`}>
				{row.error ?? row.status}
			</div>
			<Button
				variant={'secondary'}
				disabled={this.state.running}
				onClick={() => this.syncCollections([row.dbKey])}
			>
				Sync
			</Button>
		</LL_H_C>;
	};

	private renderFooter = () => {
		const collections = this.state.collections;
		if (!collections?.length)
			return;

		return <LL_H_C className={'dialog__sync-env-from-prod__footer'}>
			<Button
				variant={'primary'}
				disabled={this.state.running}
				onClick={() => this.syncCollections(collections.map(row => row.dbKey))}
			>
				Sync All
			</Button>
		</LL_H_C>;
	};
}
