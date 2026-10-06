import {AIPromptType, AIPromptTypes} from '@nu-art/prompting-shared';
import {MandatoryProps_TS_DropDown, SimpleListAdapter, TS_DropDown} from '@nu-art/thunderstorm-frontend';

const mandatoryProps_AIPromptType: MandatoryProps_TS_DropDown<AIPromptType> = {
	adapter: SimpleListAdapter([...AIPromptTypes], item => <>{item.item}</>),
	placeholder: 'Select Prompt Type',
};

export const DropDown_AIPromptType = TS_DropDown.prepare(mandatoryProps_AIPromptType);