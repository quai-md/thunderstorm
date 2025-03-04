import { DBProto } from '@nu-art/ts-common';
import * as React from 'react';
export type ConflictResolutionItem<Proto extends DBProto<any>> = {
    dbKey: Proto['dbKey'];
    renderer: (instance: Proto['dbType']) => React.ReactNode;
    filterMapper: (instance: Proto['dbType']) => string[];
};
