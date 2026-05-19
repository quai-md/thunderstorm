import {ThunderDispatcher} from '@nu-art/thunderstorm-frontend';

export interface OnWorkHubTabs {
	__onWorkHubTabsUpdated: VoidFunction;
	__onWorkHubTabSelected: VoidFunction;
}

export interface OnWorkHubTabClosed {
	__onWorkHubTabClosed: (tabId: string) => void;
}

export const dispatch_OnWorkHubTabsUpdated = new ThunderDispatcher<OnWorkHubTabs, '__onWorkHubTabsUpdated'>('__onWorkHubTabsUpdated');
export const dispatch_OnWorkHubTabSelected = new ThunderDispatcher<OnWorkHubTabs, '__onWorkHubTabSelected'>('__onWorkHubTabSelected');
export const dispatch_OnWorkHubTabClosed = new ThunderDispatcher<OnWorkHubTabClosed, '__onWorkHubTabClosed'>('__onWorkHubTabClosed');