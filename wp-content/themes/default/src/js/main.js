requirejs.config({
	'paths': {
		'jquery': 'https://cdnjs.cloudflare.com/ajax/libs/jquery/1.11.3/jquery.min',
		'flickity': 'https://cdnjs.cloudflare.com/ajax/libs/flickity/1.1.0/flickity.pkgd.min'
	}
});

require(['r'], function(r){

	var flickityEl = document.querySelectorAll('.js-flickity');
	
	if(flickityEl.length){

		require(['flickity'], function(Flickity){

			var flickityExample = new Flickity(flickityEl[0], {
				cellSelector: '.cell'
			});

		});

	}

});