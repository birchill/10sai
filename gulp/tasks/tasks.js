import gulp from 'gulp';
import run from 'run-sequence';

import config from '../config';

gulp.task('dev', () => {
  run('js:lint', 'clean:dev', [ 'html:dev', 'js:dev', 'js:copy:dev',
                                'js:vendor:dev' ]);
});

// TODO: Linting (JS and JSON)
// TODO: Set up package.json script aliases

gulp.task('dist', [ 'js:lint', 'clean:dist', 'html:dist', 'js:dist' ]);

gulp.task('default', ['dev']);
