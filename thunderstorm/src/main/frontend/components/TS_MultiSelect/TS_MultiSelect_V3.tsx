import * as React from 'react';
import {Component, ReactNode} from 'react';
import {MUSTNeverHappenException, SubsetKeys} from '@nu-art/ts-common';
import './TS_MultiSelect.scss';
import {EditableItem} from '../../utils/EditableItem';
import {LL_H_C, LL_V_L} from '../Layouts';
import {_className} from '../../utils/tools';


type Binder_MultiSelect<EnclosingItem, K extends keyof EnclosingItem, ExpectedType> = EnclosingItem[K] extends ExpectedType[]
	? {
		EnclosingItem: EnclosingItem,
		Prop: K,
		InnerType: ExpectedType
	}
	: never

export type DynamicProps_TS_MultiSelect_V2<EnclosingItem, Prop extends keyof EnclosingItem> = {
	editable: EditableItem<EnclosingItem>,
	prop: Prop
}

export type StaticProps_TS_MultiSelect_V2<ItemType> = {
	className?: string
	itemsDirection?: 'vertical' | 'horizontal';
	// mandatory
	itemRenderer: (item?: ItemType, onDelete?: () => Promise<void>) => ReactNode
	selectionRenderer: React.ComponentType<MultiSelect_Selector<ItemType>>,
}

export type Props_TS_MultiSelect_V2<Binder extends Binder_MultiSelect<any, any, any>> =
	StaticProps_TS_MultiSelect_V2<Binder['InnerType']>
	& DynamicProps_TS_MultiSelect_V2<Binder['EnclosingItem'], Binder['Prop']>

export type MultiSelect_Selector<ItemType> = {
	className: string
	existingItems: ItemType[],
	onSelected: (selected: ItemType) => void | Promise<void>,
};

export class TS_MultiSelect_V3<Binder extends Binder_MultiSelect<any, any, any>>
	extends Component<Props_TS_MultiSelect_V2<Binder>, any> {
	static prepare<EnclosingItem, K extends keyof EnclosingItem, InnerType>(_props: StaticProps_TS_MultiSelect_V2<InnerType>) {
		return <EnclosingItem, Prop extends SubsetKeys<keyof EnclosingItem, EnclosingItem, InnerType[] | undefined>>(props: DynamicProps_TS_MultiSelect_V2<EnclosingItem, Prop> & Partial<StaticProps_TS_MultiSelect_V2<InnerType>>) =>
			<TS_MultiSelect_V3<Binder_MultiSelect<EnclosingItem, Prop, InnerType>>
				{..._props}
				{...props}
			/>;
	}

	render() {
		const editable = this.props.editable;
		const prop = this.props.prop;

		const existingItems = (editable.item[prop] || (editable.item[prop] = [])) as Binder['InnerType'][];
		const editableProp = editable.editProp(prop, []);

		const addInnerItem = async (item: Binder['InnerType']) => {
			await editableProp.updateArrayAt(item);
			this.forceUpdate()
		};

		const props = this.props;
		const SelectionRenderer = props.selectionRenderer;
		const direction = this.props.itemsDirection ?? 'horizontal';

		const Wrapper = direction === 'horizontal' ? LL_H_C : LL_V_L;

		return <Wrapper className={_className('ts-multi-select__list', this.props.className)}>
			{existingItems.map((item, i) => {
				return <LL_H_C className="ts-multi-select__list-value" key={i}>
					{props.itemRenderer(item, async () => {
						const indexToRemove = existingItems.indexOf(item);

						if (indexToRemove !== -1) {
							await editableProp.removeArrayItem(indexToRemove);
							this.forceUpdate()
						} else
							throw new MUSTNeverHappenException(`item ${item} wasn't in existing items`);

					})}
				</LL_H_C>;
			})}

			<SelectionRenderer
				className={'ts-multi-select__selector'}
				onSelected={addInnerItem}
				existingItems={existingItems}
			/>
		</Wrapper>;
	}
}


