import {DBProto_AIPrompt} from '@nu-art/prompting-shared';
import {GenericDropDownV3, TemplatingProps_TS_GenericDropDown, TS_MultiSelect_V2} from '@nu-art/thunderstorm-frontend';
import {ModuleFE_AIPrompt} from './ModuleFE_AIPrompt.js';
import {DBItemDropDownMultiSelector} from '@nu-art/thunderstorm-frontend/components/_TS_MultiSelect/DBItemDropDownMultiSelector';
import {TS_Icons} from '@nu-art/ts-styles';

const Props_DropDown: TemplatingProps_TS_GenericDropDown<DBProto_AIPrompt> = {
	module: ModuleFE_AIPrompt,
	modules: [ModuleFE_AIPrompt],
	mapper: item => [item.label],
	placeholder: 'Choose a prompt',
	renderer: item => <>{item.label}</>
};

export const DropDown_AIPrompt = GenericDropDownV3.prepare(Props_DropDown);

const Props_MultiSelect = DBItemDropDownMultiSelector.propsV3({
	module: ModuleFE_AIPrompt,
	itemRenderer: (item, onDelete, disabled) => {
		return <>
			{!disabled && <TS_Icons.x.component onClick={onDelete}/>}
			{!item ? <>Not Found</> : <>{item.label}</>}
		</>;
	},
	uiSelector: DropDown_AIPrompt.selectable,
});

export const MultiSelect_AIPrompt = TS_MultiSelect_V2.prepare(Props_MultiSelect);