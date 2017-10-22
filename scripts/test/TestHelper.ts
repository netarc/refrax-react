/**
 * Copyright (c) 2015-present, Joshua Hollenbeck
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import {
  ResourceDescriptor,
  Tools,
  Constants
} from 'refrax';

const { extend } = Tools;

export const descriptorFrom = (params: Constants.IKeyValue) => {
  const descriptor = new ResourceDescriptor(null);
  descriptor.basePath = params.path || descriptor.path;
  descriptor.event = params.id || params.basePath;
  extend(descriptor, params);

  return descriptor;
};

export const descriptorCollection = (params: Constants.IKeyValue) =>
  extend(descriptorFrom(params), {
    classify: Constants.IClassification.collection
  });

export const descriptorCollectionItem = (params: Constants.IKeyValue) =>
  extend(descriptorFrom(params), {
    classify: Constants.IClassification.item
  });

export const descriptorResource = (params: Constants.IKeyValue) =>
  extend(descriptorFrom(params), {
    classify: Constants.IClassification.resource
  });
