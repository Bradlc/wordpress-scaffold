var gulp = require('gulp'),
	concat = require('gulp-concat'),
	replace = require('gulp-replace'),
	rename = require('gulp-rename'),
	stylus = require('gulp-stylus'),
	autoprefixer = require('gulp-autoprefixer'),
	minifyCss = require('gulp-minify-css'),
	uglify = require('gulp-uglify'),
	imagemin = require('gulp-imagemin'),
	watch = require('gulp-watch'),
	rev = require('gulp-rev'),
	revReplace = require('gulp-rev-replace'),
	cssRef = require('gulp-rev-css-url'),

	filter = require('gulp-filter'),
	fs = require('fs'),
	del = require('del'),
	through = require('through2'),
	path = require('path'),
	spawn = require('child_process').spawn,

	browserify = require('browserify'),
	vinylPaths = require('vinyl-paths'),
	source = require('vinyl-source-stream'),
	buffer = require('vinyl-buffer'),

	rjs = require('amd-optimize');

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
	gulp.src('./assets/**/*.{css,js,png,jpg,jpeg,gif,svg,ico}')
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
		.pipe(concat('main.styl'))
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
gulp.task('js', ['clean_js'], function(){
	if(pkg.browserify === true){
		return browserify(pkg.js_files[0])
		    .bundle()
		    .pipe(source('main.js'))
		    .pipe(buffer())
		    .pipe(uglify())
		    .pipe(gulp.dest('./assets/js/'));
	} else if(pkg.requirejs === true){
		return gulp.src('./src/js/**/*.js')
			.pipe(rjs('main', {
				name: 'main',
				configFile: './src/js/main.js',
				baseUrl: './src/js',
				paths: pkg.rjs_paths
			}))
			.pipe(concat('main.js'))
			.pipe(uglify())
			.pipe(gulp.dest('./assets/js'))
	} else {
		return gulp.src(pkg.js_files)
			.pipe(concat('main.js'))
			.pipe(uglify())
			.pipe(gulp.dest('./assets/js'));
	}
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
		.pipe(replace(/(["'])assets\//, '$1<?=get_template_directory_uri()?>/assets/'))
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
	/*.pipe(filter(function(file){
		
		return !( /-[a-z0-9]{8,10}\./.test(file.path) );
	}))*/
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
gulp.task('watch', ['cleanbuild'], function(){
	watch('./src/styl/**/*', function(){
		gulp.start('build:css');
	});
	watch('./src/js/**/*', function(){
		gulp.start('build:js');
	});
	watch('./src/fonts/**/*', function(){
		gulp.start('build:fonts');
	});
	watch('./src/images/**/*', function(){
		gulp.start('build:images');
	});
	watch('./src/templates/**/*', function(){
		gulp.start('build:templates');
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
	CSS
\*----------------------------*/
gulp.task('build:css', ['unrev'], function(){
	gulp.start('build:css2');
});
gulp.task('build:css2', ['copy_templates', 'css'], function(){
	gulp.start('build2');
});

/*----------------------------*\
	JS
\*----------------------------*/
gulp.task('build:js', ['unrev'], function(){
	gulp.start('build:js2');
});
gulp.task('build:js2', ['copy_templates', 'js'], function(){
	gulp.start('build2');
});

/*----------------------------*\
	Fonts
\*----------------------------*/
gulp.task('build:fonts', ['unrev'], function(){
	gulp.start('build:fonts2');
});
gulp.task('build:fonts2', ['copy_fonts'], function(){
	gulp.start('build2');
});

/*----------------------------*\
	Images
\*----------------------------*/
gulp.task('build:images', ['unrev'], function(){
	gulp.start('build:images2');
});
gulp.task('build:images2', ['copy_templates', 'images'], function(){
	gulp.start('build2');
});

/*----------------------------*\
	Templates
\*----------------------------*/
gulp.task('build:templates', ['unrev'], function(){
	gulp.start('build:templates2');
});
gulp.task('build:templates2', ['copy_templates'], function(){
	gulp.start('build2');
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

gulp.task('build2', ['rev'], function(){
	return gulp.start('replace_wp');
});

gulp.task('build3', ['replace_wp'], function(){
	return gulp.start('requirejs');
});

gulp.task('cleanbuild', ['clean_all'], function(){
	gulp.start('master');
});
