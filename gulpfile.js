/**
 * Copyright (c) 2017-present, Joshua Hollenbeck
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const babel = require('gulp-babel');
const babelPluginDEV = require('./scripts/dev-expression');
const del = require('del');
const derequire = require('gulp-derequire');
const gulp = require('gulp');
const gulpUtil = require('gulp-util');
const header = require('gulp-header');
const runSequence = require('run-sequence');
const webpackStream = require('webpack-stream');
const sourcemaps = require('gulp-sourcemaps');
const mocha = require('gulp-mocha');
const ts = require('gulp-typescript');

const HEADER = [
  '/**',
  ' * RefraxReact v<%= version %>',
  ' *',
  ' * Copyright (c) 2015-present, Joshua Hollenbeck',
  ' * All rights reserved.',
  ' *',
  ' * This source code is licensed under the BSD-style license found in the',
  ' * LICENSE file in the root directory of this source tree.',
  ' */'
].join('\n') + '\n';

const buildDist = (opts) => {
  var webpackOpts = {
    externals: /^[-\/a-zA-Z0-9]+$/,
    output: {
      filename: opts.output,
      libraryTarget: 'umd',
      library: 'RefraxReact'
    },
    plugins: [
      new webpackStream.webpack.LoaderOptionsPlugin({
        debug: opts.debug
      }),
      new webpackStream.webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(
          opts.debug ? 'development' : 'production'
        )
      }),
      new webpackStream.webpack.optimize.OccurrenceOrderPlugin(),
      new webpackStream.webpack.optimize.DedupePlugin()
    ]
  };
  if (!opts.debug) {
    webpackOpts.plugins.push(
      new webpackStream.webpack.optimize.UglifyJsPlugin({
        compress: {
          hoist_vars: true,
          screw_ie8: true,
          warnings: false
        }
      })
    );
  }
  return webpackStream(webpackOpts, null, (err, stats) => {
    if (err) {
      throw new gulpUtil.PluginError('webpack', err);
    }
    if (stats.compilation.errors.length) {
      throw new gulpUtil.PluginError('webpack', stats.toString());
    }
  }).on('error', (error) => {
    gulpUtil.log(gulpUtil.colors.red('JS Compile Error: '), error.message);
  });
};

const paths = {
  dist: 'dist',
  lib: 'lib',
  test: 'test',
  entry: 'lib/index.js',
  src: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts'
  ],
  srcTest: [
    'src/**/*.ts',
    'src/**/*.tsx',
    'scripts/**/*.ts',
    '!src/**/*.d.ts'
  ]
};

gulp.task('clean', function(cb) {
  return del([paths.dist, paths.lib, paths.test], cb);
});

gulp.task('modules', function() {
  return gulp
    .src(paths.src)
    .pipe(ts.createProject('tsconfig.json', {
      declaration: true
    })())
    .pipe(babel({
      ignore: ['*.d.ts'],
      plugins: [
        babelPluginDEV
      ]
    }))
    .pipe(gulp.dest(paths.lib));
});

gulp.task('modules-test', function() {
  return gulp
    .src(paths.srcTest)
    .pipe(sourcemaps.init())
    .pipe(ts.createProject('tsconfig.json', {
      declaration: false
    })())
    .pipe(babel({
      plugins: [
        babelPluginDEV,
        ['babel-plugin-module-resolver', {
          alias: {
            'test': './test/test'
          }
        }]
      ]
    }))
    .pipe(sourcemaps.write({ sourceRoot: '/src' }))
    .pipe(gulp.dest(paths.test));
});

gulp.task('dist', function() {
  var distOpts = {
    debug: true,
    output: 'refrax-react.js'
  };
  return gulp.src(paths.entry)
    .pipe(buildDist(distOpts))
    .pipe(derequire())
    .pipe(header(HEADER, {
      version: process.env.npm_package_version
    }))
    .pipe(gulp.dest(paths.dist));
});

gulp.task('dist:min', function() {
  var distOpts = {
    debug: false,
    output: 'refrax-react.min.js'
  };
  return gulp.src(paths.entry)
    .pipe(buildDist(distOpts))
    .pipe(header(HEADER, {
      version: process.env.npm_package_version
    }))
    .pipe(gulp.dest(paths.dist));
});

gulp.task('testMocha', function() {
  gulp
    .src([
      'test/**/*.spec.js'
    ], {read: false})
    .pipe(
      mocha({
        require: [
          'test/test/ChaiDeepMatch.js',
          'test/test/TestSupport.js'
        ],
        // reporter: 'scripts/test/Reporter.js'
      })
        .on('error', function(error) {
          this.emit('end');
        })
    );
});

gulp.task('test', function(cb) {
  runSequence('clean', 'modules-test', 'testMocha', cb);
});

gulp.task('default', function(cb) {
  runSequence('clean', 'modules', ['dist', 'dist:min'], cb);
});
