/**
 * @preserve
 * FullCalendar v@VERSION
 * http://arshaw.com/fullcalendar/
 *
 * with some adaptations for joomla gcalendar component
 * http://github.com/tpruvot/fullcalendar
 *
 * Use fullcalendar.css for basic styling.
 * For event drag & drop, requires jQuery UI draggable.
 * For event resizing, requires jQuery UI resizable.
 *
 * Copyright (c) 2010 Adam Shaw
 * Dual licensed under the MIT and GPL licenses, located in
 * MIT-LICENSE.txt and GPL-LICENSE.txt respectively.
 *
 * Date: @DATE
 *
 */
 
(function($, undefined) {

var msie9 = false;

//IE9 dnd fix (jQuery UI Mouse (<= 1.8.5) doesnt support IE9)
if ($.ui && $.browser.msie && parseInt($.browser.version,10) >= 9) {
	msie9 = true;
	var mm=$.ui.mouse.prototype._mouseMove;
	$.ui.mouse.prototype._mouseMove=function(b){b.button=1;mm.apply(this,[b]);}
}

