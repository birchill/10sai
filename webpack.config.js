const ExtractTextPlugin = require('extract-text-webpack-plugin');
const path = require('path');

module.exports = {
  entry: [ 'babel-polyfill', './src/index.js' ],
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'tensai.js'
  },
  module: {
    preLoaders: [
      {
        test: /\.jsx?$/,
        loader: 'eslint-loader',
        exclude: /node_modules/,
      }
    ],
    loaders: [
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          presets: [ 'es2015', 'react' ],
          plugins: [ 'transform-object-rest-spread' ]
        }
      },
      {
        test: /\.scss$/,
        loader: ExtractTextPlugin.extract('raw!sass')
      }
    ]
  },
  resolve: {
    root: [
      path.resolve(__dirname, './src'),
      path.resolve(__dirname, './scss')
    ]
  },
  sassLoader: {
    includePaths: [path.resolve(__dirname, "./scss")]
  },
  plugins: [
    new ExtractTextPlugin('tensai.css', { allChunks: true })
  ]
};
