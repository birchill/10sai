const ExtractTextPlugin = require('extract-text-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: {
    '10sai': ['@babel/polyfill', './src/index.js'],
    '_database': ['@babel/polyfill', './src/_database.js'],
    '_assets': ['@babel/polyfill', './src/_assets.js'],
    '_grid': ['@babel/polyfill', './src/_grid.js']
  },
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: '[name].js'
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
          presets: [ '@babel/es2017', '@babel/react' ],
          plugins: [ 'transform-object-rest-spread' ]
        }
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          use: [
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
    new ExtractTextPlugin({ filename: '10sai.css', allChunks: true }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`
    })
  ]
};
