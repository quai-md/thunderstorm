import * as React from 'react';
import {ComponentSync} from '../../core/ComponentSync';
import {_className} from '../../utils/tools';
import './TS_CheckboxGroup.scss';
import {TS_Checkbox} from '../TS_Checkbox';

type CheckboxOption = {
    id: string;
    label: string;
    disabled?: boolean;
}

export type Props_CheckboxGroup = {
    id?: string;
    className?: string;
    parent: CheckboxOption;
    options: CheckboxOption[];
    selectedIds?: string[];
    onChange?: (selectedIds: string[]) => void;
};

type State_CheckboxGroup = {
    selectedIds: Set<string>;
    allSelected?: boolean;
    parent: CheckboxOption;
    options: CheckboxOption[];
    someSelected?: boolean;
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
        state.selectedIds = new Set(nextProps.selectedIds || []);
        state.allSelected = nextProps.selectedIds?.length === nextProps.options.length ?? false;
        state.options = nextProps.options;
        state.parent = nextProps.parent;
        state.className = nextProps.className;

        return state;
    }

    private onClickFather = () => {
        const { options, allSelected } = this.state;

        const selectableOptions = options.filter(option => !option.disabled);
        const newSelectedIds = allSelected ? new Set<string>() : new Set(selectableOptions.map(option => option.id));
        this.setState({ selectedIds: newSelectedIds, allSelected: !allSelected, someSelected: false });
        this.props.onChange?.([...newSelectedIds]);
    };

    private onClickCheckbox = (id: string) => {
        const { options } = this.state;
        const selectableOptions = options.filter(option => !option.disabled);

        const newSelectedIds = new Set(this.state.selectedIds);
        this.state.selectedIds.has(id) ? newSelectedIds.delete(id) : newSelectedIds.add(id);

        const allSelected = newSelectedIds.size === selectableOptions.length && options.length > 0;
        this.setState({ selectedIds: newSelectedIds, someSelected: newSelectedIds.size > 0 && newSelectedIds.size < selectableOptions.length, allSelected });
        this.props.onChange?.([...newSelectedIds]);
    };

    render() {
        const { selectedIds, someSelected, allSelected, options, parent, className } = this.state;

        return (
            <div className={_className('ts-checkbox-group', className)} id={this.props.id}>
                <div className="ts-checkbox-group__parent">
                    <TS_Checkbox
                        checked={allSelected}
                        onCheck={this.onClickFather}
                        disabled={parent.disabled}
                        className={someSelected ? 'ts-checkbox-group__partial' : undefined}>
                        {parent.label}
                    </TS_Checkbox>
                </div>
                <div className="ts-checkbox-group__children">
                    {options.map(option => (
                        <TS_Checkbox
                            key={option.id}
                            checked={selectedIds.has(option.id)}
                            disabled={option.disabled}
                            onCheck={() => this.onClickCheckbox(option.id)}
                            className={'ts-checkbox-group__child'}>
                            {option.label}
                        </TS_Checkbox>
                    ))}
                </div>
            </div>
        );
    }
}
