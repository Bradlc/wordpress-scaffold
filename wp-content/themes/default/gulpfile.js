var gulp = require('gulp'),
    gutil = require('gulp-util'),
    plumber = require('gulp-plumber'),
    notify = require('gulp-notify'),
    concat = require('gulp-concat'),
    replace = require('gulp-replace'),
    rename = require('gulp-rename'),
    stylus = require('gulp-stylus'),
    autoprefixer = require('gulp-autoprefixer'),
    minifyCss = require('gulp-minify-css'),
    uglify = require('gulp-uglify'),
    sourcemaps = require('gulp-sourcemaps'),
    imagemin = require('gulp-imagemin'),
    watch = require('gulp-watch'),
    rev = require('gulp-rev'),
    revReplace = require('gulp-rev-replace'),
    cssRef = require('gulp-rev-css-url'),
    reference = require('gulp-reference'),

    fs = require('fs'),
    del = require('del'),
    through = require('through2'),
    path = require('path'),
    spawn = require('child_process').spawn,

    vinylPaths = require('vinyl-paths'),

    livereload = require('gulp-livereload'),

    webpack = require('webpack');

/*----------------------------*\
	Load options from package file
\*----------------------------*/
var pkg = require('./package.json');

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
	gulp.src('./assets/**/*.{css,js,png,jpg,jpeg,gif,webp,svg,ico,eot,ttf,woff,woff2}')
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
	return gulp.src('./src/styl/main.styl')
		.pipe(plumber({
			errorHandler: notify.onError({
				title: 'CSS Error',
				message: '<%= error.message %>',
				icon: 'http://littleblackboxdev.co.uk/gulp-logo.png'
			})
		}))
		.pipe(stylus({compress:false, url:'embedurl'}))
		.pipe(autoprefixer())
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
	JavaScript
\*----------------------------*/
gulp.task( 'webpack', ['clean_js'], function( callback ) {
	// run webpack
	webpack( {
		context: __dirname + '/src/js',
		entry: './main.js',
		output: {
			path: __dirname + '/assets/js',
			filename: 'main.js'
		},
		module: {
			loaders: [
				{
					test: /\.jsx?$/,
					exclude: /(node_modules|bower_components)/,
					loader: 'babel-loader',
					query: {
						'presets': ['es2015']
					}
				}
			]
		}
	}, function( err, stats ) {
		if( err ) throw new gutil.PluginError( 'webpack', err );
		gutil.log( '[webpack]', stats.toString( {
			colors: true
		} ) );
		callback();
	} );
} );

if(pkg.es2015) {

	gulp.task('js', ['webpack'], function(){
		return gulp.src('assets/js/main.js')
			.pipe(uglify())
			.pipe(gulp.dest('assets/js'));
	});

} else {

	gulp.task('js', ['clean_js'], function(){
		return gulp.src('./src/js/main.js')
			.pipe(plumber({
				errorHandler: notify.onError({
					title: 'JavaScript Error',
					message: '<%= error.message %>',
					icon: 'http://littleblackboxdev.co.uk/gulp-logo.png'
				})
			}))
			.pipe(sourcemaps.init())
			.pipe(reference())
			.pipe(uglify())
			.pipe(sourcemaps.write('.', {sourceRoot:'./src/js'}))
			.pipe(gulp.dest('./assets/js'));
	});

}

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
	File revisioning
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
gulp.task('default', ['cleanbuild'], function(){
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
