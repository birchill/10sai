const ExtractTextPlugin = require('extract-text-webpack-plugin');
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
  config.resolve.modules.push(path.resolve(__dirname, '../scss'));
  config.plugins.push(
    new ExtractTextPlugin({ filename: 'storybook.css', allChunks: true })
  );

  return config;
};
