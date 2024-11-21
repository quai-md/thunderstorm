import * as React from 'react';
import {ComponentSync} from '../../core/ComponentSync';
import {DB_AppConfig, DBProto_AppConfig, ModuleFE_AppConfig} from '../../_entity';
import {LL_H_C, LL_V_L} from '../../components/Layouts';
import {AppToolsScreen, TS_AppTools} from '../../components/TS_AppTools';
import {EditableDBItemV3} from '../../utils/EditableItem';
import {sortArray} from '@nu-art/ts-common';
import {_className} from '../../utils/tools';
import './ATS_AppConfigEditor.scss';
import {TS_JSONViewer} from '../../components/TS_JSONViewer/TS_JSONViewer';

type State = {
	configs: DB_AppConfig[];
	editable?: EditableDBItemV3<DBProto_AppConfig>;
}

export class ATS_AppConfigEditor
	extends ComponentSync<{}, State> {

	//######################### Static #########################

	static Screen: AppToolsScreen = {
		key: 'app-config-editor',
		renderer: this,
		name: 'App Config Editor',
		group: 'Editors',
		modulesToAwait: [ModuleFE_AppConfig],
	};

	//######################### Life Cycle #########################

	protected deriveStateFromProps(nextProps: {}, state: State) {
		const allConfigs = ModuleFE_AppConfig.cache.allMutable();
		state.configs = sortArray(allConfigs, config => config.key);
		state.editable ??= this.getEditableConfig(state.configs[0]);
		return state;
	}

	//######################### Logic #########################

	private getEditableConfig(config?: DB_AppConfig): EditableDBItemV3<DBProto_AppConfig> | undefined {
		if (!config)
			return;

		return new EditableDBItemV3<DBProto_AppConfig>(config, ModuleFE_AppConfig).setOnSaveCompleted(() => this.forceUpdate());
	}

	//######################### Render #########################

	render() {
		return <LL_V_L id={'ats__app-config-editor'}>
			{TS_AppTools.renderPageHeader('App Config Editor')}
			<LL_H_C className={'app-config-editor__main'}>
				{this.render_AppConfigList()}
				{this.render_Editor()}
			</LL_H_C>
		</LL_V_L>;
	}

	private render_AppConfigList = () => {
		const selectedId = this.state.editable?.item._id;
		return <LL_V_L className={'app-config-editor__config-list'}>
			{this.state.configs.map(config => {
				const className = _className('app-config-editor__config-list__config', config._id === selectedId && 'selected');
				return <div
					key={config._id}
					className={className}
					onClick={() => this.setState({editable: this.getEditableConfig(config)})}
				>{config.key}</div>;
			})}
		</LL_V_L>;
	};

	//######################### Render - Editor #########################

	private render_Editor = () => {
		const editable = this.state.editable;
		if (!editable)
			return;

		return <LL_V_L className={'app-config-editor__editor'}>
			<div className={'app-config-editor__editor__title'}>{editable.item.key}</div>
			<LL_H_C className={'app-config-editor__editor__views'}>
				<TS_JSONViewer item={editable.item}/>
				{this.render_Editor_DataEditor()}
			</LL_H_C>
		</LL_V_L>;
	};

	private render_Editor_DataEditor = () => {
		return <></>;
	};
}