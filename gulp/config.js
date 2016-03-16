import gutil from 'gulp-util';

export default {

  port: {
    dev: 8880,
    dist: 8881
  },

  path: {
    js: {
      files: [ 'src/**/*.js', 'src/**/*.jsx' ],
      entry: 'src/app.js',
      copy: [ 'jspm_packages/system.js', 'config.js' ],
      jspm: 'jspm_packages/**/*'
    },
    html: {
      files: 'index.html'
    }
  },

  dev: {
    dir: 'dev',
    js: 'dev/js',
    css: 'dev/css',
    html: 'dev',
    jspm: 'dev/jspm_packages'
  },

  dist: {
    dir: 'dist',
    js: 'dist/js',
    css: 'dist/css',
    html: 'dist'
  },

  htmlReplace: {
    'js': [ 'js/bundle.js' ]
  },

  handleError: gutil.log,
};
