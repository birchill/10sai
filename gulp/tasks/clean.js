import gulp from 'gulp';
import del from 'del';

import config from '../config';

gulp.task('clean:dev', () => {
  del.sync(`${config.dev.dir}/**`);
});

gulp.task('clean:dist', () => {
  del.sync(`${config.dist.dir}/**`);
});
