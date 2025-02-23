import * as React from 'react';
import {ComponentSync} from '../../core/ComponentSync';
import {_className} from '../../utils/tools';
import './TS_CheckboxGroup.scss';
import {TS_Checkbox} from '../TS_Checkbox';
import {LL_V_L} from '../Layouts';
import {BadImplementationException} from "@nu-art/ts-common";

type CheckboxOption = {
    id: string;
    label: string;
    disabled?: boolean;
}

export type Props_CheckboxGroup = {
    parent: CheckboxOption;
    options: CheckboxOption[];
    selectedIds: Map<string, string[]>;
    onChange: (selectedIds: Map<string, string[]>) => void;
    id?: string;
    className?: string;
};

type State_CheckboxGroup = {
    selectedIds: Map<string, string[]>;
    parent: CheckboxOption;
    options: CheckboxOption[];
    allSelected: boolean;
    someSelected: boolean;
    className?: string;
};

/**
 * Checkbox Group Component
 * Handles grouped selection logic for checkboxes.
 */
export class TS_CheckboxGroup extends ComponentSync<Props_CheckboxGroup, State_CheckboxGroup> {
    constructor(p: Props_CheckboxGroup) {
        super(p);
    }

    protected deriveStateFromProps(nextProps: Props_CheckboxGroup, state: State_CheckboxGroup) {
        state.selectedIds = nextProps.selectedIds;
        state.options = nextProps.options;
        if (!state.options.length)
            throw new BadImplementationException('cannot have checkbox group without options');

        state.parent = nextProps.parent;

        const parentId = state.parent.id;
        const selectedIdsForParent = state.selectedIds.get(parentId) ?? [];

        state.allSelected = selectedIdsForParent.length === state.options.length ?? false;
        state.someSelected = !state.allSelected && selectedIdsForParent.length > 0;

        state.className = nextProps.className;

        return state;
    }

    private onClickFather = () => {
        const {options, allSelected, selectedIds, parent} = this.state;
        const selectedIdsForParent = selectedIds.get(parent.id) ?? [];

        const selectableOptions = options.filter(option => !option.disabled);
        const newSelectedIds = allSelected || selectableOptions.length === selectedIdsForParent.length ? [] : selectableOptions.map(option => option.id);
        const parentToSelectedIdsMap = new Map<string, string[]>();
        parentToSelectedIdsMap.set(parent.id, newSelectedIds);

        this.props.onChange(parentToSelectedIdsMap);
    };

    private onClickCheckbox = (childId: string, parentId: string) => {
        const newSelectedIds = new Map(this.state.selectedIds);
        const selectedIds = new Set(this.state.selectedIds.get(parentId));

        selectedIds.has(childId) ? selectedIds.delete(childId) : selectedIds.add(childId);
        newSelectedIds.set(parentId, Array.from(selectedIds));

        this.props.onChange(newSelectedIds);
    };

    render() {
        const {selectedIds, someSelected, allSelected, options, parent, className} = this.state;

        return (
            <LL_V_L className={_className('ts-checkbox-group', className)} id={this.props.id}>
                <TS_Checkbox
                    checked={allSelected}
                    className={_className('ts-checkbox-group__parent', someSelected && 'ts-checkbox-group__partial')}
                    disabled={parent.disabled}
                    onCheck={this.onClickFather}>
                    {parent.label}
                </TS_Checkbox>
                <LL_V_L className={'ts-checkbox-group__children'}>
                    {options.map(option => (
                        <TS_Checkbox
                            key={option.id}
                            checked={selectedIds.get(parent.id)?.includes(option.id)}
                            disabled={option.disabled || parent.disabled}
                            onCheck={() => this.onClickCheckbox(option.id, parent.id)}>
                            {option.label}
                        </TS_Checkbox>
                    ))}
                </LL_V_L>
            </LL_V_L>
        );
    }
}
