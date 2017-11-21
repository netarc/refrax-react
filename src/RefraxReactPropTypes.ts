/**
 * Copyright (c) 2015-present, Joshua Hollenbeck
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  ActionEntity,
  Constants,
  Resource
} from 'refrax';

export default {
  resource(props: Constants.IKeyValue, propName: string, componentName: string): Error | null {
    const resource = props[propName];

    if (resource == null) {
      return new Error(
        `Required prop \`${propName}\` was not specified in \`${componentName}\`.`
      );
    }
    else if (!(resource instanceof Resource)) {
      return new Error(
        `Invalid prop \`${propName}\` supplied to \`${componentName}\`, expected a Resource.`
      );
    }

    return null;
  },

  action(props: Constants.IKeyValue, propName: string, componentName: string): Error | null {
    const resource = props[propName];

    if (resource == null) {
      return new Error(
        `Required prop \`${propName}\` was not specified in \`${componentName}\`.`
      );
    }
    else if (!(resource instanceof ActionEntity)) {
      return new Error(
        `Invalid prop \`${propName}\` supplied to \`${componentName}\`, expected a Action.`
      );
    }

    return null;
  }
};
