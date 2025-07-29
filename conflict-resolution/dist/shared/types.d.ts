import * as React from 'react';
import { DBProto } from '@nu-art/ts-common';
export type ConflictResolutionItem<Proto extends DBProto<any>> = {
    dbKey: Proto['dbKey'];
    renderer: (instance: Proto['dbType']) => React.ReactNode | undefined;
    collectionRenderer: (dbKey: Proto['dbKey']) => React.ReactNode | undefined;
    filterMapper: (instance: Proto['dbType']) => string[];
};
