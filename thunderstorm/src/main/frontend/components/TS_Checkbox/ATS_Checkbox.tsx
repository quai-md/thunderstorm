import {thunderstormATSGroups} from '../../consts';
import {ComponentSync} from '../../core/ComponentSync';
import {LL_V_L} from '../Layouts';
import {AppToolsScreen, TS_AppTools} from '../TS_AppTools';
import * as React from 'react';
import './ATS_Checkbox.scss';
import {TS_Checkbox} from "./TS_Checkbox";

type Props = {};

type State = {
    isChecked: boolean,
    isCheckRounded: boolean,
};

export class ATS_Checkbox
    extends ComponentSync<Props, State> {

    static Screen: AppToolsScreen = {
        key: 'ats-ts-checkbox',
        name: 'Checkbox',
        group: thunderstormATSGroups,
        renderer: this,
    };

    protected deriveStateFromProps(nextProps: Props, state: State) {
        state.isChecked ??= false;
        state.isCheckRounded ??= false;

        return state;
    }

    //######################### Logic #########################
    private onChangeCheckbox = () => {
        this.setState({isChecked: !this.state.isChecked});
    }

    private onChangeRoundedCheckbox = () => {
        this.setState({isCheckRounded: !this.state.isCheckRounded});
    }

    //######################### Render #########################

    render() {
        return <LL_V_L id={'ats__checkbox'}>
            {TS_AppTools.renderPageHeader('Checkbox')}
            {this.render_Checkbox()}
            {this.render_DisabledUncheckedCheckbox()}
            {this.render_DisabledCheckedCheckbox()}
            {this.render_RoundedCheckbox()}
        </LL_V_L>;
    }

    private render_Checkbox = () => {
        return <TS_Checkbox checked={this.state.isChecked} onCheck={this.onChangeCheckbox}>Regular checkbox</TS_Checkbox>;
    };

    private render_RoundedCheckbox = () => {
        return <TS_Checkbox checked={this.state.isCheckRounded} onCheck={this.onChangeRoundedCheckbox} rounded>Roundedcheckbox</TS_Checkbox>;
    };

    private render_DisabledUncheckedCheckbox = () => {
        return <TS_Checkbox checked={false} disabled>Unchecked Disabled</TS_Checkbox>;
    };

    private render_DisabledCheckedCheckbox = () => {
        return <TS_Checkbox checked disabled>Checked Disabled</TS_Checkbox>;
    };
}