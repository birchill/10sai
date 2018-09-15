const ExtractTextPlugin = require('extract-text-webpack-plugin');
const path = require('path');

module.exports = (baseConfig, env, defaultConfig) => {
  // TypeScript
  defaultConfig.module.rules.push({
    test: /\.tsx?$/,
    include: path.resolve(__dirname, '../src'),
    use: 'ts-loader',
  });
  defaultConfig.resolve.extensions.push('.ts', '.tsx');

  // SASS
  defaultConfig.module.rules.push({
    test: /\.scss$/,
    use: ExtractTextPlugin.extract({
      use: [
        { loader: 'raw-loader' },
        {
          loader: 'sass-loader',
          options: {
            includePaths: [path.resolve(__dirname, '../scss')],
            sourceMap: true,
          },
        },
      ],
    }),
  });
  defaultConfig.resolve.modules.push(path.resolve(__dirname, '../scss'));
  defaultConfig.plugins.push(
    new ExtractTextPlugin({ filename: 'storybook.css', allChunks: true })
  );

  return defaultConfig;
};
