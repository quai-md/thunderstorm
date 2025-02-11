import * as React from 'react';
import { ComponentSync } from '../../core/ComponentSync';
import { _className } from '../../utils/tools';
import './TS_CheckboxGroup.scss';
import { TS_Checkbox } from '../TS_Checkbox';

export type Props_CheckboxGroup = {
    id?: string;
    className?: string;
    parent: { id: string; label: string };
    options: { id: string; label: string }[];
    selectedIds?: string[];
    onChange?: (selectedIds: string[]) => void;
};

type State_CheckboxGroup = {
    selectedIds: Set<string>;
};

/**
 * Checkbox Group Component
 * Handles grouped selection logic for checkboxes.
 */
export class TS_CheckboxGroup extends ComponentSync<Props_CheckboxGroup, State_CheckboxGroup> {
    constructor(p: Props_CheckboxGroup) {
        super(p);
        this.state = {
            selectedIds: new Set(p.selectedIds || []),
        };
    }

    protected deriveStateFromProps(nextProps: Props_CheckboxGroup, state: State_CheckboxGroup) {
        state.selectedIds = new Set(nextProps.selectedIds || []);
        return state;
    }

    private onClickFather = () => {
        const allSelected = this.state.selectedIds.size === this.props.options.length;
        const newSelectedIds = allSelected ? new Set<string>() : new Set(this.props.options.map(opt => opt.id));
        this.setState({ selectedIds: newSelectedIds });
        this.props.onChange?.([...newSelectedIds]);
    };

    private toggleItem = (id: string) => {
        const newSelectedIds = new Set(this.state.selectedIds);
        newSelectedIds.has(id) ? newSelectedIds.delete(id) : newSelectedIds.add(id);
        this.setState({ selectedIds: newSelectedIds });
        this.props.onChange?.([...newSelectedIds]);
    };

    render() {
        const { id, className, parent, options } = this.props;
        const allSelected = this.state.selectedIds.size === options.length;
        const someSelected = this.state.selectedIds.size > 0 && !allSelected;

        return (
            <div className={_className('ts-checkbox-group', className)} id={id}>
                <div className="ts-checkbox-group__parent">
                    <TS_Checkbox
                        checked={allSelected}
                        onCheck={() => this.onClickFather()}
                        className={someSelected ? 'ts-checkbox-group__indeterminate' : ''}>
                        {parent.label}
                    </TS_Checkbox>
                </div>
                <div className="ts-checkbox-group__children">
                    {options.map(option => (
                        <TS_Checkbox
                            key={option.id}
                            checked={this.state.selectedIds.has(option.id)}
                            onCheck={() => this.toggleItem(option.id)}
                            className="ts-checkbox-group__child">
                            {option.label}
                        </TS_Checkbox>
                    ))}
                </div>
            </div>
        );
    }
}
