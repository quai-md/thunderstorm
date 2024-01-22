import * as React from 'react';
import {ComponentSync, LL_V_L, PartialProps_GenericDropDown} from '@nu-art/thunderstorm/frontend';
import {dbObjectToId} from '@nu-art/ts-common';
import {MultiSelect_Selector, StaticProps_TS_MultiSelect_V2, TS_MultiSelect_V2} from '@nu-art/thunderstorm/frontend/components/TS_MultiSelect';
import {
	DB_PermissionAccessLevel,
	DB_PermissionDomain,
	DB_PermissionGroup,
	DB_PermissionProject,
	ModuleFE_PermissionAccessLevel,
	ModuleFE_PermissionDomain,
	ModuleFE_PermissionGroup
} from '../_entity';
import {DropDown_PermissionAccessLevel} from '../../_entity/permission-access-level/frontend/ui-components';
import {DropDown_PermissionProject} from '../../_entity/permission-project/frontend/ui-components';
import {DropDown_PermissionDomain} from '../../_entity/permission-domain/frontend/ui-components';
import {DropDown_PermissionGroup} from '../../_entity/permission-group/frontend/ui-components';


type PP_GDD<T> = PartialProps_GenericDropDown<T>

type PermissionsDBTypes = {
	Project: DB_PermissionProject,
	AccessLevel: DB_PermissionAccessLevel,
	Domain: DB_PermissionDomain,
	Group: DB_PermissionGroup,
}

export const Permissions_DropDown: { [K in keyof PermissionsDBTypes]: ((props: PP_GDD<PermissionsDBTypes[K]>) => JSX.Element) } = {
	Project: DropDown_PermissionProject.selectable,
	AccessLevel: DropDown_PermissionAccessLevel.selectable,
	Domain: DropDown_PermissionDomain.selectable,
	Group: DropDown_PermissionGroup.selectable,
};

class DomainLevelRenderer
	extends ComponentSync<MultiSelect_Selector<string>, { domainId?: string }> {

	render() {
		const selectedLevels = ModuleFE_PermissionAccessLevel.cache.filter(item => this.props.existingItems.includes(item._id));
		const availableDomainsIds = ModuleFE_PermissionDomain.cache.filter(item => !selectedLevels.find(level => level.domainId === item._id)).map(dbObjectToId);
		return <LL_V_L className={'domain-level-renderer'}>
			<Permissions_DropDown.Domain
				selected={this.state.domainId}
				queryFilter={domain => availableDomainsIds.includes(domain._id)}
				onSelected={domain => this.setState({domainId: domain._id})}
				placeholder={'Domain'}
			/>
			<Permissions_DropDown.AccessLevel
				disabled={!this.state.domainId}
				queryFilter={level => this.state.domainId === level.domainId}
				selected={undefined}
				onSelected={(accessLevel) => this.props.onSelected(accessLevel._id)}
				placeholder={'Level'}
			/>
		</LL_V_L>;
	}

	protected deriveStateFromProps(nextProps: MultiSelect_Selector<string>, state: Partial<{
		domainId: string
	}> | undefined) {
		return {domainId: undefined, onSelected: nextProps.onSelected};
	}
}

class GroupRenderer
	extends ComponentSync<MultiSelect_Selector<{ groupId: string }>> {

	render() {
		return <div>
			<Permissions_DropDown.Group
				queryFilter={group => !this.props.existingItems.find(g => g.groupId === group._id)}
				selected={undefined}
				onSelected={group => this.props.onSelected({groupId: group._id})}
			/>
		</div>;
	}

	protected deriveStateFromProps(nextProps: PP_GDD<{ groupId: string }>, state?: {}) {
		return {onSelected: nextProps.onSelected};
	}
}

const MultiSelect_PermissionsAccessLevel: StaticProps_TS_MultiSelect_V2<string> = {
	itemRenderer: (accessLevelId, onDelete?: () => Promise<void>) => <>
		<div className="ts-icon__small" onClick={onDelete}>X</div>
		<span>{ModuleFE_PermissionAccessLevel.cache.unique(accessLevelId)?.name || 'not found'}</span></>,
	selectionRenderer: DomainLevelRenderer
};

const MultiSelect_PermissionsAccessLevelStam: StaticProps_TS_MultiSelect_V2<string> = {
	itemRenderer: (accessLevelId, onDelete?: () => Promise<void>) => <>
		<div className="ts-icon__small" onClick={onDelete}>X</div>
		<span>{ModuleFE_PermissionAccessLevel.cache.unique(accessLevelId)?.name || 'not found'}</span></>,
	selectionRenderer: (selector) => <Permissions_DropDown.AccessLevel
		queryFilter={item => {
			const selectedLevels = ModuleFE_PermissionAccessLevel.cache.filter(item => selector.existingItems.includes(item._id));
			const availableDomainsIds = ModuleFE_PermissionDomain.cache.filter(item => !selectedLevels.find(level => level.domainId === item._id)).map(dbObjectToId);
			return availableDomainsIds.includes(item.domainId);
		}}
		onSelected={item => selector.onSelected(item._id)}/>
};

const MultiSelect_PermissionsGroup: StaticProps_TS_MultiSelect_V2<{ groupId: string }> = {
	itemRenderer: (group, onDelete?: () => Promise<void>) => <>
		<div className="ts-icon__small" onClick={onDelete}>X</div>
		<span>{ModuleFE_PermissionGroup.cache.unique(group?.groupId)?.label || 'not found'}</span></>,
	selectionRenderer: GroupRenderer
};

export const MultiSelect = {
	AccessLevel_StamTest: TS_MultiSelect_V2.prepare(MultiSelect_PermissionsAccessLevelStam),
	AccessLevel: TS_MultiSelect_V2.prepare(MultiSelect_PermissionsAccessLevel),
	Group: TS_MultiSelect_V2.prepare(MultiSelect_PermissionsGroup),
};