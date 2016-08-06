var gulp         = require('gulp');
var browserSync  = require('browser-sync');
var rename = require("gulp-rename");
var jshint       = require('gulp-jshint');
var uglify       = require('gulp-uglify');
var usemin       = require('gulp-usemin');
var gulpSequence = require('gulp-sequence');
var imagemin     = require('gulp-imagemin');
var gzip         = require('gulp-gzip');
var pngquant     = require('imagemin-pngquant');
var minifyHtml = require('gulp-minify-html');
var minifyCss = require('gulp-minify-css');
var harp         = require('harp');
var spritesmith  = require('gulp.spritesmith');
var merge = require('merge-stream');
var gm = require('gm');
var promise      = require('es6-promise').polyfill();
var _ = require('lodash');
var less = require('gulp-less');
var sass = require('gulp-sass');
var path = require('path');
var flatten = require('gulp-flatten');


var projectPath = '.';
var projectDest = 'www';
var exec = require('child_process').exec;


gulp.task('serve', function() {
  harp.server(projectPath, {
    ip: '0.0.0.0',
    port: 9000
  }, function() {
    return this.projectPath;
  });
});

gulp.task('browser-sync', function() {
  browserSync({
    proxy: "localhost:9000",
    open: false
  });
});

gulp.task('jshint', function() {
  return gulp.src(['public/_js/**/*.js', '!public/_js/2D.js'])
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task('harp-compile', function (done) {
  exec('mv ./public/bower ./public/_bower', function() {
    harp.compile(projectPath, projectDest, function() {
      exec('mv ./public/_bower ./public/bower', function() {
        done();
      });
    });
  });
});

gulp.task('compile', ['harp-compile'], function () {
  return gulp.src('./public/slfm_files/**/*.slfm', {base: './public/slfm_files'})
    .pipe(gulp.dest(projectDest + '/slfm_files'));
});


gulp.task('css-preprocess', ['compile'], function (done) {
  return gulp.src('./public/css/*.less')
    .pipe(less({
      paths: [ path.join(__dirname, 'less', 'includes') ]
    }))
    .pipe(gulp.dest('./public/css/'));
});

gulp.task('scripts', ['compile', 'css-preprocess'], function() {
  return gulp.src(projectDest + '/*.html')
    .pipe(usemin({
      assetsDir: 'public',
      js: [uglify(), 'concat'],
      css: ['concat']
    }))
    .pipe(gulp.dest(projectDest))
    .pipe(gzip())
    .pipe(gulp.dest(projectDest));
});

gulp.task('sprite', ['compile'], function() {
  var spriteFolders = ['gallery-thumbs', 'starter', 'index-steps', 'docs', 'tutorial'];
  var streams = _.map(spriteFolders, function(folder) {
    var spriteData =
      gulp.src(['./public/images/' + folder + '/*.jpg'])
        .pipe(spritesmith({
          imgName: folder + '-sprite.jpg',
          cssName: folder + '-sprite.less',
          engine: 'gmsmith',
          imgOpts: {quality: 90, background: [255, 255, 255, 255]},
          padding: 2,
          cssTemplate: "sprites.less.handlebars"
        }));

    var imgStream = spriteData.img.pipe(gulp.dest('./public/images/sprites')); // output path for the sprite
    var cssStream = spriteData.css.pipe(gulp.dest('./public/css')); // output path for the CSS

    return merge(imgStream, cssStream);
  });

  _.each(_.tail(streams), function(s) {
    _.first(streams).add(s);
  });

  return _.first(streams);
});

gulp.task('images-bower', ['compile'], function () {
  return gulp.src('./public/bower/lightbox2/dist/images/*', {base: './public/bower'})
    .pipe(flatten())
    .pipe(gulp.dest('./public/images'));
});

gulp.task('images', ['images-bower', 'sprite'], function() {
  var img = './public/images';
  return gulp.src([img + '/*.*', img + '/sprites/**/*.*', img + '/index/*', img + '/gallery/**/*', img + '/gallery-diagrams/*', img + '/tutorial/*', img + '/docs/*.gif'], {base: './public/images'})
    .pipe(imagemin({
      progressive: true,
      svgoPlugins: [{removeViewBox: false}],
      optimizationLevel: 3,
      use: [pngquant()]
    }))
    .pipe(gulp.dest(projectDest + '/images'));
});

gulp.task('post-build', ['scripts', 'images'], function(done) {
  exec('rm ./public/css/*.css', done);
});

gulp.task('build', ['scripts', 'sprite', 'images', 'post-build']);