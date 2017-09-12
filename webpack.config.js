const ExtractTextPlugin = require('extract-text-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: [ 'babel-polyfill', './src/index.js' ],
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'tensai.js'
  },
  devtool: 'cheap-source-map',
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.jsx?$/,
        loader: 'eslint-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          presets: [ 'es2017', 'react' ],
          plugins: [ 'transform-object-rest-spread' ]
        }
      },
      {
        test: /\.scss$/,
        loader: ExtractTextPlugin.extract({
          loader: [
            { loader: 'raw-loader' },
            { loader: 'sass-loader',
              options: {
                includePaths: [path.resolve(__dirname, "./scss")]
              }
            }
          ]
        })
      }
    ]
  },
  resolve: {
    modules: [
      path.resolve(__dirname, './src'),
      path.resolve(__dirname, './scss'),
      'node_modules'
    ]
  },
  plugins: [
    new ExtractTextPlugin({ filename: 'tensai.css', allChunks: true }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`
    })
  ]
};
