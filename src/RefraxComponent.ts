/**
 * Copyright (c) 2015-present, Joshua Hollenbeck
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import * as React from 'react';

// Container child interface to our parent container
// tslint:disable-next-line:interface-name
export interface RefraxContainerComponent<P = {}> extends React.Component<P> {
  isLoading(...targets: string[]): boolean;
  isPending(...targets: string[]): boolean;
  hasData(...targets: string[]): boolean;
  isStale(...targets: string[]): boolean;
}

// Base props all Refrax Container children are given
// tslint:disable-next-line:interface-name
export interface RefraxComponentProps {
  refrax: RefraxContainerComponent;
}

export type Component<P = {}, S = {}> = React.Component<P & RefraxComponentProps, S>;
export type PureComponent<P = {}, S = {}> = React.PureComponent<P & RefraxComponentProps, S>;
