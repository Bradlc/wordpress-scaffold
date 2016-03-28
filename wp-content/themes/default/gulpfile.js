var gulp = require( 'gulp' );
var gutil = require( 'gulp-util' );
var watch = require( 'gulp-watch' );
var plumber = require( 'gulp-plumber' );
var notify = require( 'gulp-notify' );
var concat = require( 'gulp-concat' );
var replace = require( 'gulp-replace' );
var rename = require( 'gulp-rename' );
var stylus = require( 'gulp-stylus' );
var postcss = require( 'gulp-postcss' );
var autoprefixer = require( 'autoprefixer' );
var cleanCSS = require( 'gulp-clean-css' );
var uglify = require( 'gulp-uglify' );
var inline = require( 'gulp-inline-source' );
var sourcemaps = require( 'gulp-sourcemaps' );
var imagemin = require( 'gulp-imagemin' );
var rev = require( 'gulp-rev' );
var revReplace = require( 'gulp-rev-replace' );
var cssRef = require( 'gulp-rev-css-url' );

var svgmin = require( 'gulp-svgmin' );
var svgstore = require( 'gulp-svgstore' );

var fs = require( 'fs' );
var del = require( 'del' );
var through = require( 'through2' );
var path = require( 'path' );
var spawn = require( 'child_process' ).spawn;

var vinylPaths = require( 'vinyl-paths' );

var livereload = require( 'gulp-livereload' );

var webpack = require( 'webpack' );

/*----------------------------*\
	Load options from package file
\*----------------------------*/
var pkg = require( './package.json' );

/*----------------------------*\
	Clean
\*----------------------------*/
gulp.task( 'clean_css', function( cb ) {
	del( ['./assets/css/*'], cb );
} );
gulp.task( 'clean_js', function( cb ) {
	del( ['./assets/js/*'], cb );
} );
gulp.task( 'clean_all', function( cb ) {
	del( ['./assets/**/*'], cb );
} );

gulp.task( 'unrev', function( cb ) {
	var vp = vinylPaths();
	gulp.src( './assets/**/*.{css,js,png,jpg,jpeg,gif,webp,svg,ico,eot,ttf,woff,woff2}' )
	.pipe( vp )
	.pipe( rename( function( path ) {
		path.basename = path.basename.replace( /-[a-zA-Z0-9]{8,10}$/, '' );
	} ) )
	.pipe( gulp.dest( './assets' ) )
	.on( 'end', function() {
		if( vp.paths ) {
			del( vp.paths, cb );
		}
	} );
} );

/*----------------------------*\
	Compile Stylus
\*----------------------------*/
gulp.task( 'css', ['clean_css'], function() {
	return gulp.src( './src/styl/main.styl' )
	.pipe( plumber( {
		errorHandler: notify.onError( {
			title: 'CSS Error',
			message: '<%= error.message %>',
			icon: 'http://littleblackboxdev.co.uk/gulp-logo.png'
		} )
	} ) )
	.pipe( stylus( {compress: false, url: 'embedurl'} ) )
	.pipe( postcss( [ autoprefixer() ] ) )
	.pipe( cleanCSS() )
	.pipe( gulp.dest( './assets/css' ) );
} );

/*----------------------------*\
	Icons
\*----------------------------*/
gulp.task( 'icons', function() {

	return gulp.src( './src/icons/*.svg' )
	.pipe( rename( {prefix: 'icon-'} ) )
	.pipe( svgmin() )
	.pipe( svgstore( {inlineSvg: true} ) )
	.pipe( gulp.dest( './assets/images' ) );

} );


/*----------------------------*\
	Optimize images
\*----------------------------*/
gulp.task( 'images', function() {
	return gulp.src( './src/images/**' )
	.pipe( imagemin( {progressive: true} ) )
	.pipe( gulp.dest( './assets/images' ) );
} );

/*----------------------------*\
	JavaScript
\*----------------------------*/
gulp.task( 'webpack', ['clean_js'], function( cb ) {
	// run webpack
	webpack( {
		context: __dirname + '/src/js',
		entry: './main.js',
		output: {
			path: __dirname + '/assets/js',
			filename: 'main.js'
		},
		devtool: '#inline-source-map',
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
		cb();
	} );
} );

