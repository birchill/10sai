const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');

module.exports = ({ config, mode }) => {
  // TypeScript
  config.module.rules.push({
    test: /\.tsx?$/,
    include: path.resolve(__dirname, '../src'),
    use: 'ts-loader',
  });
  config.resolve.extensions.push('.ts', '.tsx');

  // SASS
  config.module.rules.push({
    test: /\.scss$/,
    use: [
      {
        loader: MiniCssExtractPlugin.loader,
        options: {
          publicPath: '../public/',
          hmr: process.env.NODE_ENV === 'development',
        },
      },
      {
        loader: 'css-loader',
        options: {
          url: false,
        },
      },
      {
        loader: 'sass-loader',
        options: {
          includePaths: [path.resolve(__dirname, '../scss')],
          sourceMap: true,
        },
      },
    ],
  });
  config.resolve.modules.push(path.resolve(__dirname, '../scss'));
  config.plugins.push(new MiniCssExtractPlugin({ filename: 'storybook.css' }));
  config.optimization = {
    splitChunks: {
      cacheGroups: {
        styles: {
          name: 'styles',
          test: /\.css$/,
          chunks: 'all',
          enforce: true,
        },
      },
    },
  };

  return config;
};
