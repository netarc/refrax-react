/**
 * Copyright (c) 2015-present, Joshua Hollenbeck
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Component as ReactComponent, SFC, ComponentClass } from 'react';
import * as React from 'react';
import {
  ActionEntity,
  RefraxParameters,
  Resource,
  Tools as RefraxTools,
  SchemaPath as RefraxSchemaPath,
  Disposable,
  CompoundDisposable,
  Constants
} from 'refrax';
import { IAction } from 'refrax/lib/actions/action';
import { SchemaPathClass } from 'refrax/lib/schema/path';

import RefraxReactShims from './RefraxReactShims';

const { invariant } = RefraxTools;

export interface IReactContainer<P = {}> extends ReactComponent<P> {
  _disposable: CompoundDisposable;
  _resources: any[];
  _actions: any[];
  _paramsUsed: object;

  isLoading(...targets: string[]): boolean;
  isPending(...targets: string[]): boolean;
  hasData(...targets: string[]): boolean;
  isStale(...targets: string[]): boolean;
}

type Collection = object | any[];
type BoolPredicate = (iteratee: any, index?: number, source?: any) => boolean;

interface IRefPoolEntry {
  action: IAction;
  srcAction: IAction;
  components: ReactComponent[];
}
const RefPool: { [s: string]: IRefPoolEntry; } = {};

function detect(collection: Collection, targets: string[], predicate: BoolPredicate) {
  return RefraxTools.any(collection, function(iteratee: any) {
    if (targets && targets.length > 0 && targets.indexOf(iteratee) === -1) {
      return false;
    }

    return predicate(iteratee);
  });
}

function renderComponent(component: ReactComponent) {
  component.setState({ lastUpdate: Date.now() });
}

function renderDispatcherFor(component: ReactComponent) {
  let timeout: NodeJS.Timer | null = null;

  return (debounced: boolean) => {
    if (debounced === true) {
      if (timeout == null) {
        timeout = setTimeout(() => {
          if (timeout != null) {
            renderComponent(component);
          }
        }, 2);
      }
    }
    else {
      clearTimeout(timeout as NodeJS.Timer);
      timeout = null;
      renderComponent(component);
    }
  };
}

function attachAccessor(container: IReactContainer, accessor: any) {
  const componentParams = () => {
    return RefraxReactShims.getComponentParams.call(container);
  };

  const resource = new Resource(accessor,
    new RefraxParameters(componentParams).weakify()
  );

  container._disposable.addDisposable(resource.on('change', () => renderComponent(container)));

  const descriptor = resource._generateDescriptor(Constants.IActionType.get);
  RefraxTools.extend(container._paramsUsed, descriptor.pathParams, descriptor.queryParams);

  return resource;
}

interface IReactAction extends IAction {
  attached?: boolean;
}

function attachAction(container: IReactContainer, action: IReactAction) {
  let refLink: string
    , refPool: IRefPoolEntry;

  if (refLink = action._options['refLink']) {
    refPool = RefPool[refLink];

    if (!refPool) {
      refPool = RefPool[refLink] = {
        srcAction: action,
        action: action.coextend(),
        components: []
      };
    }

    if (action !== refPool.srcAction) {
      throw new TypeError(
        'attachAction cannot link different actions.\n\r' +
        'found: ' + action + '\n\r' +
        'expected: ' + refPool.srcAction
      );
    }

    action = refPool.action.clone();

    refPool.components.push(container);
    container._disposable.addDisposable(new Disposable(() => {
      refPool.components.splice(refPool.components.indexOf(container), 1);
      if (refPool.components.length < 1) {
        delete RefPool[refLink];
      }
    }));
  }
  else {
    // Referencing an attached action (IE resource `default` to an attached resourced)
    if (action.attached === true) {
      action = action.clone();
    }
    else {
      action = action.coextend();
    }
    action.attached = true;
  }

  action.setParams(
    new RefraxParameters(() => {
      return RefraxReactShims.getComponentParams.call(container);
    }).weakify()
  );

  // We delay-debounce since `mutated` can often fire along-side `start`/`finish`
  const dispatchRender = renderDispatcherFor(container);
  RefraxTools.each(['start', 'finish', 'mutated'], (event: string) => {
    container._disposable.addDisposable(action.on(event, () => {
      dispatchRender(event === 'mutated');
    }));
  });

  return action;
}

function attach(this: IReactContainer, target: RefraxSchemaPath | IAction) {
  if (target instanceof SchemaPathClass) {
    const resource = attachAccessor(this, target as RefraxSchemaPath);

    this._resources.push(resource);
    return resource;
  }
  else if (target instanceof ActionEntity) {
    const action = attachAction(this, target as IAction);

    this._actions.push(action);
    return action;
  }

  throw new TypeError('RefraxContainer::attach cannot attach invalid target `' + target + '`.');
}

function isScalarAndEqual(valueA: any, valueB: any) {
  return valueA === valueB && (valueA === null || typeof valueA !== 'object');
}

function paramsEqual(lastUsedParams: { [key: string]: any }, availableParams: { [key: string]: any }) {
  let key: string;

  for (key in lastUsedParams) {
    if (!isScalarAndEqual(lastUsedParams[key], availableParams[key])) {
      return false;
    }
  }

  return true;
}

function isReactComponent(component: any) {
  return !!(
    component &&
    typeof component.prototype === 'object' &&
    component.prototype &&
    component.prototype.isReactComponent
  );
}

/*
function inherits(subClass: any, superClass: any) {
  if (typeof superClass !== 'function' && superClass !== null) {
    throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });

  if (superClass) {
    RefraxTools.setPrototypeOf(subClass, superClass);
  }
}
*/

