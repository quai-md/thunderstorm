import {FC, MouseEvent} from 'react';
import './Component_WorkHub_Tab.scss';
import {_className, LL_H_C, openContent} from '@nu-art/thunderstorm-frontend';
import {exists} from '@nu-art/ts-common';
import {WorkHubTab} from '@nu-art/work-hub-shared';
import {ModuleFE_WorkHub} from '../../../../_module/index.js';

type Props = {
	tab: WorkHubTab;
	selected: boolean;
}

const onTabMouseDown = (e: MouseEvent<HTMLDivElement>, tabId: string) => {
	if (e.button !== 1) //Only take into account middle mouse button
		return;

	e.stopPropagation();
	ModuleFE_WorkHub.tabs.remove(tabId);
};

const onTabClick = (e: MouseEvent<HTMLDivElement>, tabId: string) => {
	e.stopPropagation();
	ModuleFE_WorkHub.tabs.select(tabId);
};

const onTabRightClick = (e: MouseEvent<HTMLDivElement>, tab: WorkHubTab) => {
	const workHubItem = ModuleFE_WorkHub.workHubItem.getByKey(tab.itemKey);
	if (!workHubItem)
		return;

	workHubItem.openTabMenu(e, tab);
};

export const Component_WorkHub_Tab: FC<Props> = (props) => {
	const className = _className('c__work-hub-tab', props.selected && 'selected');
	const editMode = props.tab.renderArgs?.editMode === true;
	return <LL_H_C
		className={className}
		data-edit-mode={editMode ? 'true' : undefined}
		onMouseUp={e => onTabMouseDown(e, props.tab.id)}
		onClick={e => onTabClick(e, props.tab.id)}
		onContextMenu={e => onTabRightClick(e, props.tab)}
	>
		{exists(props.tab.tag) && <div
			className={'c__work-hub-tab__tag'}
			{...openContent.tooltip.bottom('work-hub-tab-tooltip', () => {
				const item = ModuleFE_WorkHub.workHubItem.getByKey(props.tab.itemKey);
				const tooltip = item?.getTabTooltip();
				const resolved = typeof tooltip === 'function' ? tooltip() : tooltip;
				return <>{resolved ?? props.tab.label}</>;
			}, {offset: 5})}
		>{props.tab.tag}</div>}
		{props.tab.label}
	</LL_H_C>;
};