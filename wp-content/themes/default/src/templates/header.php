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
	</head>
	<body>