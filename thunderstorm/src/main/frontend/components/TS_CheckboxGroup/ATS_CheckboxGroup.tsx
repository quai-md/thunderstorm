import {thunderstormATSGroups} from '../../consts';
import {ComponentSync} from '../../core/ComponentSync';
import {LL_V_L} from '../Layouts';
import {AppToolsScreen, TS_AppTools} from '../TS_AppTools';
import * as React from 'react';
import './ATS_CheckboxGroup.scss';
import  {TS_CheckboxGroup} from "./TS_CheckboxGroup";

type Props = {};

type State = {};

export class ATS_CheckboxGroup
    extends ComponentSync<Props, State> {

    static Screen: AppToolsScreen = {
        key: 'ats-ts-checkbox-group',
        name: 'CheckboxGroup',
        group: thunderstormATSGroups,
        renderer: this,
    };

    //######################### Render #########################

    render() {
        return <LL_V_L id={'ats__checkboxGroup'}>
            {TS_AppTools.renderPageHeader('Checkbox Group')}
            {this.render_CheckboxGroup()}
            {this.render_PartialDisabledCheckboxGroup()}
        </LL_V_L>;
    }

    private render_CheckboxGroup = () => {
        const options = [
            {
                id: '1',
                label: 'first',
            },
            {
                id: '2',
                label: 'second',
            },
            {
                id: '3',
                label: 'third',
            }];

        return <TS_CheckboxGroup parent={{id: 'father', label: 'all'}} options={options} />;
    };

    private render_PartialDisabledCheckboxGroup = () => {
        const options = [
            {
                id: '1',
                label: 'Disabled',
                disabled: true,
            },
            {
                id: '2',
                label: 'second',
            },
            {
                id: '3',
                label: 'another',
                disabled: true,
            }];

        return <TS_CheckboxGroup parent={{id: 'father', label: 'All'}} options={options} />;
    };
}