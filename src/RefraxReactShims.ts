/**
 * Copyright (c) 2015-present, Joshua Hollenbeck
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import * as React from 'react';

import { Tools as RefraxTools } from 'refrax';

const RefraxReactShims = {
  contextTypes: {},
  getComponentParams: function (this: React.Component): object {
    return RefraxTools.extend({}, this.props);
  }
};

export default RefraxReactShims;
