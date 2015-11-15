<!doctype html>
<html lang="en-GB">
	<head>
		<meta charset="utf-8">
		<meta http-equiv="x-ua-compatible" content="ie=edge">
		<?php
		$pageTitle = wp_title( '', false );
		$pageTitle .= ( wp_title( '', false ) ) ? ' : ' : '';
		$pageTitle .= get_bloginfo( 'name' );
		$pageTitle = trim( $pageTitle );
		?>
		<title><?=$pageTitle?></title>
		<meta name="description" content="">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<?php wp_head(); ?>
		<link rel="stylesheet" href="assets/css/main.css">

		<!--[if lt IE 9]>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/es5-shim/4.3.1/es5-shim.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/es5-shim/4.3.1/es5-sham.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/html5shiv/3.7.3/html5shiv.min.js"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/respond.js/1.4.2/respond.min.js"></script>
		<![endif]-->
	</head>
	<body>