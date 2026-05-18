import {ThunderDispatcher} from '@nu-art/thunderstorm-frontend';

export interface OnWorkHubTabsUpdated {
	__onWorkHubTabsUpdated: VoidFunction;
}

export interface OnWorkHubTabSelected {
	__onWorkHubTabSelected: VoidFunction;
}

export interface OnWorkHubTabClosed {
	__onWorkHubTabClosed: (tabId: string) => void;
}

export type OnWorkHubTabs = OnWorkHubTabsUpdated & OnWorkHubTabSelected;

export const dispatch_OnWorkHubTabsUpdated = new ThunderDispatcher<OnWorkHubTabsUpdated, '__onWorkHubTabsUpdated'>('__onWorkHubTabsUpdated');
export const dispatch_OnWorkHubTabSelected = new ThunderDispatcher<OnWorkHubTabSelected, '__onWorkHubTabSelected'>('__onWorkHubTabSelected');
export const dispatch_OnWorkHubTabClosed = new ThunderDispatcher<OnWorkHubTabClosed, '__onWorkHubTabClosed'>('__onWorkHubTabClosed');
