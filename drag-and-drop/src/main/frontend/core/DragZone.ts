import * as React from 'react';
import {DragContext} from './DragContext';
import {TS_Object} from '@nu-art/ts-common';
import {DragEvent, DragEventRect} from './types';

export type DragZoneProps<T extends TS_Object> = React.PropsWithChildren<{
  context: DragContext<T>;
  processor: (event: DragEvent<T>) => Promise<void>;
  id: string;
}>;

export abstract class DragZone<T extends TS_Object, RefType = any>
  extends React.Component<DragZoneProps<T>> {

  public ref: React.RefObject<RefType> = React.createRef();

  public componentDidMount() {
    this.props.context.zone.register(this);
  }

  public componentWillUnmount() {
    this.props.context.zone.unregister(this);
  }

  public getId(): string {
    return this.props.id;
  }

  public abstract getRect(): DragEventRect;

  public async onDrop(event: DragEvent<T>): Promise<void> {
    return this.props.processor(event);
  }
}