import { use } from 'chai';

// tslint:disable: no-string-throw

const pluginDeepMatch = (chai: any, utils: any): void => {
  // tslint:disable-next-line:cyclomatic-complexity
  const deepMatchObject = (expect: any, actual: any, path?: string): boolean => {
    path = path || '';

    if (expect === actual) {
      return true;
    }

    // null value
    if (expect === null) {
      if (actual !== null) {
        throw `Expected to have null but got "${actual}" at path "${path}".`;
      }

      return true;
    }

    // undefined expected value
    if (typeof expect === 'undefined') {
      if (typeof actual !== 'undefined') {
        throw `Expected to have undefined but got "${actual}" at path "${path}".`;
      }

      return true;
    }

    if (expect === Number) {
      if (typeof actual !== 'number') {
        throw `Expected to have "' + expect.name + '" but got "${actual}" at path "${path}".`;
      }

      return true;
    }

    if (expect === String) {
      if (typeof actual !== 'string') {
        throw `Expected to have "' + expect.name + '" but got "${actual}" at path "${path}".`;
      }

      return true;
    }

    // scalar description
    if (/boolean|number|string/.test(typeof expect)) {
      if (expect !== actual) {
        throw `Expected to have "' + expect + '" but got "${actual}" at path "${path}".`;
      }

      return true;
    }

    // dates
    if (expect instanceof Date) {
      if (actual instanceof Date) {
        if (expect.getTime() !== actual.getTime()) {
          throw(
            `Expected to have date "${expect.toISOString()}" but got "${actual.toISOString()}" at path "${path}".`
          );
        }
      }
      else {
        throw(
          `Expected to have date "${expect.toISOString()}" but got "${actual}" at path "${path}".`
        );
      }
    }

    // @todo: Some hacks to catch instanceof matches
    if (typeof(expect) === 'function') {
      // not 100%, but this catches all cases where our function is a constructor
      if (Object.keys(expect.prototype || {}).length > 0) {
        if (actual instanceof expect) {
          return true;
        }

        throw `Expected instance of at path "${path}".`;
      }

      if (!expect(actual)) {
        throw `Expected to evaulatue true but got false at path "${path}".`;
      }

      return true;
    }

    if (actual === null) {
      throw `Expected to have an array/object but got null at path "${path}".`;
    }

    if (Object.prototype.toString.call(expect) !== Object.prototype.toString.call(actual)) {
      throw `Expected to have "' + expect + '" but got "${actual}" at path "${path}".`;
    }

    // array/object description
    for (const prop in expect) {
      // if (typeof expect[prop] === 'function') {
      //   continue;
      // }

      if (typeof actual[prop] === 'undefined' && typeof expect[prop] !== 'undefined') {
        throw `Expected "${prop}" field to be defined at path "${path}".`;
      }

      // tslint:disable-next-line:prefer-template
      deepMatchObject(expect[prop], actual[prop], (path === '') ? prop : path + '.' + prop);
    }

    return true;
  };

  utils.overwriteMethod(chai.Assertion.prototype, 'match', (_super: (...args: any[]) => void) =>
    function(this: any, expect: any): void {
      if (utils.flag(this, 'deep')) {
        try {
          deepMatchObject(expect, this._obj);
        } catch (msg) {
          throw new chai.AssertionError(msg, {
            actual: this._obj,
            expected: expect,
            showDiff: true
          });
        }
      }
      else {
        _super.apply(this, arguments);
      }
    });
};

use(pluginDeepMatch);
