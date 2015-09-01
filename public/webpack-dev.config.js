var shared            = require('./webpack-shared.config'),
    webpack           = require('webpack'),
    path              = require('path'),
    ExtractTextPlugin = require("extract-text-webpack-plugin");

var config = shared({
  devtool: "eval-source-map", // https://webpack.github.io/docs/build-performance.html
  resolve: {
    alias: {}
  },
  module: {},
  plugins: []
});

module.exports = config;