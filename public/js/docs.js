$(document).ready(function() {
	_.each($("#page-content-wrapper h2, #page-content-wrapper h4"), function(tag) {
		var html = (tag.tagName === "H2") ? "<H6>" + tag.innerHTML + "</H6>" : tag.innerHTML;
		$("#sidebar-wrapper .sidebar-nav").append("<li><a href='#" + tag.id + "'>" + html + "</a></li>");
	});

	Gifffer();

});

$(window).on("load", function() {
	// scroll to anchors only after images have loaded
	if (window.location.hash) {
		$('html,body').animate({scrollTop: $(window.location.hash).offset().top},'slow');
	}
});