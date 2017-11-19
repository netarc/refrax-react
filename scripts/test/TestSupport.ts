// tslint:disable: interface-name no-var-requires no-require-imports no-magic-numbers
require('source-map-support').install();

declare global {
  namespace Chai {
    interface Deep {
      match(value: any, message?: string): void;
    }
  }
}

import axios from 'axios';
import * as Promise from 'bluebird';
import { axiosMock, Request } from './AxiosMock';
const JSDOM = require('jsdom').JSDOM;
const map = require('mocha/lib/utils.js').map;

// IMPORTANT: We need to setup our global window/document otherwise `fbjs` will
// fail to init canUseDOM correctly when `react` or `enzyme` is loaded at the start
// of a test spec file.
const { window } = new JSDOM('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
(global as any).window = window;
(global as any).document = window.document;
(global as any).navigator = {
  userAgent: 'node.js'
};
// @ts-ignore readonly write-protect
window.localStorage = window.sessionStorage = {
  __storage: {},
  getItem(key: string): string | null {
    return this.__storage[key] || null;
  },
  setItem(key: string, value: string): void {
    this.__storage[key] = '' + value;
  },
  removeItem(key: string): void {
    delete this.__storage[key];
  }
};

import { mount as mountEnzyme, configure, ReactWrapper } from 'enzyme';
import * as Adapter from 'enzyme-adapter-react-16';
import { ReactElement } from 'react';

configure({ adapter: new Adapter() });

const host = '';
let mounted: ReactWrapper[] = [];
let isHooked = false;

const axios_hook = () => {
  if (!isHooked) {
    isHooked = true;
    axiosMock.install(axios);
  }
};

export const mount = (component: ReactElement<any>) => {
  const wrapper = mountEnzyme(component);
  mounted.push(wrapper);
  return wrapper;
};

export const mount_cleanup = () => {
  for (let i = 0, l = mounted.length; i < l; i++) {
    mounted[i].unmount();
  }

  mounted = [];
};

export const mock_reset = () => {
  axiosMock.requests.reset();
  axiosMock.stubs.reset();
  window.localStorage.__storage = {};
};

export const mock_request_count = () =>
  axiosMock.requests.__items.length;

export const mock_status = () =>
  map(axiosMock.requests.__items, (item: Request) => ({
    url: item.url.replace(host, ''),
    mocked: item.resolved
  }));

export const mock_get = (uri: string, response: any, status: number = 200) => {
  axios_hook();
  axiosMock.stubRequest('get', `${host}${uri}`, { status, response });
};

export const mock_post = (uri: string, response: any, status: number = 200) => {
  axios_hook();
  axiosMock.stubRequest('post', `${host}${uri}`, { status, response });
};

export const mock_put = (uri: string, response: any, status: number = 200) => {
  axios_hook();
  axiosMock.stubRequest('put', `${host}${uri}`, { status, response });
};

export const mock_delete = (uri: string, status: number = 200) => {
  axios_hook();
  axiosMock.stubRequest('delete', `${host}${uri}`, { status });
};

export const wait_for_promise = (fn: () => void) =>
  new Promise((resolve, reject) => {
    const failure = setTimeout(() => {
      reject();
      resolve = null!;
    }, 5000);
    const hook = () => {
      setTimeout(() => {
        if (!resolve) {
          return;
        }

        if (fn()) {
          clearTimeout(failure);
          resolve();
        }
        else {
          hook();
        }
      }, 10);
    };

    hook();
  });

export const delay_for = (delay = 5) =>
  () =>
    new Promise((resolve, _reject) => {
      setTimeout(() => {
        resolve();
      }, delay);
    });

export const delay_for_resource_request = (resource: any) =>
  () => {
    // pre-create our error so we can use its stack-trace when we reject
    const err = new Error('delay timeout!');

    return new Promise((resolve, reject) => {
      let timeout: NodeJS.Timer = null!;
      const disposer = resource.once('change', () => {
        clearTimeout(timeout);
        resolve();
      });

      timeout = setTimeout(() => {
        disposer();
        reject(err);
      }, 50);
    });
  };

export const delay_for_action = (resource: any) =>
  () => {
    // pre-create our error so we can use its stack-trace when we reject
    const err = new Error('delay timeout!');

    return new Promise((resolve, reject) => {
      let timeout: NodeJS.Timer = null!;
      const disposer = resource.once('finish', () => {
        clearTimeout(timeout);
        resolve();
      });

      timeout = setTimeout(() => {
        disposer();
        reject(err);
      }, 50);
    });
  };