gulp.task( 'js', ['webpack'], function() {
	return gulp.src( 'assets/js/main.js' )
	.pipe( sourcemaps.init( {loadMaps: true} ) )
	.pipe( uglify() )
	.pipe( sourcemaps.write( '.' ) )
	.pipe( gulp.dest( 'assets/js' ) );
} );


gulp.task( 'copy_fonts', function() {
	return gulp.src( './src/fonts/*' )
	.pipe( gulp.dest('./assets/fonts' ) );
} );
gulp.task( 'copy_templates', function() {
	return gulp.src( './src/templates/*' )
	.pipe( gulp.dest( '.' ) );
} );


gulp.task( 'pre_inline', function() {
	return gulp.src( './assets/css/*' )
	.pipe( replace( /url\(\.\./g, 'url(<?=get_template_directory_uri()?>/assets' ) )
	.pipe( gulp.dest( './assets/css' ) );
} );

gulp.task( 'inline', ['pre_inline'], function() {
	return gulp.src( ['./header.php', './footer.php'] )
	.pipe( inline( {compress: false} ) )
	.pipe( gulp.dest( '.' ) );
} );

/*----------------------------*\
	Prefix assets with Wordpress template directory
\*----------------------------*/
gulp.task( 'replace_wp', ['inline'], function() {
	return gulp.src( './*.php' )
	.pipe( replace( /(["'])assets\//g, '$1<?=get_template_directory_uri()?>/assets/' ) )
	.pipe( gulp.dest( '.' ) )
	.on( 'end', function() {
		livereload.reload();
	} );
} );

/*----------------------------*\
	File revisioning
\*----------------------------*/
// Remove originals
var rmOrig = function() {
	return through.obj( function( file, enc, cb ) {
		if( file.revOrigPath ) {
			fs.unlink( file.revOrigPath, function( err ) {
			} );
		}
		this.push( file );
		return cb();
	} );
};

// Save revisioned files, removing originals
gulp.task( 'revision', function() {
	return gulp.src( pkg.revision, {base: path.join( process.cwd(), 'assets' ) } )
	.pipe( rev() )
	.pipe( cssRef() ) // replace references in CSS
	.pipe( gulp.dest( './assets' ) )
	.pipe( rmOrig() ) // remove originals
	.pipe( rev.manifest( {merge: true} ) ) // save manifest
	.pipe( gulp.dest( './assets' ) );
} );

// Replace references to files
gulp.task( 'rev', ['revision'], function() {
	var manifest = gulp.src( './assets/rev-manifest.json' );

	return gulp.src( './*.php' )
	.pipe( revReplace( {
		manifest: manifest,
		replaceInExtensions: ['.php']
	} ) )
	.pipe( gulp.dest( '.' ) );
} );

/*----------------------------*\
	File watcher
\*----------------------------*/
gulp.task( 'default', ['cleanbuild'], function() {

	livereload.listen();

	watch( ['./src/styl/**/*', './src/js/**/*', './src/fonts/**/*', './src/icons/**/*', './src/templates/**/*'], function() {
			gulp.start( 'master:notimages' );
		} );

	watch( ['./src/images/**/*'], function() {
		gulp.start( 'master' );
	} );

} );




gulp.task( 'master', ['unrev'], function() {
	gulp.start( 'build' );
} );

gulp.task( 'build', ['images', 'icons', 'copy_templates', 'copy_fonts', 'css', 'js'], function() {
	gulp.start( 'build2' );
} );

gulp.task( 'master:notimages', ['unrev'], function() {
	gulp.start( 'build:notimages' );
} );

gulp.task( 'build:notimages', ['icons', 'copy_templates', 'copy_fonts', 'css', 'js'], function() {
	gulp.start( 'build2' );
} );

gulp.task( 'build2', ['rev'], function() {
	return gulp.start( 'replace_wp' );
} );

gulp.task( 'cleanbuild', ['clean_all'], function() {
	gulp.start( 'master' );
} );
