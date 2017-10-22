/**
 * Copyright (c) 2015-present, Joshua Hollenbeck
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import * as React from 'react';
import { spy, SinonSpy } from 'sinon';
import { expect } from 'chai';

import {
  mock_reset,
  mock_get,
  mock_post,
  mock_put,
  mount,
  mount_cleanup,
  delay_for,
  delay_for_action,
  delay_for_resource_request
} from 'test/TestSupport';

import {
  ActionEntity as RefraxActionEntity,
  Resource as RefraxResource,
  Tools as RefraxTools,
  Schema,
  Constants as RefraxConstants,
  createSchemaCollection,
  createAction,
  createSchema,
  CompoundDisposable
} from 'refrax';
import { createContainer, IReactContainer } from '../createContainer';

let schema: Schema;

const dataElement1 = { id: 1, name: 'foo bob' };
const dataElement2 = { id: 2, name: 'foo baz' };
const dataElement3 = { id: 3, name: 'foo zoo' };
const dataElement4 = { id: 3, name: 'john doe' };
const dataCollectionUsers1 = [
  dataElement1,
  dataElement2
];
const dataCollectionUsers2 = [
  dataElement1,
  dataElement3
];

const actionCreateUser = createAction(function(data) {
  return this
    .mutableFrom(schema.users)
    .create(data);
});

const actionUpdateUser = createAction(function(data) {
  return this
    .mutableFrom(schema.users.user)
    .update(data);
});

class TestComponent extends React.Component<{ refrax: object }> {
  _renderPasses: RefraxConstants.IKeyValue[];

  // Place holders so we can spy into them
  componentWillMount() {
    this._renderPasses = [];
  }
  componentWillReceiveProps() {}

  render() {
    const pass: RefraxConstants.IKeyValue = {};
    RefraxTools.each(this.props, (prop, key) => {
      if (prop instanceof RefraxResource) {
        pass[key] = {
          data: JSON.parse(JSON.stringify(prop.data || null)),
          status: prop.status,
          timestamp: prop.timestamp
        };
      }
    });
    this._renderPasses.push(pass);

    return React.createElement('div', undefined, 'TestComponent');
  }
}

const TestComponentContainer = createContainer(TestComponent, function() {
  return this.props.refrax || {};
});

describe('RefraxContainer', function() {
  let spyTCC_componentWillMount: SinonSpy;
  let spyTCC_render: SinonSpy;
  let spyTC_componentWillMount: SinonSpy;
  let spyTC_componentWillReceiveProps: SinonSpy;
  let spyTC_render: SinonSpy;

  const resetSpies = () => {
    spyTCC_componentWillMount.reset();
    spyTCC_render.reset();
    spyTC_componentWillMount.reset();
    spyTC_componentWillReceiveProps.reset();
    spyTC_render.reset();
  };

  beforeEach(() => {
    mock_reset();

    spyTCC_componentWillMount = spy(TestComponentContainer.prototype, 'componentWillMount');
    spyTCC_render = spy(TestComponentContainer.prototype, 'render');
    spyTC_componentWillMount = spy(TestComponent.prototype, 'componentWillMount');
    spyTC_componentWillReceiveProps = spy(TestComponent.prototype, 'componentWillReceiveProps');
    spyTC_render = spy(TestComponent.prototype, 'render');

    schema = createSchema();
    schema.addLeaf(createSchemaCollection('users'));

    mock_get('/users', dataCollectionUsers1);
    mock_get('/users/1', dataElement1);
    mock_get('/users/2', dataElement2);
    mock_get('/users/3', dataElement3);
  });

  afterEach(() => {
    spyTCC_componentWillMount.restore();
    spyTCC_render.restore();
    spyTC_componentWillMount.restore();
    spyTC_componentWillReceiveProps.restore();
    spyTC_render.restore();

    mount_cleanup();
  });

  describe('wrapping a component', () => {
    it('should look correctly wrapped', () => {
      const wrapper = mount(React.createElement(TestComponentContainer, {}, null));

      expect(wrapper.instance())
        .to.have.property('_disposable')
          .that.is.an.instanceof(CompoundDisposable);
      expect(wrapper.instance())
        .to.have.property('_resources')
          .that.is.a('array');
      expect(wrapper.instance())
        .to.have.property('_actions')
          .that.is.a('array');
      expect(wrapper.instance())
        .to.have.property('_paramsUsed')
          .that.is.a('object');
      expect(wrapper.instance().refs)
        .to.have.property('component')
          .that.is.an.instanceof(TestComponent);

      // refraxify superclass
      expect(wrapper.instance().refs.component)
        .to.have.property('isLoading')
          .that.is.a('function');
      expect(wrapper.instance().refs.component)
        .to.have.property('isPending')
          .that.is.a('function');
      expect(wrapper.instance().refs.component)
        .to.have.property('hasData')
          .that.is.a('function');
      expect(wrapper.instance().refs.component)
        .to.have.property('isStale')
          .that.is.a('function');
    });
  });

  describe('when attaching a Resource', () => {
    it('should correctly attach and propagate events', () => {
      const onLoad = spy();
      const onChange = spy();
      const wrapper = mount(React.createElement(TestComponentContainer, {
        refrax: {
          users: schema.users
        }
      } as object, null));
      const wrapperIC_Container = wrapper.instance().refs.component as IReactContainer;
      const wrapperIC_Component = wrapper.instance().refs.component as TestComponent;

      expect(wrapper.instance().state.attachments)
        .to.have.all.keys([
          'users'
        ])
        .to.deep.match({
          users: RefraxResource
        });

      const usersAttachment = wrapper.instance().state.attachments.users;
      usersAttachment.on('load', onLoad);
      usersAttachment.on('change', onChange);

      expect(spyTCC_componentWillMount.callCount).to.equal(1);
      expect(spyTCC_render.callCount).to.equal(1);
      expect(spyTC_componentWillMount.callCount).to.equal(1);
      expect(spyTC_componentWillReceiveProps.callCount).to.equal(0);
      expect(spyTC_render.callCount).to.equal(1);
      expect(onLoad.callCount).to.equal(0);
      expect(onChange.callCount).to.equal(0);

      // Wrapped component has correct resource state during render
      expect(wrapperIC_Component._renderPasses[0]).to.deep.equal({
        users: {
          data: null,
          status: RefraxConstants.IStatus.stale,
          timestamp: RefraxConstants.ITimestamp.loading
        }
      });
      expect(wrapperIC_Container.isLoading()).to.equal(true);
      expect(wrapperIC_Container.isStale()).to.equal(true);
      expect(wrapperIC_Container.hasData()).to.equal(false);

      resetSpies();

      return delay_for_resource_request(usersAttachment)()
        .then(() => {
          expect(spyTCC_componentWillMount.callCount).to.equal(0);
          expect(spyTCC_render.callCount).to.equal(1);
          expect(spyTC_componentWillMount.callCount).to.equal(0);
          expect(spyTC_componentWillReceiveProps.callCount).to.equal(1);
          expect(spyTC_render.callCount).to.equal(1);
          expect(onLoad.callCount).to.equal(1);
          expect(onChange.callCount).to.equal(1);

          // Wrapped component has correct resource state during render
          expect(wrapperIC_Component._renderPasses[1]).to.deep.match({
            users: {
              data: dataCollectionUsers1,
              status: RefraxConstants.IStatus.complete,
              timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
            }
          });
          expect(wrapperIC_Container.isLoading()).to.equal(false);
          expect(wrapperIC_Container.isStale()).to.equal(false);
          expect(wrapperIC_Container.hasData()).to.equal(true);

          resetSpies();
        })
        .then(delay_for())
        .then(() => {
          // Ensure we don't have any further erroneous propagations
          expect(spyTCC_componentWillMount.callCount).to.equal(0);
          expect(spyTCC_render.callCount).to.equal(0);
          expect(spyTC_componentWillMount.callCount).to.equal(0);
          expect(spyTC_componentWillReceiveProps.callCount).to.equal(0);
          expect(spyTC_render.callCount).to.equal(0);
          expect(onLoad.callCount).to.equal(1);
          expect(onChange.callCount).to.equal(1);
        });
    });

    it('should correctly use parameters from component', () => {
      const wrapper = mount(React.createElement(TestComponentContainer, {
        userId: 1,
        refrax: {
          user: schema.users.user
        }
      } as object, null));
      const wrapperIC_Component = wrapper.instance().refs.component as TestComponent;

      const userAttachment = wrapper.instance().state.attachments.user;
      return delay_for_resource_request(userAttachment)()
        .then(() => {
          // Wrapped component has correct resource state during render
          expect(wrapperIC_Component._renderPasses[1]).to.deep.match({
            user: {
              data: dataElement1,
              status: RefraxConstants.IStatus.complete,
              timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
            }
          });
        });
    });

    it('should correctly use parameters from schema path', () => {
      const wrapper = mount(React.createElement(TestComponentContainer, {
        refrax: {
          user: schema.users.user.withParams({ userId: 2 })
        }
      } as object, null));
      const wrapperIC_Component = wrapper.instance().refs.component as TestComponent;

      const userAttachment = wrapper.instance().state.attachments.user;
      return delay_for_resource_request(userAttachment)()
        .then(() => {
          // Wrapped component has correct resource state during render
          expect(wrapperIC_Component._renderPasses[1]).to.deep.match({
            user: {
              data: dataElement2,
              status: RefraxConstants.IStatus.complete,
              timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
            }
          });
        });
    });

    it('should correctly use parameters when supplied from both', () => {
      const wrapper = mount(React.createElement(TestComponentContainer, {
        userId: 1,
        refrax: {
          user: schema.users.user.withParams({ userId: 2 })
        }
      } as object, null));
      const wrapperIC_Component = wrapper.instance().refs.component as TestComponent;

      const userAttachment = wrapper.instance().state.attachments.user;
      return delay_for_resource_request(userAttachment)()
        .then(() => {
          // Wrapped component has correct resource state during render
          expect(wrapperIC_Component._renderPasses[1]).to.deep.match({
            user: {
              data: dataElement2,
              status: RefraxConstants.IStatus.complete,
              timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
            }
          });
        });
    });

    it('should update and propagate properly when invalidated externally', () => {
      const onLoad = spy();
      const onChange = spy();
      const storeUsers = schema.__node.definition.storeMap.getOrCreate('user');
      const wrapper = mount(React.createElement(TestComponentContainer, {
        refrax: {
          users: schema.users
        }
      } as object, null));
      const wrapperIC_Component = wrapper.instance().refs.component as TestComponent;
      const wrapperIC_Container = wrapper.instance().refs.component as IReactContainer;

      expect(wrapper.instance().state.attachments)
        .to.have.all.keys([
          'users'
        ])
        .to.deep.match({
          users: RefraxResource
        });

      const usersAttachment = wrapper.instance().state.attachments.users;
      usersAttachment.on('load', onLoad);
      usersAttachment.on('change', onChange);

      expect(spyTCC_render.callCount).to.equal(1);
      expect(spyTC_componentWillReceiveProps.callCount).to.equal(0);
      expect(spyTC_render.callCount).to.equal(1);
      expect(onLoad.callCount).to.equal(0);
      expect(onChange.callCount).to.equal(0);

      resetSpies();

      return delay_for_resource_request(usersAttachment)()
        .then(() => {
          expect(spyTCC_render.callCount).to.equal(1);
          expect(spyTC_componentWillReceiveProps.callCount).to.equal(1);
          expect(spyTC_render.callCount).to.equal(1);
          expect(onLoad.callCount).to.equal(1);
          expect(onChange.callCount).to.equal(1);

          // Wrapped component has correct resource state during render
          expect(wrapperIC_Component._renderPasses[1]).to.deep.match({
            users: {
              data: dataCollectionUsers1,
              status: RefraxConstants.IStatus.complete,
              timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
            }
          });
          expect(wrapperIC_Container.isLoading()).to.equal(false);
          expect(wrapperIC_Container.isStale()).to.equal(false);
          expect(wrapperIC_Container.hasData()).to.equal(true);

          resetSpies();
          mock_get('/users', dataCollectionUsers2);
          storeUsers.invalidate();

          expect(spyTCC_render.callCount).to.equal(1);
          expect(spyTC_componentWillReceiveProps.callCount).to.equal(1);
          expect(spyTC_render.callCount).to.equal(1);
          expect(onLoad.callCount).to.equal(1);
          expect(onChange.callCount).to.equal(2);

          // Wrapped component has correct resource state during render
          expect(wrapperIC_Component._renderPasses[2]).to.deep.match({
            users: {
              data: [],
              status: RefraxConstants.IStatus.stale,
              timestamp: (val: number) => val === RefraxConstants.ITimestamp.loading
            }
          });
          expect(wrapperIC_Container.isLoading()).to.equal(true);
          expect(wrapperIC_Container.isStale()).to.equal(true);
          expect(wrapperIC_Container.hasData()).to.equal(true);

          resetSpies();
        })
        .then(delay_for_resource_request(usersAttachment))
        .then(() => {
          expect(spyTCC_render.callCount).to.equal(1);
          expect(spyTC_componentWillReceiveProps.callCount).to.equal(1);
          expect(spyTC_render.callCount).to.equal(1);
          expect(onLoad.callCount).to.equal(1);
          expect(onChange.callCount).to.equal(3);

          // Wrapped component has correct resource state during render
          expect(wrapperIC_Component._renderPasses[3]).to.deep.match({
            users: {
              data: dataCollectionUsers2,
              status: RefraxConstants.IStatus.complete,
              timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
            }
          });
          expect(wrapperIC_Container.isLoading()).to.equal(false);
          expect(wrapperIC_Container.isStale()).to.equal(false);
          expect(wrapperIC_Container.hasData()).to.equal(true);
        });
    });
  });

  describe('when attaching a Action', () => {
    it('should correctly attach and propagate events', () => {
      const onStart = spy();
      const onFinish = spy();
      const wrapper = mount(React.createElement(TestComponentContainer, {
        refrax: {
          createUser: actionCreateUser
        }
      } as object, null));

      expect(wrapper.instance().state.attachments)
        .to.have.all.keys([
          'createUser'
        ])
        .to.deep.match({
          createUser: RefraxActionEntity
        });

      const createUserAction = wrapper.instance().state.attachments.createUser;
      createUserAction.on('start', onStart);
      createUserAction.on('finish', onFinish);

      expect(spyTCC_componentWillMount.callCount).to.equal(1);
      expect(spyTCC_render.callCount).to.equal(1);
      expect(spyTC_componentWillMount.callCount).to.equal(1);
      expect(spyTC_componentWillReceiveProps.callCount).to.equal(0);
      expect(spyTC_render.callCount).to.equal(1);
      expect(onStart.callCount).to.equal(0);
      expect(onFinish.callCount).to.equal(0);
    });

    describe('when invoked', () => {
      it('should correctly propagate', () => {
        const onStart = spy();
        const onFinish = spy();
        const wrapper = mount(React.createElement(TestComponentContainer, {
          refrax: {
            createUser: actionCreateUser
          }
        } as object, null));

        expect(wrapper.instance().state.attachments)
          .to.have.all.keys([
            'createUser'
          ])
          .to.deep.match({
            createUser: RefraxActionEntity
          });

        const createUserAction = wrapper.instance().state.attachments.createUser;
        createUserAction.on('start', onStart);
        createUserAction.on('finish', onFinish);

        resetSpies();

        mock_post('/users', dataElement4);
        createUserAction({
          name: 'john doe'
        });

        expect(spyTCC_componentWillMount.callCount).to.equal(0);
        expect(spyTCC_render.callCount).to.equal(1);
        expect(spyTC_componentWillMount.callCount).to.equal(0);
        expect(spyTC_componentWillReceiveProps.callCount).to.equal(1);
        expect(spyTC_render.callCount).to.equal(1);
        expect(onStart.callCount).to.equal(1);
        expect(onFinish.callCount).to.equal(0);

        resetSpies();

        return delay_for_action(createUserAction)()
          .then(() => {
            expect(spyTCC_componentWillMount.callCount).to.equal(0);
            expect(spyTCC_render.callCount).to.equal(1);
            expect(spyTC_componentWillMount.callCount).to.equal(0);
            expect(spyTC_componentWillReceiveProps.callCount).to.equal(1);
            expect(spyTC_render.callCount).to.equal(1);
            expect(onStart.callCount).to.equal(1);
            expect(onFinish.callCount).to.equal(1);

            resetSpies();
          })
          .then(delay_for())
          .then(() => {
            // Ensure we don't have any further erroneous propagations
            expect(spyTCC_componentWillMount.callCount).to.equal(0);
            expect(spyTCC_render.callCount).to.equal(0);
            expect(spyTC_componentWillMount.callCount).to.equal(0);
            expect(spyTC_componentWillReceiveProps.callCount).to.equal(0);
            expect(spyTC_render.callCount).to.equal(0);
            expect(onStart.callCount).to.equal(1);
            expect(onFinish.callCount).to.equal(1);
          });
      });

      it('should correctly propagate to other containers', () => {
        const wrapperResource = mount(React.createElement(TestComponentContainer, {
          refrax: {
            users: schema.users
          }
        } as object, null));
        const wrapperAction = mount(React.createElement(TestComponentContainer, {
          refrax: {
            createUser: actionCreateUser
          }
        } as object, null));
        const wrapperIC_Resource_Component = wrapperResource.instance().refs.component as TestComponent;
        const wrapperIC_Action_Component = wrapperAction.instance().refs.component as TestComponent;
        const usersAttachment = wrapperResource.instance().state.attachments.users;
        const createUserAction = wrapperAction.instance().state.attachments.createUser;

        expect(spyTCC_componentWillMount.callCount).to.equal(2);
        expect(spyTCC_componentWillMount.thisValues).to.deep.equal([
          wrapperResource.instance(),
          wrapperAction.instance()
        ]);
        expect(spyTCC_render.callCount).to.equal(2);
        expect(spyTCC_render.thisValues).to.deep.equal([
          wrapperResource.instance(),
          wrapperAction.instance()
        ]);
        expect(spyTC_componentWillMount.callCount).to.equal(2);
        expect(spyTC_componentWillMount.thisValues).to.deep.equal([
          wrapperIC_Resource_Component,
          wrapperIC_Action_Component
        ]);
        expect(spyTC_componentWillReceiveProps.callCount).to.equal(0);
        expect(spyTC_render.callCount).to.equal(2);
        expect(spyTC_render.thisValues).to.deep.equal([
          wrapperIC_Resource_Component,
          wrapperIC_Action_Component
        ]);

        expect(wrapperIC_Resource_Component._renderPasses[0]).to.deep.match({
          users: {
            data: null,
            status: RefraxConstants.IStatus.stale,
            timestamp: RefraxConstants.ITimestamp.loading
          }
        });

        resetSpies();

        return delay_for_resource_request(usersAttachment)()
          .then(() => {
            expect(spyTCC_componentWillMount.callCount).to.equal(0);
            expect(spyTCC_render.callCount).to.equal(1);
            expect(spyTCC_render.thisValues).to.deep.equal([
              wrapperResource.instance()
            ]);
            expect(spyTC_componentWillMount.callCount).to.equal(0);
            expect(spyTC_componentWillReceiveProps.callCount).to.equal(1);
            expect(spyTC_componentWillReceiveProps.thisValues).to.deep.equal([
              wrapperIC_Resource_Component
            ]);
            expect(spyTC_render.callCount).to.equal(1);
            expect(spyTC_render.thisValues).to.deep.equal([
              wrapperIC_Resource_Component
            ]);

            expect(wrapperIC_Resource_Component._renderPasses[1]).to.deep.match({
              users: {
                data: dataCollectionUsers1,
                status: RefraxConstants.IStatus.complete,
                timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
              }
            });

            resetSpies();

            mock_post('/users', dataElement4);
            createUserAction({
              name: 'john doe'
            });

            expect(spyTCC_componentWillMount.callCount).to.equal(0);
            expect(spyTCC_render.callCount).to.equal(2);
            expect(spyTCC_render.thisValues).to.deep.equal([
              wrapperAction.instance(),
              wrapperResource.instance()
            ]);
            expect(spyTC_componentWillMount.callCount).to.equal(0);
            expect(spyTC_componentWillReceiveProps.callCount).to.equal(2);
            expect(spyTC_componentWillReceiveProps.thisValues).to.deep.equal([
              wrapperIC_Action_Component,
              wrapperIC_Resource_Component
            ]);
            expect(spyTC_render.callCount).to.equal(2);
            expect(spyTC_render.thisValues).to.deep.equal([
              wrapperIC_Action_Component,
              wrapperIC_Resource_Component
            ]);

            expect(wrapperIC_Resource_Component._renderPasses[2]).to.deep.match({
              users: {
                data: dataCollectionUsers1,
                status: RefraxConstants.IStatus.complete,
                timestamp: RefraxConstants.ITimestamp.loading
              }
            });

            resetSpies();
          })
          .then(delay_for_action(createUserAction))
          .then(() => {
            expect(spyTCC_componentWillMount.callCount).to.equal(0);
            expect(spyTCC_render.callCount).to.equal(2);
            expect(spyTCC_render.thisValues).to.deep.equal([
              wrapperResource.instance(),
              wrapperAction.instance()
            ]);
            expect(spyTC_componentWillMount.callCount).to.equal(0);
            expect(spyTC_componentWillReceiveProps.callCount).to.equal(2);
            expect(spyTC_componentWillReceiveProps.thisValues).to.deep.equal([
              wrapperIC_Resource_Component,
              wrapperIC_Action_Component
            ]);
            expect(spyTC_render.callCount).to.equal(2);
            expect(spyTC_render.thisValues).to.deep.equal([
              wrapperIC_Resource_Component,
              wrapperIC_Action_Component
            ]);

            expect(wrapperIC_Resource_Component._renderPasses[3]).to.deep.match({
              users: {
                data: dataCollectionUsers1,
                status: RefraxConstants.IStatus.complete,
                timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
              }
            });

            resetSpies();
          })
          .then(delay_for())
          .then(() => {
            expect(spyTCC_componentWillMount.callCount).to.equal(0);
            expect(spyTCC_render.callCount).to.equal(0);
            expect(spyTC_componentWillMount.callCount).to.equal(0);
            expect(spyTC_componentWillReceiveProps.callCount).to.equal(0);
            expect(spyTC_render.callCount).to.equal(0);
          });
      });
    });

    it('should correctly use parameters from component', () => {
      const wrapperResource = mount(React.createElement(TestComponentContainer, {
        refrax: {
          users: schema.users
        }
      } as object, null));
      const wrapperAction = mount(React.createElement(TestComponentContainer, {
        userId: 1,
        refrax: {
          updateUser: actionUpdateUser
        }
      } as object, null));
      const wrapperIC_Resource_Component = wrapperResource.instance().refs.component as TestComponent;
      const usersAttachment = wrapperResource.instance().state.attachments.users;
      const updateUserAction = wrapperAction.instance().state.attachments.updateUser;

      expect(wrapperIC_Resource_Component._renderPasses[0]).to.deep.match({
        users: {
          data: null,
          status: RefraxConstants.IStatus.stale,
          timestamp: RefraxConstants.ITimestamp.loading
        }
      });

      return delay_for_resource_request(usersAttachment)()
        .then(() => {
          expect(wrapperIC_Resource_Component._renderPasses[1]).to.deep.match({
            users: {
              data: dataCollectionUsers1,
              status: RefraxConstants.IStatus.complete,
              timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
            }
          });

          mock_put('/users/1', { id: 1, name: 'john doe' });
          return updateUserAction({
            name: 'john doe'
          });
        })
        .then(() => {
          expect(wrapperIC_Resource_Component._renderPasses.length).to.equal(3);
          expect(wrapperIC_Resource_Component._renderPasses[2]).to.deep.match({
            users: {
              data: [
                { id: 1, name: 'john doe' },
                dataElement2
              ],
              status: RefraxConstants.IStatus.complete,
              timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
            }
          });
        });
    });

    it('should correctly use parameters from action', () => {
      const wrapperResource = mount(React.createElement(TestComponentContainer, {
        refrax: {
          users: schema.users
        }
      } as object, null));
      const wrapperAction = mount(React.createElement(TestComponentContainer, {
        refrax: {
          updateUser: actionUpdateUser.withParams({ userId: 1 })
        }
      } as object, null));
      const wrapperIC_Resource_Component = wrapperResource.instance().refs.component as TestComponent;
      const usersAttachment = wrapperResource.instance().state.attachments.users;
      const updateUserAction = wrapperAction.instance().state.attachments.updateUser;

      expect(wrapperIC_Resource_Component._renderPasses[0]).to.deep.match({
        users: {
          data: null,
          status: RefraxConstants.IStatus.stale,
          timestamp: RefraxConstants.ITimestamp.loading
        }
      });

      return delay_for_resource_request(usersAttachment)()
        .then(() => {
          expect(wrapperIC_Resource_Component._renderPasses[1]).to.deep.match({
            users: {
              data: dataCollectionUsers1,
              status: RefraxConstants.IStatus.complete,
              timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
            }
          });

          mock_put('/users/1', { id: 1, name: 'john doe' });

          return updateUserAction({
            name: 'john doe'
          });
        })
        .then(() => {
          expect(wrapperIC_Resource_Component._renderPasses.length).to.equal(3);
          expect(wrapperIC_Resource_Component._renderPasses[2]).to.deep.match({
            users: {
              data: [
                { id: 1, name: 'john doe' },
                dataElement2
              ],
              status: RefraxConstants.IStatus.complete,
              timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
            }
          });
        });
    });

    it('should correctly use parameters when supplied from both', () => {
      const wrapperResource = mount(React.createElement(TestComponentContainer, {
        refrax: {
          users: schema.users
        }
      } as object, null));
      const wrapperAction = mount(React.createElement(TestComponentContainer, {
        userId: 2,
        refrax: {
          updateUser: actionUpdateUser.withParams({ userId: 1 })
        }
      } as object, null));
      const wrapperIC_Resource_Component = wrapperResource.instance().refs.component as TestComponent;
      const usersAttachment = wrapperResource.instance().state.attachments.users;
      const updateUserAction = wrapperAction.instance().state.attachments.updateUser;

      expect(wrapperIC_Resource_Component._renderPasses[0]).to.deep.match({
        users: {
          data: null,
          status: RefraxConstants.IStatus.stale,
          timestamp: RefraxConstants.ITimestamp.loading
        }
      });

      return delay_for_resource_request(usersAttachment)()
        .then(() => {
          expect(wrapperIC_Resource_Component._renderPasses[1]).to.deep.match({
            users: {
              data: dataCollectionUsers1,
              status: RefraxConstants.IStatus.complete,
              timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
            }
          });

          mock_put('/users/1', { id: 1, name: 'john doe' });

          return updateUserAction({
            name: 'john doe'
          });
        })
        .then(() => {
          expect(wrapperIC_Resource_Component._renderPasses.length).to.equal(3);
          expect(wrapperIC_Resource_Component._renderPasses[2]).to.deep.match({
            users: {
              data: [
                { id: 1, name: 'john doe' },
                dataElement2
              ],
              status: RefraxConstants.IStatus.complete,
              timestamp: (val: number) => val > RefraxConstants.ITimestamp.loading
            }
          });
        });
    });
  });
});
