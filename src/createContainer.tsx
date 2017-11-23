/**
 * Copyright (c) 2015-present, Joshua Hollenbeck
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  Component as ReactComponent,
  ComponentClass,
  createElement,
  SFC
} from 'react';
import {
  ActionEntity,
  CompoundDisposable,
  Constants,
  Disposable,
  IAction,
  RefraxParameters,
  Resource,
  SchemaPath,
  SchemaPathClass,
  Tools as RefraxTools
} from 'refrax';

import {
  RefraxComponentProps,
  RefraxContainerComponent
} from './RefraxComponent';
import RefraxReactShims from './RefraxReactShims';

const invariant = RefraxTools.invariant;

export interface IRefraxInitResult {
  [key: string]: SchemaPath | IAction;
}

export type RefraxInitHook<P> = (this: RefraxContainerComponent<P>) => IRefraxInitResult;

// Internal interface of our RefraxContainerComponent
interface IRefraxContainerComponent extends RefraxContainerComponent {
  _mounted: boolean;
  _disposable: CompoundDisposable;
  _resources: any[];
  _actions: any[];
  _paramsUsed: object;
}

type Collection = object | any[];
type BoolPredicate = (iteratee: any, index?: number, source?: any) => boolean;

interface IRefPoolEntry {
  action: IAction;
  srcAction: IAction;
  components: ReactComponent[];
}
const RefPool: { [s: string]: IRefPoolEntry } = {};

const detect = (collection: Collection, targets: string[], predicate: BoolPredicate) =>
  RefraxTools.any(collection, (iteratee: any) => {
    if (targets && targets.length > 0 && targets.indexOf(iteratee) === -1) {
      return false;
    }

    return predicate(iteratee);
  });

const renderComponent = (component: IRefraxContainerComponent) => {
  if (component._mounted) {
    component.setState({ lastUpdate: Date.now() });
  }
};

const delayRenderDebounceTime = 2;
const renderDispatcherFor = (component: IRefraxContainerComponent) => {
  let timeout: NodeJS.Timer | null = null;

  return (debounced: boolean) => {
    if (debounced === true) {
      if (timeout == null) {
        timeout = setTimeout(() => {
          if (timeout != null) {
            renderComponent(component);
          }
        }, delayRenderDebounceTime);
      }
    }
    else {
      clearTimeout(timeout as NodeJS.Timer);
      timeout = null;
      renderComponent(component);
    }
  };
};

const attachAccessor = (container: IRefraxContainerComponent, accessor: any) => {
  const componentParams = () =>
    RefraxReactShims.getComponentParams.call(container);

  const resource = new Resource(accessor,
    new RefraxParameters(componentParams).weakify()
  );

  container._disposable.addDisposable(resource.on('change', () => renderComponent(container)));

  const descriptor = resource._generateDescriptor(Constants.IActionType.get);
  RefraxTools.extend(container._paramsUsed, descriptor.pathParams, descriptor.queryParams);

  return resource;
};

interface IReactAction extends IAction {
  attached?: boolean;
}

const attachAction = (container: IRefraxContainerComponent, action: IReactAction) => {
  let refLink: string;
  let refPool: IRefPoolEntry;

  if (refLink = action._options.refLink) {
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
        `attachAction cannot link different actions.\n\rfound: ${action}\n\rexpected: ${refPool.srcAction}`
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
    action = action.attached === true ? action.clone() : action.coextend();
    action.attached = true;
  }

  action.setParams(
    new RefraxParameters(() => RefraxReactShims.getComponentParams.call(container)).weakify()
  );

  // We delay-debounce since `mutated` can often fire along-side `start`/`finish`
  const dispatchRender = renderDispatcherFor(container);
  RefraxTools.each(['start', 'finish', 'mutated'], (event: string) => {
    container._disposable.addDisposable(action.on(event, () => {
      dispatchRender(event === 'mutated');
    }));
  });

  return action;
};

function attach(this: IRefraxContainerComponent, target: SchemaPath | IAction): Resource | IAction | void {
  if (target instanceof SchemaPathClass) {
    const resource = attachAccessor(this, target as SchemaPath);

    this._resources.push(resource);

    return resource;
  }
  else if (target instanceof ActionEntity) {
    const action = attachAction(this, target as IAction);

    this._actions.push(action);

    return action;
  }

  invariant(false, `RefraxContainer::attach cannot attach invalid target \`${target}\`.`);
}

const isScalarAndEqual = (valueA: any, valueB: any) =>
  valueA === valueB && (valueA === null || typeof valueA !== 'object');

const paramsEqual = (lastUsedParams: { [key: string]: any }, availableParams: { [key: string]: any }) => {
  let key: string;

  for (key in lastUsedParams) {
    if (!isScalarAndEqual(lastUsedParams[key], availableParams[key])) {
      return false;
    }
  }

  return true;
};

const isReactComponent = (component: any) =>
  Boolean(
    component &&
    typeof component.prototype === 'object' &&
    component.prototype &&
    component.prototype.isReactComponent
  );

const refraxify = <P extends {}>(
  component: ComponentClass<P & RefraxComponentProps>
): ComponentClass<P & RefraxComponentProps> => {
  class RefraxComponent extends component {
    isLoading = () =>
      this.props.refrax.isLoading()

    isPending = () =>
      this.props.refrax.isPending()

    hasData = () =>
      this.props.refrax.hasData()

    isStale = () =>
      this.props.refrax.isStale()
  }

  return RefraxComponent;
};

export interface IRefraxContainerComponentState {
  lastUpdate: number | null;
  attachments: Constants.IKeyValue;
}

const _createContainer = <P extends {}>(
  component: ComponentClass<P> | SFC<P>,
  initHook?: RefraxInitHook<P & RefraxComponentProps>
): ComponentClass<P> => {
  let componentAsClass: ComponentClass<P & RefraxComponentProps>;
  let componentAsSFC: SFC<P & RefraxComponentProps>;

  if (isReactComponent(component)) {
    componentAsClass = refraxify(component as ComponentClass<P & RefraxComponentProps>);
  }
  else {
    componentAsSFC = component as SFC<P & RefraxComponentProps>;
  }

  const componentName = (component as any).displayName || (component as any).name;
  const containerName = `Refrax(${componentName})`;

  class RefraxContainer extends ReactComponent<P, IRefraxContainerComponentState> implements IRefraxContainerComponent {
    _mounted: boolean;
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

    componentWillMount(): void {
      this._mounted = true;
      this.setState(this.initialize());
    }

    componentWillUnmount(): void {
      this.cleanup();
      this._mounted = false;
    }

    componentWillReceiveProps(nextProps: object, maybeNextContext: any): void {
      const availableParams = RefraxReactShims.getComponentParams.call({
        props: nextProps,
        context: maybeNextContext || this.context
      });

      // If we compare all params used by resources and detect a difference we need to re-init
      if (!paramsEqual(this._paramsUsed, availableParams)) {
        // @todo: The problem with a full cleanup and re-init is any binding done outside initHook
        // will be lost
        this.cleanup();
        this.initialize();
      }
    }

    // nextProps: object, nextState: object, nextContext: any
    shouldComponentUpdate(): boolean {
      // @todo: Do we need a prop/state check?
      return true;
    }

    render(): React.ReactElement<any> {
      return createElement(componentAsClass || componentAsSFC, {
        // @ts-ignore Spread types bug - https://github.com/Microsoft/TypeScript/pull/13288
        ...this.props,
        ...this.state.attachments,
        ref: 'component',
        refrax: this
      });
    }

    isLoading(...targets: string[]): boolean {
      return detect(this._resources, targets, (resource) => resource.isLoading()) ||
        detect(this._actions, targets, (action) => action.isLoading());
    }

    isPending(...targets: string[]): boolean {
      return detect(this._actions, targets, (action) => action.isPending());
    }

    hasData(...targets: string[]): boolean {
      return !detect(this._resources, targets, (resource) => !resource.hasData()) &&
        !detect(this._actions, targets, (action) => !action.hasData());
    }

    isStale(...targets: string[]): boolean {
      return detect(this._resources, targets, (resource) => resource.isStale()) ||
        detect(this._actions, targets, (action) => action.isStale());
    }

    private initialize(): { attachments: Constants.IKeyValue } {
      const result = initHook && initHook.call(this) || {};
      const attachments: { [key: string]: SchemaPath | IAction } = {};
      RefraxTools.each(result, (atachment: SchemaPath | IAction, key: string) => {
        attachments[key] = attach.call(this, atachment);
      });

      return {
        attachments
      };
    }

    private cleanup(): void {
      this._disposable.dispose();
      this._disposable = new CompoundDisposable();

      RefraxTools.each(this._resources, (resource: Resource) => {
        resource.dispose();
      });

      this._resources = [];
      this._actions = [];
    }
  }

  (RefraxContainer as ComponentClass).displayName = containerName;
  (RefraxContainer as ComponentClass).contextTypes = RefraxTools.extend({}, RefraxReactShims.contextTypes);

  return RefraxContainer;
};

// tslint:disable: only-arrow-functions max-line-length

export function createContainer<P>(element: ComponentClass<P>): ComponentClass<P>;
export function createContainer<P>(element: SFC<P>): ComponentClass<P>;
export function createContainer<P>(element: ComponentClass<P>, hook?: RefraxInitHook<P & RefraxComponentProps>): ComponentClass<P>;
export function createContainer<P>(element: SFC<P>, hook?: RefraxInitHook<P & RefraxComponentProps>): ComponentClass<P>;
export function createContainer<P>(element: ComponentClass<P> | SFC<P>, hook?: RefraxInitHook<P & RefraxComponentProps>): ComponentClass<P> {
  invariant(isReactComponent(element),
    `invalid argument; expected React Component or Pure Render Function but found \`${element}\``
  );

  return _createContainer(element, hook);
}
