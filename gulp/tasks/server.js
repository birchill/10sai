import gulp from 'gulp';
import gls from 'gulp-live-server';

import config from '../config';

gulp.task('serve', () => {
  var server = gls.static(config.dev.dir, config.port.dev);
  server.start();
});
