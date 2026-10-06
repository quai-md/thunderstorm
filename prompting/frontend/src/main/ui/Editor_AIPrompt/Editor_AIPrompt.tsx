import {DBProto_AIPrompt} from '@nu-art/prompting-shared';
import {EditableDBItemV3, LL_H_C, LL_V_L, TS_Input, TS_PropRenderer} from '@nu-art/thunderstorm-frontend';
import './Editor_AIPrompt.scss';
import {DropDown_AIPromptType} from '../../_enum/ai-prompt-type/ui-components.js';
import {TS_TextAreaV2} from '@nu-art/thunderstorm-frontend/components/TS_V2_TextArea/TS_TextAreaV2';
import {FC} from 'react';

const TextArea = TS_TextAreaV2.editable({
	saveEvent: ['blur'],
	resizeWithText: true,  // Auto-resize with content
	trim: true
});

type Props = {
	editable: EditableDBItemV3<DBProto_AIPrompt>;
	editMode: boolean;
};

const Render_Label: FC<Props> = (p) => {
	return <TS_PropRenderer.Horizontal label={'Label'}>
		<TS_Input
			type={'text'}
			value={p.editable.get('label')}
			onBlur={val => p.editable.updateObj({label: val})}
			disabled={!p.editMode}
		/>
	</TS_PropRenderer.Horizontal>;
};

const Render_Type: FC<Props> = (p) => {
	return <TS_PropRenderer.Horizontal label={'Type'}>
		<DropDown_AIPromptType.editable
			editable={p.editable}
			prop={'type'}
			disabled={!p.editMode}
		/>
	</TS_PropRenderer.Horizontal>;
};

const Render_Content: FC<Props> = (p) => {
	return <TS_PropRenderer.Vertical label={'Content'}>
		<TextArea
			editable={p.editable}
			prop={'content'}
			disabled={!p.editMode}
		/>
	</TS_PropRenderer.Vertical>;
};

export const Editor_AIPrompt: FC<Props> = (p) => {
	return <LL_V_L className={'e__ai-prompt'}>
		<LL_H_C className={'e__row'}>
			<Render_Label {...p}/>
			<Render_Type {...p}/>
		</LL_H_C>
		<LL_H_C className={'e__row'}>
			<Render_Content {...p}/>
		</LL_H_C>
	</LL_V_L>;
};