function refraxify<P>(
  component: ComponentClass<P & IRefraxContainerChildProps>
): ComponentClass<P & IRefraxContainerChildProps> {
  class RefraxComponent extends component {
    isLoading = () => {
      return this.props.refraxContainer.isLoading();
    }

    isPending = () => {
      return this.props.refraxContainer.isPending();
    }

    hasData = () => {
      return this.props.refraxContainer.hasData();
    }

    isStale = () => {
      return this.props.refraxContainer.isStale();
    }
  }

  return RefraxComponent;
}

export interface IRefraxContainerChildProps {
  ref: string;
  refraxContainer: IReactContainer;
}

export interface IRefraxContainerState {
  lastUpdate: number | null;
  attachments: Constants.IKeyValue;
}

export type RefraxInitHook<P> = (this: IReactContainer<P>) => object;

function _createContainer<P>(
  component: ComponentClass<P> | SFC<P>,
  initHook?: RefraxInitHook<P & IRefraxContainerChildProps>
): ComponentClass {
  let componentAsClass: ComponentClass<P & IRefraxContainerChildProps>;
  let componentAsSFC: SFC<P & IRefraxContainerChildProps>;

  if (isReactComponent(component)) {
    componentAsClass = refraxify(component as ComponentClass<P & IRefraxContainerChildProps>);
  }
  else {
    componentAsSFC = component as SFC<P & IRefraxContainerChildProps>;
  }

  const componentName = (component as any).displayName || (component as any).name;
  const containerName = 'Refrax(' + componentName + ')';

  class RefraxContainer extends ReactComponent<P & {}, IRefraxContainerState> implements IReactContainer {
    mounted: boolean;
    _disposable: CompoundDisposable;
    _resources: Resource[];
    _actions: IAction[];
    _paramsUsed: {};

    constructor(props: P, context?: any) {
      super(props, context);

      this._paramsUsed = {};
      this._resources = [];
      this._actions = [];
      this._disposable = new CompoundDisposable();
      this.state = {
        lastUpdate: null,
        attachments: {}
      };
    }

    _initialize() {
      const result = initHook && initHook.call(this) || {};
      const attachments: { [key: string]: RefraxSchemaPath | IAction } = {};
      RefraxTools.each(result, (atachment: RefraxSchemaPath | IAction, key: string) => {
        attachments[key] = attach.call(this, atachment);
      });

      return {
        attachments: attachments
      };
    }

    _cleanup() {
      this._disposable.dispose();
      this._disposable = new CompoundDisposable();

      RefraxTools.each(this._resources, (resource: Resource) => {
        resource.dispose();
      });

      this._resources = [];
      this._actions = [];
    }

    componentWillMount() {
      this.setState(this._initialize());
    }

    componentWillUnmount() {
      this._cleanup();
      this.mounted = false;
    }

    componentWillReceiveProps(nextProps: object, maybeNextContext: any) {
      const availableParams = RefraxReactShims.getComponentParams.call({
        props: nextProps,
        context: maybeNextContext || this.context
      });

      // If we compare all params used by resources and detect a difference we need to re-init
      if (!paramsEqual(this._paramsUsed, availableParams)) {
        // @todo: The problem with a full cleanup and re-init is any binding done outside initHook
        // will be lost
        this._cleanup();
        this._initialize();
      }
    }

    // nextProps: object, nextState: object, nextContext: any
    shouldComponentUpdate() {
      // @todo: Do we need a prop/state check?
      return true;
    }

    render() {
      return React.createElement(componentAsClass || componentAsSFC, {
        // @ts-ignore Spread types bug - https://github.com/Microsoft/TypeScript/pull/13288
        ...this.props,
        ...this.state.attachments,
        ref: 'component',
        refraxContainer: this
      });
    }

    isLoading(...targets: string[]) {
      return detect(this._resources, targets, function(resource) {
        return resource.isLoading();
      }) || detect(this._actions, targets, function(action) {
        return action.isLoading();
      });
    }

    isPending(...targets: string[]) {
      return detect(this._actions, targets, function(action) {
        return action.isPending();
      });
    }

    hasData(...targets: string[]) {
      return !detect(this._resources, targets, function(resource) {
        return !resource.hasData();
      }) && !detect(this._actions, targets, function(action) {
        return !action.hasData();
      });
    }

    isStale(...targets: string[]) {
      return detect(this._resources, targets, function(resource) {
        return resource.isStale();
      }) || detect(this._actions, targets, function(action) {
        return action.isStale();
      });
    }
  }

  (RefraxContainer as ComponentClass).displayName = containerName;
  (RefraxContainer as ComponentClass).contextTypes = RefraxTools.extend({}, RefraxReactShims.contextTypes);

  return RefraxContainer;
}

export function createContainer<P>(element: ComponentClass<P>): ComponentClass;
export function createContainer<P>(element: SFC<P>): ComponentClass;
export function createContainer<P>(element: ComponentClass<P>, hook?: RefraxInitHook<P & IRefraxContainerChildProps>): ComponentClass;
export function createContainer<P>(element: SFC<P>, hook?: RefraxInitHook<P & IRefraxContainerChildProps>): ComponentClass;
export function createContainer<P>(element: ComponentClass<P> | SFC<P>, hook?: RefraxInitHook<P & IRefraxContainerChildProps>): ComponentClass {
  invariant(isReactComponent(element),
    `invalid argument; expected React Component or Pure Render Function but found \`${element}\``
  );

  return _createContainer(element, hook);
}
