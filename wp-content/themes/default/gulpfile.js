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

var vinylPaths = require( 'vinyl-paths' );

var browserSync = require( 'browser-sync' ).create();

var eslint = require( 'gulp-eslint' );
var webpack = require( 'webpack' );

var argv = require( 'yargs' ).argv;
var gulpif = require( 'gulp-if' );

/*----------------------------*\
	Clean
\*----------------------------*/
gulp.task( 'clean_css', ['unrev'], function( cb ) {
	del( ['./assets/css/*'], cb );
} );
gulp.task( 'clean_js', ['unrev'], function( cb ) {
	del( ['./assets/js/*'], cb );
} );
gulp.task( 'clean_all', function( cb ) {
	del( ['./assets/**/*', './*.php'], cb );
} );

gulp.task( 'unrev', function( cb ) {

	if( !argv.production ) { cb(); return; }

	var vp = vinylPaths();
	gulp.src( ['./assets/**/*.*', '!./assets/rev-manifest.json'] )
	.pipe( plumber() )
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
	.pipe( gulp.dest( './assets/css' ) )
	.pipe( browserSync.stream( {match: '**/*.css'} ) );
} );

/*----------------------------*\
	Icons
\*----------------------------*/
gulp.task( 'icons', ['unrev'], function() {
	return gulp.src( './src/icons/*.svg' )
	.pipe( plumber() )
	.pipe( rename( {prefix: 'icon-'} ) )
	.pipe( svgmin( {plugins: [{removeTitle: true}]} ) )
	.pipe( svgstore( {inlineSvg: true} ) )
	.pipe( gulp.dest( './assets/images' ) )
	.on( 'end', browserSync.reload );
} );


/*----------------------------*\
	Optimize images
\*----------------------------*/
gulp.task( 'images', ['unrev'], function() {
	return gulp.src( './src/images/**' )
	.pipe( plumber() )
	.pipe( imagemin( {progressive: true} ) )
	.pipe( gulp.dest( './assets/images' ) )
	.on( 'end', browserSync.reload );
} );

/*----------------------------*\
	JavaScript
\*----------------------------*/
gulp.task( 'js_lint', ['clean_js'], function() {

	gulp.src( ['./src/js/**/*.js', '!./src/js/vendor/**/*'] )
	.pipe( plumber( {
		errorHandler: notify.onError( {
			title: 'ESLint',
			message: '<%= error.message %>'
		} )
	} ) )
	.pipe( eslint() )
	.pipe( eslint.format() )
	.pipe( eslint.results( function( results ) {
		if( results.warningCount > 0 || results.errorCount > 0 ) {
			throw new gutil.PluginError( {
				plugin: 'ESLint',
				message: results.warningCount + ' warning' + ( results.warningCount !== 1 ? 's' : '' ) + '. ' + results.errorCount + ' error' + ( results.errorCount !== 1 ? 's' : '' ) + '.'
			} );
		}
	} ) );

} );

gulp.task( 'webpack', ['js_lint'], function( cb ) {
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
	.pipe( plumber() )
	.pipe( sourcemaps.init( {loadMaps: true} ) )
	.pipe( uglify() )
	.pipe( sourcemaps.write( '.' ) )
	.pipe( gulp.dest( 'assets/js' ) )
	.on( 'end', browserSync.reload );
} );


gulp.task( 'copy_fonts', ['unrev'], function() {
	return gulp.src( './src/fonts/*' )
	.pipe( plumber() )
	.pipe( gulp.dest('./assets/fonts' ) )
	.on( 'end', browserSync.reload );
} );
gulp.task( 'copy_templates', ['unrev'], function() {
	return gulp.src( './src/templates/*' )
	.pipe( plumber() )
	.pipe( gulp.dest( '.' ) )
	.on( 'end', browserSync.reload );
} );


gulp.task( 'inline', ['rev'], function() {
	return gulp.src( './*.php' )
	.pipe( plumber() )
	.pipe( gulpif( argv.production, inline( {compress: false, handlers: [
		function( source, context, next ) {
			if( source.fileContent && !source.content && ( source.type === 'css' ) ) {
				source.replace = '<style>' + source.fileContent.replace( /url\(\.\./g, 'url(<?=get_template_directory_uri()?>/assets' ) + '</style>';
			}
			next();
		}
	]} ) ) )
	.pipe( gulpif( !argv.production, inline( {compress: false, ignore: ['css']} ) ) )
	.pipe( gulp.dest( '.' ) );
} );

/*----------------------------*\
	Prefix assets with Wordpress template directory
\*----------------------------*/
gulp.task( 'replace_wp', ['inline'], function() {
	return gulp.src( './*.php' )
	.pipe( plumber() )
	.pipe( replace( /(["'])assets\//g, '$1<?=get_template_directory_uri()?>/assets/' ) )
	.pipe( gulp.dest( '.' ) )
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
gulp.task( 'revision', ['assets'], function( cb ) {

	if( !argv.production ) { cb(); return; }

	return gulp.src( ['assets/**/*.*', '!**/*.map', '!assets/rev-manifest.json'], {base: path.join( process.cwd(), 'assets' ) } )
	.pipe( plumber() )
	.pipe( rev() )
	.pipe( cssRef() ) // replace references in CSS
	.pipe( gulp.dest( './assets' ) )
	.pipe( rmOrig() ) // remove originals
	.pipe( rev.manifest( {merge: true} ) ) // save manifest
	.pipe( gulp.dest( './assets' ) );
} );

// Replace references to files
gulp.task( 'rev', ['revision'], function( cb ) {

	if( !argv.production ) { cb(); return; }

	var manifest = gulp.src( './assets/rev-manifest.json' );

	return gulp.src( './*.php' )
	.pipe( plumber() )
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

	if( !argv.production ) {

		browserSync.init( {
			proxy: 'localhost',
			open: 'external'
		} );

		watch( ['./src/styl/**/*'], function() {
			gulp.start( 'css' );
		} );

		watch( ['./src/js/**/*'], function() {
			gulp.start( 'js' );
		} );

		watch( ['./src/fonts/**/*'], function() {
			gulp.start( 'copy_fonts' );
		} );

		watch( ['./src/templates/**/*'], function() {
			gulp.start( 'copy_templates' );
		} );

		watch( ['./src/icons/**/*'], function() {
			gulp.start( 'icons' );
		} );

		watch( ['./src/images/**/*'], function() {
			gulp.start( 'images' );
		} );

	}

} );



gulp.task( 'assets', ['images', 'icons', 'copy_templates', 'copy_fonts', 'css', 'js'] );

/**
 * build
 * unrev -> [images, icons, copy_templates, copy_fonts, css, js] -> rev -> replace_wp
 */

gulp.task( 'build', ['replace_wp'] );

/**
 * cleanbuild
 * clean_all -> build
 */
gulp.task( 'cleanbuild', ['clean_all'], function() {
	gulp.start( 'build' );
} );
