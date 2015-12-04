$(document).ready(function() {
	_.each($("#page-content-wrapper h2, #page-content-wrapper h4"), function(tag) {
		var html = (tag.tagName === "H2") ? "<H6>" + tag.innerHTML + "</H6>" : tag.innerHTML;
		$("#sidebar-wrapper .sidebar-nav").append("<li><a href='#" + tag.id + "'>" + html + "</a></li>");
	});

	Gifffer();
});