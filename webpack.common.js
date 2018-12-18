const ExtractTextPlugin = require('extract-text-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: {
    '10sai': ['@babel/polyfill', './src/index.tsx'],
    _database: ['@babel/polyfill', './src/_database.ts'],
    _grid: ['@babel/polyfill', './src/_grid.tsx'],
  },
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          presets: ['@babel/preset-env', '@babel/react'],
          plugins: ['transform-object-rest-spread'],
        },
      },
      {
        test: /\.scss$/,
        use: ExtractTextPlugin.extract({
          use: [
            { loader: 'raw-loader' },
            {
              loader: 'sass-loader',
              options: {
                includePaths: [path.resolve(__dirname, './scss')],
                sourceMap: true,
              },
            },
          ],
        }),
      },
    ],
  },
  resolve: {
    modules: [
      path.resolve(__dirname, './src'),
      path.resolve(__dirname, './scss'),
      'node_modules',
    ],
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  plugins: [
    new ExtractTextPlugin({ filename: '10sai.css', allChunks: true }),

    // No idea if I actually need this anymore.
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`,
    }),
  ],
};
