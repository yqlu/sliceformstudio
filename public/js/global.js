// navbar javascript
(function($) {
	$(function() {
		$('ul.nav.navbar-nav > li').each(function(){
			wid = $(this).width();
			if (wid > 0) {
				$(this).css('width', wid + 'px');
			}
		});
	});
})($);
// google analytics javascript

if (window.location.hostname !== "localhost") {
	(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
	(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
	m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
	})(window,document,'script','//www.google-analytics.com/analytics.js','ga');
	ga('create', 'UA-60124639-1', 'auto');
	ga('send', 'pageview');
}

