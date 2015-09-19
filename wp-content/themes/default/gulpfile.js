var gulp = require('gulp'),
    plumber = require('gulp-plumber'),
    notify = require('gulp-notify'),
    concat = require('gulp-concat'),
    replace = require('gulp-replace'),
    rename = require('gulp-rename'),
    stylus = require('gulp-stylus'),
    autoprefixer = require('gulp-autoprefixer'),
    purifycss = require('gulp-purifycss'),
    minifyCss = require('gulp-minify-css'),
    jshint = require('gulp-jshint'),
    uglify = require('gulp-uglify'),
    sourcemaps = require('gulp-sourcemaps'),
    imagemin = require('gulp-imagemin'),
    watch = require('gulp-watch'),
    rev = require('gulp-rev'),
    revReplace = require('gulp-rev-replace'),
    cssRef = require('gulp-rev-css-url'),

    fs = require('fs'),
    del = require('del'),
    through = require('through2'),
    path = require('path'),
    spawn = require('child_process').spawn,

    vinylPaths = require('vinyl-paths'),

    livereload = require('gulp-livereload');

/*----------------------------*\
	Read list of CSS and JS files and add full path
\*----------------------------*/
var pkg = require('./package.json');
for(var i = 0; i < pkg.css_files.length; i++){
	pkg.css_files[i] = './src/styl/' + pkg.css_files[i] + '.styl';
}
for(var i = 0; i < pkg.js_files.length; i++){
	pkg.js_files[i] = './src/js/' + pkg.js_files[i] + '.js';
}

/*----------------------------*\
	Clean
\*----------------------------*/
gulp.task('clean_css', function(cb){
	del(['./assets/css/*'], cb);
});
gulp.task('clean_js', function(cb){
	del(['./assets/js/*'], cb);
});
gulp.task('clean_all', function(cb){
	del(['./assets/**/*'], cb);
});

gulp.task('unrev', function(cb){
	var vp = vinylPaths();
	gulp.src(pkg.revision)
		.pipe(vp)
		.pipe(rename(function(path){
			path.basename = path.basename.replace(/-[a-zA-Z0-9]{8,10}$/, '');
		}))
		.pipe(gulp.dest('./assets'))
		.on('end', function(){
			if(vp.paths){
            	del(vp.paths, cb);
            }
        });
});

/*----------------------------*\
	Compile Stylus
\*----------------------------*/
gulp.task('css', ['clean_css'], function(){
	return gulp.src(pkg.css_files)
		.pipe(plumber({
			errorHandler: notify.onError('<%= error.message %>')
		}))
		.pipe(sourcemaps.init())
		.pipe(concat('main.styl'))
		.pipe(stylus({compress:false, url:'embedurl'}))
		.pipe(purifycss(['./src/js/**/*.js', './src/templates/**/*.php']))
		.pipe(autoprefixer())
		.pipe(minifyCss())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('./assets/css'));
});

/*----------------------------*\
	Optimize images
\*----------------------------*/
gulp.task('images', function(){
	return gulp.src('./src/images/**')
		.pipe(imagemin({progressive:true}))
		.pipe(gulp.dest('./assets/images'));
});

/*----------------------------*\
	JavaScript
\*----------------------------*/
gulp.task('js', ['clean_js'], function(){
	return gulp.src(pkg.js_files)
		.pipe(plumber({
			errorHandler: notify.onError('<%= error.message %>')
		}))
		.pipe(jshint())
		.pipe(jshint.reporter('jshint-stylish'))
		.pipe(jshint.reporter('fail'))
		.pipe(sourcemaps.init())
		.pipe(concat('main.js'))
		.pipe(uglify())
		.pipe(sourcemaps.write('.'))
		.pipe(gulp.dest('./assets/js'));
});

gulp.task('copy_fonts', function(){
	return gulp.src('./src/fonts/*')
		.pipe(gulp.dest('./assets/fonts'));
});
gulp.task('copy_templates', function(){
	return gulp.src('./src/templates/*')
		.pipe(gulp.dest('.'));
});

/*----------------------------*\
	Prefix assets with Wordpress template directory
\*----------------------------*/
gulp.task('replace_wp', function(){
	return gulp.src('./*.php')
		.pipe(replace(/(["'])assets\//g, '$1<?=get_template_directory_uri()?>/assets/'))
		.pipe(gulp.dest('.'))
		.on('end', function(){
			livereload.reload();
		});
});

/*----------------------------*\
	File revisioning for images, CSS, JS
\*----------------------------*/
// Remove originals
var rmOrig = function() {
  return through.obj(function(file, enc, cb) {

    if (file.revOrigPath) {
      fs.unlink(file.revOrigPath, function(err) {
      });
    }

    this.push(file);
    return cb();
  });
};

// Save revisioned files, removing originals
gulp.task('revision', function(){
	return gulp.src(pkg.revision, {base: path.join(process.cwd(), 'assets')})
    .pipe(rev())
    .pipe(cssRef()) // replace references in CSS
    .pipe(gulp.dest('./assets'))
    .pipe(rmOrig()) // remove originals
    .pipe(rev.manifest({merge:true})) // save manifest
    .pipe(gulp.dest('./assets'));
});

// Replace references to files
gulp.task('rev', ['revision'], function(){
	var manifest = gulp.src('./assets/rev-manifest.json');

	return gulp.src('./*.php')
		.pipe(revReplace({
			manifest: manifest,
			replaceInExtensions: ['.php']
		}))
		.pipe(gulp.dest('.'));
});

/*----------------------------*\
	File watcher
\*----------------------------*/
gulp.task('watch:build', ['cleanbuild'], function(){
	gulp.start('watch');
});
gulp.task('watch', function(){
	livereload.listen();
	watch(['./src/styl/**/*', './src/js/**/*', './src/fonts/**/*', './src/templates/**/*'], function(){
		gulp.start('master:notimages');
	});
	watch('./src/images/**/*', function(){
		gulp.start('master');
	});
});

/*----------------------------*\
	Default task starts watch task in a new process
	Restarts when package file changes (add gulpfile??)
\*----------------------------*/
gulp.task('default', function() {
	var process;

	function restart(){
		if (process) {
			process.kill();
		}
		process = spawn('gulp', ['watch'], {stdio: 'inherit'});
	}

	gulp.watch('package.json', restart);
	//restart();
	process = spawn('gulp', ['watch:build'], {stdio: 'inherit'});
});


gulp.task('master', ['unrev'], function(){
	gulp.start('build');
});

gulp.task('build', [
	'images',
	'copy_templates',
	'copy_fonts',
	'css',
	'js'
], function(){
	gulp.start('build2');
});

gulp.task('master:notimages', ['unrev'], function(){
	gulp.start('build:notimages');
});

gulp.task('build:notimages', [
	'copy_templates',
	'copy_fonts',
	'css',
	'js'
], function(){
	gulp.start('build2');
});

gulp.task('build2', ['rev'], function(){
	return gulp.start('replace_wp');
});

gulp.task('cleanbuild', ['clean_all'], function(){
	gulp.start('master');
});
