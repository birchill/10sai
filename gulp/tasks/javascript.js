import gulp from 'gulp';
import cache from 'gulp-cached';
import jspm from 'gulp-jspm';
import rename from 'gulp-rename';
import eslint from 'gulp-eslint';

import config from '../config';

/// List JS files
gulp.task('js:lint', () => {
  // Otherwise, the task may end before the stream has finished.
  return gulp.src(config.path.js.files)
             .pipe(eslint())
             .pipe(eslint.format())
             .pipe(eslint.failAfterError());
});

/// Copy js source files to dev folder
gulp.task('js:dev', () => {
  return gulp.src(config.path.js.files)
    .pipe(cache('js'))
    .pipe(gulp.dest(config.dev.js));
});

/// Bundle up all third-party JS into a single file (to reduce download time)
/// and copy to dev folder
gulp.task('js:vendor:dev', () => {
  return gulp.src(config.path.js.entry)
    // Even in the dev version we bundle up all the third-party JS since
    // otherwise the time it takes to pull in all the files used in React,
    // PouchDB etc. means it takes 30s to refresh the page.
    .pipe(jspm({ arithmetic: '- [./src/**/*] ' +
                             // We need to explicitly pull in Babel and the
                             // JSX plugin (there's surely a better way of
                             // doing this, however)
                             '+ jspm_packages/npm/babel-core* ' +
                             '+ jspm_packages/github/floatdrop/plugin-jsx*'}))
    .pipe(rename('vendor.js'))
    .pipe(gulp.dest(config.dev.js));
});

/// Copy bootstrap files (system.js, config.js) to dev folder
gulp.task('js:copy:dev', () => {
  return gulp.src(config.path.js.copy)
    .pipe(gulp.dest(config.dev.js));
});

/// Bundle up everything into one file and copy to dist folder
gulp.task('js:dist', () => {
  return gulp.src(config.path.js.entry)
    .pipe(jspm({ selfExecutingBundle: true }))
    .pipe(rename('bundle.js'))
    .pipe(gulp.dest(config.dist.js));
});
