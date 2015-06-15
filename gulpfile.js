var gulp = require('gulp'),
	concat = require('gulp-concat'),
	replace = require('gulp-replace'),
	stylus = require('gulp-stylus'),
	minifyCss = require('gulp-minify-css'),
	uglify = require('gulp-uglify'),
	imagemin = require('gulp-imagemin'),
	watch = require('gulp-watch'),
	rev = require('gulp-rev'),
	revReplace = require('gulp-rev-replace'),
	cssRef = require('gulp-rev-css-url'),

	filter = require('gulp-filter'),
	fs = require('fs'),
	through = require('through2'),
	path = require('path'),
	spawn = require('child_process').spawn;

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
	Compile Stylus
\*----------------------------*/
gulp.task('css', function(){
	return gulp.src(pkg.css_files)
		.pipe(concat('main.styl'))
		.pipe(stylus({compress:false, url:'embedurl'}))
		.pipe(minifyCss())
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
	Uglify JavaScript
\*----------------------------*/
gulp.task('uglify', function(){
	return gulp.src(pkg.js_files)
		.pipe(concat('main.js'))
		.pipe(uglify())
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
		.pipe(replace('assets/', '<?=get_template_directory_uri()?>/assets/'))
		.pipe(gulp.dest('.'));
});

/*----------------------------*\
	Remove extension from RequireJS file
\*----------------------------*/
gulp.task('requirejs', function(){
	return gulp.src('footer.php')
		.pipe(replace(/<script data-src="([^ ]+)\.js"/, '<script data-src="$1"'))
		.pipe(gulp.dest('.'));
});

/*----------------------------*\
	File revisioning for images, CSS, JS (add fonts??)
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
	return gulp.src(['assets/images/**/*', 'assets/css/*', 'assets/js/*'], {base: path.join(process.cwd(), 'assets')})
	.pipe(filter(function(file){
		// only files that haven't already been revisioned
		return !( /-[a-z0-9]{8,10}\./.test(file.path) );
	}))
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
gulp.task('watch', function(){
	watch('./src/**/*', function(){
		gulp.start('build');
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
	restart();
});

/*----------------------------*\
	Build
\*----------------------------*/
gulp.task('build', [
	'images',
	'copy_templates',
	'copy_fonts',
	'css',
	'uglify'
], function(){
	gulp.start('build2');
});

gulp.task('build2', ['rev'], function(){
	return gulp.start('build3');
});

gulp.task('build3', ['replace_wp'], function(){
	return gulp.start('requirejs');
});

