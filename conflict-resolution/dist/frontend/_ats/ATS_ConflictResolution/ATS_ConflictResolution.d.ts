import * as React from 'react';
import './ATS_ConflictResolution.scss';
import { AppToolsScreen, ComponentSync, ModuleFE_BaseApi } from '@nu-art/thunderstorm/frontend';
type State = {
    upgradableModules: ModuleFE_BaseApi<any, any>[];
    selectedModule?: ModuleFE_BaseApi<any>;
    itemId?: string;
};
export declare class ATS_ConflictResolution extends ComponentSync<{}, State> {
    static screen: AppToolsScreen;
    protected deriveStateFromProps(nextProps: {}, state: State): State;
    private getAdapter;
    private checkUsage;
    render(): React.JSX.Element;
}
export {};
