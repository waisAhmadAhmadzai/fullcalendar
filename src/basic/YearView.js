fcViews.year = YearView;

function YearView(element, calendar) {
	var t = this;

	// exports
	t.render = render;

	// imports
	BasicYearView.call(t, element, calendar, 'year');
	var opt = t.opt;
	var renderYear = t.renderYear;
	var formatDate = calendar.formatDate;
	var moment = calendar.moment;
	var delta;

	function render(date) {
		var firstMonth = opt('firstMonth') || 0;
		var lastMonth = opt('lastMonth') || firstMonth+12;
		var nbMonths = lastMonth - firstMonth;
		var end = date.clone().stripTime().startOf('year');
		end.add('months', lastMonth); end.subtract('days', 1);

		if (t.delta) {
			t.curYear = date.clone().stripTime();//.add('years', t.delta).stripTime();
			t.delta = null;
		}
		// for school years month to year navigation
		else if (firstMonth > 0 && date.month() <= end.month()) {
			t.curYear = date.subtract('year', 1);
		}
		else t.curYear = date.clone().startOf('year').stripTime();
		var start = t.curYear.clone().startOf('year').stripTime();
		start.add('months', firstMonth);
		end = start.clone().stripTime().startOf('year');
		end.add('months', lastMonth); end.subtract('days', 1);

		var weekStart = start.clone().startOf('week');
		var weekEnd = end.clone().endOf('week');

		var monthsPerRow = opt('yearColumns') || 3; //ex: '2x6', '3x4', '4x3'
		var nwe = opt('weekends') ? 0 : 1;

		t.title = formatDate(start, opt('titleFormat'));
		if (firstMonth + nbMonths > 12) {
			t.title += formatDate(end, ' - YYYY');
		}

		t.intervalStart = start;
		t.intervalEnd = end;
		t.start = t.skipHiddenDays(weekStart);
		t.end = t.skipHiddenDays(weekEnd, -1);

		renderYear(monthsPerRow, 6, nwe ? 5 : 7, true);
	}
}

function BasicYearView(element, calendar, viewName) {
	var t = this;

	// exports
	t.incrementDate = incrementDate;
	t.renderYear = renderYear;
	t.setHeight = setHeight;
	t.setWidth = setWidth;
	t.renderDayOverlay = renderDayOverlay;
	t.defaultSelectionEnd = defaultSelectionEnd;
	t.renderSelection = renderSelection;
	t.clearSelection = clearSelection;
	t.reportDayClick = reportDayClick; // for selection (kinda hacky)
	t.defaultEventEnd = defaultEventEnd;
	t.getHoverListener = function() { return hoverListener };
	t.colContentLeft = colContentLeft;
	t.colContentRight = colContentRight;
	t.colLeft = colLeft;
	t.colRight = colRight;
	t.dayOfWeekCol = dayOfWeekCol;
	t.dateCell = dateCell;
	t.allDayRow = allDayRow;
	t.allDayBounds = allDayBounds;
	t.getIsCellAllDay = function() { return true };
	t.getRowCnt = function() { return rowCnt; };
	t.getColCnt = function() { return colCnt; };
	t.getColWidth = function() { return colWidth; };
	t.getBodyRows = function() { return bodyRows; };
	t.getDaySegmentContainer = function() { return daySegmentContainer; };
	t.getRowMaxWidth = getRowMaxWidth;

	View.call(t, element, calendar, viewName);
	OverlayManager.call(t);
	SelectionManager.call(t);

	t.rangeToSegments = rangeToSegmentsYear;
	BasicEventRenderer.call(t);

	t.rowToGridOffset = rowToGridOffset;
	t.dayOffsetToCellOffset = dayOffsetToCellOffset;
	t.cellToCellOffset = cellToCellOffset;
	t.cellOffsetToDayOffset = cellOffsetToDayOffset;

	t.dragStart = dragStart;
	t.dragStop  = dragStop;

	// imports
	var opt = t.opt;
	var trigger = t.trigger;
	var clearEvents = t.clearEvents;
	var renderOverlay = t.renderOverlay;
	var clearOverlays = t.clearOverlays;
	var isHiddenDay = t.isHiddenDay;
	var daySelectionMousedown = t.daySelectionMousedown;

	var moment = calendar.moment;
	var formatDate = calendar.formatDate;
	var getNow = calendar.getNow;

	// locals
	var table;
	var body;
	var bodyRows;

	var mainBody;
	var subTables;

	var bodyCells;
	var bodyCellTopInners;
	var daySegmentContainer;

	var viewWidth;
	var viewHeight;
	var colWidth;

	var rowCnt, colCnt;
	var coordinateGrids = [];
	var coordinateGrid;
	var hoverListener;
	var colContentPositions;
	var otherMonthDays = [];
	var rowsForMonth = [];

	var rtl, dis, dit;
	var firstDay;
	var firstMonth;
	var lastMonth;
	var hiddenMonths;
	var nwe;
	var tm;
	var colFormat;
	var yearCellMinH;

	/* Rendering
	------------------------------------------------------------*/

	disableTextSelection(element.addClass('fc-grid'));

	function incrementDate(date, inc) {
		t.delta = inc;
		return t.curYear.clone().add('years', inc);
	}

	function renderYear(yearColumns, r, c, showNumbers) {
		colCnt = c;
		updateOptions();
		buildCoordGrids();
		var firstTime = !table;
		if (!firstTime) {
			clearEvents();
			table.remove();
		}
		var monthsPerRow = parseInt(yearColumns,10); //"3x4" parses to 3
		buildSkeleton(monthsPerRow, showNumbers);
		updateCells();
	}

	function updateOptions() {
		rtl = opt('isRTL');
		if (rtl) {
			dis = -1;
			dit = colCnt - 1;
		} else {
			dis = 1;
			dit = 0;
		}
		firstDay = opt('firstDay') || t.start.clone().startOf('week').day();
		firstMonth = opt('firstMonth') || 0;
		lastMonth = opt('lastMonth') || firstMonth+12;
		yearCellMinH = opt('yearCellMinH') || 20;
		hiddenMonths = opt('hiddenMonths') || [];
		nwe = opt('weekends') ? 0 : 1;
		tm = opt('theme') ? 'ui' : 'fc';
		colFormat = opt('columnFormat');
	}

	function buildSkeleton(monthsPerRow, showNumbers) {
		var s;
		var headerClass = tm + "-widget-header";
		var contentClass = tm + "-widget-content";
		var i, j, m, n, y, monthsRow = 0;
		var monthName, dayStr;
		var di = t.intervalStart.clone();
		var miYear = di.year();
		var nbMonths = lastMonth-firstMonth;

		rowCnt = 0;
		var localWeekNames = [];
		// init days based on 2013-12 (1st is Sunday)
		for (m=0; m<7; m++) {
			di = moment([2013,11,1+m,12]);
			localWeekNames[m] = formatDate(di, 'ddd');
		}
		di = t.intervalStart.clone();
		s = '<table class="fc-year-main-table fc-border-separate" style="width:100%;"><tr>';
		s += '<td class="fc-year-month-border fc-first"></td>';
		n = 0;
		for (m=firstMonth; m<lastMonth; m++) {

			var hiddenMonth = ($.inArray(m,hiddenMonths) != -1);
			var display = (hiddenMonth ? 'display:none;' : '');

			// Date is required here to get a valid relative date
			di = makeRelativeDate(miYear,m,1);

			y = di.year();
			monthName = formatDate(di, 'MMMM');
			if (firstMonth + nbMonths > 12) {
				monthName = monthName + ' ' + y;
			}

			if (nwe) { skipWeekend(di); }
			var dowFirst = (di.day()+7-firstDay)%7;
			di = makeRelativeDate(miYear,m, -1*dowFirst+1);

			// new month line
			if (n%monthsPerRow==0 && n > 0 && !hiddenMonth) {
				monthsRow++;
				s+='<td class="fc-year-month-border fc-last"></td>'+
					'</tr><tr>'+
					'<td class="fc-year-month-border fc-first"></td>';
			}

			if (n%monthsPerRow < monthsPerRow && n%monthsPerRow > 0 && !hiddenMonth) {
				s +='<td class="fc-year-month-separator"></td>';
			}

			s +='<td class="fc-year-monthly-td" style="' + display + '">';
			s +='<table class="fc-border-separate fc-year-month" style="width:100%;" cellspacing="0">'+
				'<thead>'+
				'<tr><td colspan="7" class="fc-year-monthly-header" />' +
					'<div class="fc-year-monthly-name'+(monthsRow==0 ?' fc-first':'')+'">' +
					'<a data-year="'+y+'" data-month="'+(m%12)+'" href="#">' +
					htmlEscape(monthName) + '</a>' +
					'</div>' +
				'</td></tr>' +
				'<tr>';

			var decal = firstDay;
			if (nwe && firstDay==0) decal++;
			if (nwe && firstDay==6) decal+=2;
			for (i=decal; i<colCnt+decal; i++) {
				// need fc- for setDayID
				s += '<th class="fc-year-weekly-head fc-'+dayIDs[i%7]+' '+headerClass+'" width="'+((100/colCnt)|0)+'%">'+
				 localWeekNames[i%7]+'</th>';
			}
			s += '</tr></thead><tbody>';

			rowsForMonth[m] = 0;
			for (i=0; i<6; i++) {
				if (nwe) {
					skipWeekend(di);
				}
				// don't show week if all days are in next month
				if (di.month() == (m+1)%12 && opt('weekMode') != 'fixed') {
					continue;
				}
				rowsForMonth[m]++;
				rowCnt++;

				s += '<tr class="fc-week' + i + '">';
				for (j=0; j<colCnt; j++) {
					if (di.month() == (m%12)) {
						dayStr=formatDate(di, '-YYYY-MM-DD');
					} else {
						dayStr='';
					}
					s += '<td class="'+contentClass+' fc-day fc-'+dayIDs[di.day()]+' fc-day'+dayStr + '">' + // need fc- for setDayID
					'<div>' +
						(showNumbers ? '<div class="fc-day-number"/>' : '') +
						'<div class="fc-day-content" style="min-height:'+yearCellMinH+'px;">' +
							'<div style="position:relative;"></div>' +
						'</div>' +
					'</div>' +
					'</td>';
					addDays(di, 1);
				}
				if (nwe) {
					skipWeekend(di);
				}
				s += '</tr>';
			}
			s += '</tbody></table>';
			s += '<div class="fc-year-monthly-footer"></div>';
			s += '</td>';

			if (!hiddenMonth) n++;
		}
		s += '<td class="fc-year-month-border fc-last"></td>';
		s += '</tr></table>';

		table = $(s).appendTo(element);
		head = table.find('thead');
		headCells = head.find('th.fc-year-weekly-head');

		bodyRows = table.find('table tbody tr');
		bodyCells = bodyRows.find('td').not('.fc-year-monthly-td');
		bodyFirstCells = bodyCells.filter(':first-child');

		subTables = table.find('table');
		subTables.find('tbody .fc-week0').addClass('fc-first');
		subTables.find('tbody > tr:last').addClass('fc-last');

		bodyCellTopInners = subTables.find('tbody .fc-week0 .fc-day-content div');

		markFirstLast(head.add(head.find('tr'))); // marks first+last tr/th's
		markFirstLast(bodyRows);

		table.find('.fc-year-monthly-name a').click(function() {
			calendar.changeView('month');
			calendar.gotoDate($(this).attr('data-year'), $(this).attr('data-month'), 1);
		});

		dayBind(bodyCells);
		daySegmentContainer = $('<div style="position:absolute;z-index:8;top:0;left:0;"/>').appendTo(element);
	}

	/**
	 * Compute otherMonthDays, set fc-today and day numbers
	 */
	function updateCells() {
		var startYear = t.intervalStart.year();
		var today = getNow().stripTime();
		var cell, date, row;

		subTables.each(function(i, _sub) {
			if (!t.curYear) t.curYear = t.intervalStart;

			var miYear = t.curYear.year();
			var mi = i+firstMonth;
			var d = makeRelativeDate(miYear, mi, 1);

			if (nwe) { skipWeekend(d); }

			var dowFirst = (d.day()+7-firstDay)%7;
			var lastDateShown = 0;
			d = makeRelativeDate(miYear, mi, -1 * dowFirst+1);

			otherMonthDays[mi] = [0,0,0,0];
			$(_sub).find('tbody > tr').each(function(iii, _tr) {
				if (nwe) { skipWeekend(d); }
				if (iii == 0 && dateInMonth(d,mi) ) {
					// in current month, but hidden (weekends) at start
					otherMonthDays[mi][2] = d.date()-1;
				}
				$(_tr).find('td').each(function(ii, _cell) {

					cell = $(_cell);

					if (!dateInMonth(d,mi)) {
						cell.addClass('fc-other-month');
						if (d.month() == (mi+11)%12) {
							// prev month
							otherMonthDays[mi][0]++;
						} else {
							// next month
							otherMonthDays[mi][1]++;
						}
					}
					if (today.isSame(d, 'day')) {
						cell.addClass(tm + '-state-highlight fc-today');
					} else {
						cell.addClass((+d < +today) ? 'fc-past' : 'fc-future');
					}
					var $div = cell.find('div.fc-day-number');
					$div.text(d.date());

					if (dateInMonth(d,mi)) lastDateShown = d.date();
					addDays(d, 1);
				});
				if (nwe) { skipWeekend(d); }
			});

			var endDaysHidden = daysInMonth(t.curYear.year(), mi+1) - lastDateShown;
			// in current month, but hidden (weekends) at end
			otherMonthDays[mi][3] = endDaysHidden;
		});
		bodyRows.filter('.fc-year-have-event').removeClass('fc-year-have-event');
	}

	function setHeight(height) {
		//not sure what supposed to do
	}

	function setWidth(width) {
		viewWidth = width;
		colContentPositions.clear();
	}


	/* Day clicking and binding
	-----------------------------------------------------------*/

	function dayBind(days) {
		days.click(dayClick).mousedown(daySelectionMousedown);
	}

	function dayClick(ev) {
		if (!opt('selectable')) { // if selectable, SelectionManager will worry about dayClick
			var match = this.className.match(/fc\-day\-(\d+)\-(\d+)\-(\d+)/);
			if (match != null) {
				var date = moment([match[1], match[2]-1, match[3]], 12);
				trigger('dayClick', this, date, true, ev);
			}
		}
	}


	/* Semi-transparent Overlay Helpers
	------------------------------------------------------*/

	function renderDayOverlay(overlayStart, overlayEnd, refreshCoordinateGrid) { // overlayEnd is exclusive

		if (!isFinite(overlayStart))
			return;

		var rowStart = t.start.clone();
		var row = 0;
		var offset = (overlayStart.month() - t.intervalStart.month() + 12) % 12;
		coordinateGrid = coordinateGrids[offset];
		if (refreshCoordinateGrid) {
			coordinateGrid.build();
		}

		subTables.each(function(m, _sub) {
			var d = t.curYear.clone();
			var mo = m+firstMonth;
			var moYear = d.year();
			d = makeRelativeDate(moYear, mo, 1);

			if (nwe) { skipWeekend(d); }
			var dowFirst = (d.day()+7-firstDay)%7;
			d = makeRelativeDate(moYear, mo, -1 * dowFirst+1);

			$(_sub).find('tbody > tr').each(function(iii, _tr) {

				if (nwe) { skipWeekend(d); }

				var curCols = colCnt;
				var rowStart = d.clone();
				while (rowStart.month() != mo%12) {
					addDays(rowStart, 1);
					curCols--;
				}

				var rowEnd = rowStart.clone();
				for (i = 0; i < curCols; i++) {
					addDays(rowEnd, 1);
					if (rowEnd.month() > rowStart.month()) {
						break;
					}
				}

				var stretchStart = moment(Math.max(+rowStart, +overlayStart));
				var stretchEnd = moment(Math.min(+rowEnd, +overlayEnd));
				if (stretchStart < stretchEnd) {
					var colStart, colEnd;
					if (rtl) {
						colStart = dayDiff(stretchEnd, d)*dis+dit+1;
						colEnd = dayDiff(stretchStart, d)*dis+dit+1;
					} else {
						colStart = dayDiff(stretchStart, d);
						colEnd = dayDiff(stretchEnd, d);
					}
					var grid = coordinateGrids[m];
					dayBind(
						renderCellOverlay(grid, iii, colStart, iii, colEnd-1)
					);
				}
				row += 1;
				addDays(d, 5);
				if (nwe) { skipWeekend(d); } else { addDays(d, 2); }
			});
		});
	}

	function renderCellOverlay(grid, row0, col0, row1, col1) { // row1,col1 is inclusive
		var rect = grid.rect(row0, col0, row1, col1, element);
		return renderOverlay(rect, element);
	}

	function getRowMaxWidth(row) {
		return $(subTables[(row/5)|0]).width();
	}

	/* Selection
	-----------------------------------------------------------------------*/

	function defaultSelectionEnd(startDate, allDay) {
		return startDate.clone();
	}

	function renderSelection(startDate, endDate, allDay) {
		renderDayOverlay(startDate, addDays(endDate.clone(), 1), true); // rebuild every time???
	}

	function clearSelection() {
		clearOverlays();
	}

	function reportDayClick(date, allDay, ev) {
		var cell = dateCell(date);
		var _element = bodyCells[cell.row*colCnt + cell.col];
		trigger('dayClick', _element, date, allDay, ev);
	}


	/* External Dragging
	-----------------------------------------------------------------------*/
	function dragStart(_dragElement, ev, ui) {
		hoverListener.start(function(cell) {
			clearOverlays();
			if (cell) {
				renderCellOverlay(cell.grid, cell.row, cell.col, cell.row, cell.col);
			}
		}, ev);
	}

	function dragStop(_dragElement, ev, ui) {
		var cell = hoverListener.stop();
		clearOverlays();
		if (cell) {
			var offset = cellToCellOffset(cell);
			var dayOffset = cellOffsetToDayOffset(offset);
			var d = dayOffsetToDate(dayOffset);
			trigger('drop', _dragElement, d, true, ev, ui);
		}
	}


	/* 1.x Compat
	--------------------------------------------------------*/

	function addDays(date, count) {
		return date.add('days', count);
	}

	function addYears(date, count) {
		return date.add('years', count);
	}

	function dayDiff(date, date2) {
		return date.diff(date2, 'days');
	}


	/* Utilities
	--------------------------------------------------------*/

	/* allow months > 11 and negative days */
	function makeRelativeDate(y,m,d) {
		var date = new Date(y,m,d,12);
		return moment(date.toISOString()).stripTime();
	}

	function cellsForMonth(i) {
		return rowsForMonth[i] * (nwe ? 5 : 7);
	}

	function skipWeekend(date, inc, excl) {
		inc = inc || 1;
		while (!date.day() || (excl && date.day()==1 || !excl && date.day()==6)) {
			addDays(date, inc);
		}
		return date;
	}

	/* main function for event's position */
	function dayOffsetToCellOffset(dOffset) {
		var i, j, offset = 0;
		var dayOffset = dOffset - otherMonthDays[firstMonth][0];

		for (i=firstMonth; i<lastMonth; i++) {

			var moDays = daysInMonth(t.curYear.year(), i+1);
			var di = makeRelativeDate(t.curYear.year(), i, 1);

			if (dayOffset < moDays) {
				offset += otherMonthDays[i][0]; //days in other month at beginning of month;

				for (j = 0; j < dayOffset; j++) {
					if (!nwe || !isHiddenDay(di)) {
						offset += 1;
					}
					addDays(di, 1);
				}
				return offset;
			}
			if (i == lastMonth-1) {
				// on last month, allow overflow
				return (offset + dayOffset);
			}
			dayOffset -= moDays;
			offset += cellsForMonth(i);
		}
	}

	function cellToCellOffset(row, col) {
		var colCnt = t.getColCnt();
		var grid = null;

		// rtl variables. wish we could pre-populate these. but where?
		var dis = rtl ? -1 : 1;
		var dit = rtl ? colCnt - 1 : 0;

		if (typeof row == 'object') {
			grid = row.grid;
			col = row.col;
			row = row.row;
		}

		var offset = 0;
		for (var i = 0; i < grid.offset; i++) {
			offset += cellsForMonth(i+firstMonth);
		}

		offset += row * colCnt + (col * dis + dit); // column, adjusted for RTL (dis & dit)

		return offset;
	}

	/* handle selectable days clicks */
	function cellOffsetToDayOffset(cellOffset) {
		var offset = otherMonthDays[firstMonth][0];
		for (var i=firstMonth; i<lastMonth; i++) {
			var moDays = daysInMonth(t.curYear.year(), i+1);
			var moCellDays = cellsForMonth(i);
			if (cellOffset < moCellDays) {

				cellOffset -= otherMonthDays[i][0];
				offset += otherMonthDays[i][2];
				var di = makeRelativeDate(
					t.curYear.year(), i, 1+otherMonthDays[i][2]
				);
				while (cellOffset > 0) {
					addDays(di, 1);
					if (!nwe || !isHiddenDay(di)) {
						cellOffset -= 1;
					}
					offset += 1;
				}
				return offset;
			}

			cellOffset -= moCellDays;
			offset += moDays;
		}
	}

	// day offset -> date (JavaScript Date object)
	function dayOffsetToDate(dayOffset) {
		var date = t.start.clone();
		addDays(date, dayOffset);
		return date;
	}

	// required to fix events on last month day
	function rangeToSegmentsYear(startDate, endDate) {
		var rowCnt = t.getRowCnt();
		var colCnt = t.getColCnt();
		var segments = []; // array of segments to return

		var realEnd = endDate.clone();
		addDays(realEnd,-1);

		// ignore events outside current view
		if (realEnd < t.start || startDate > t.end) return segments;

		// day offset for given date range
		var rangeDayOffsetStart = t.dateToDayOffset(startDate);
		var rangeDayOffsetEnd = t.dateToDayOffset(endDate); // exclusive

		// in day events
		if (rangeDayOffsetEnd == rangeDayOffsetStart) rangeDayOffsetEnd++;

		// if ends in weekend, dont create a new segment
		if (nwe && isHiddenDay(realEnd)) {
			skipWeekend(realEnd,-1);
			addDays(realEnd,1);
			rangeDayOffsetEnd = t.dateToDayOffset(realEnd);
		}

		// first and last cell offset for the given date range
		// "last" implies inclusivity
		var rangeCellOffsetFirst = t.dayOffsetToCellOffset(rangeDayOffsetStart);
		var rangeCellOffsetLast = t.dayOffsetToCellOffset(rangeDayOffsetEnd - 1);

		var isStart, isEnd = false;

		// loop through all the rows in the view
		for (var row=0; row<rowCnt; row++) {

			// first and last cell offset for the row
			var rowCellOffsetFirst = row * colCnt;
			var rowCellOffsetLast = rowCellOffsetFirst + colCnt - 1;

			// get the segment's cell offsets by constraining the range's cell offsets to the bounds of the row
			var segmentCellOffsetFirst = Math.max(rangeCellOffsetFirst, rowCellOffsetFirst);
			var segmentCellOffsetLast = Math.min(rangeCellOffsetLast, rowCellOffsetLast);

			// make sure segment's offsets are valid and in view
			if (segmentCellOffsetFirst <= segmentCellOffsetLast) {

				var gridOffset = t.rowToGridOffset(row);
				var gridRow = rowToGridRow(row);
				var lenBefore = segmentCellOffsetFirst - rangeCellOffsetFirst;
				var skipSegment = false;

				// segment in next month could begin before start date
				if (gridRow == 0 && segments.length && lenBefore >= 0 && lenBefore <= 14
					&& otherMonthDays[gridOffset+firstMonth][0] > 1) {
					segmentCellOffsetFirst = Math.min(rangeCellOffsetFirst, rowCellOffsetFirst);
				}

				// translate to cells
				var segmentCellFirst = t.cellOffsetToCell(segmentCellOffsetFirst);
				var segmentCellLast = t.cellOffsetToCell(segmentCellOffsetLast);

				// view might be RTL, so order by leftmost column
				var cols = [ segmentCellFirst.col, segmentCellLast.col ].sort();

				// Determine if segment's first/last cell is the beginning/end of the date range.
				// We need to compare "day offset" because "cell offsets" are often ambiguous and
				// can translate to multiple days, and an edge case reveals itself when we the
				// range's first cell is hidden (we don't want isStart to be true).
				var segmentDayOffsetLast = t.cellOffsetToDayOffset(segmentCellOffsetLast);

				// segment in end of month could ends after real end
				while (segmentDayOffsetLast >= rangeDayOffsetEnd) {
					cols[1]--; segmentDayOffsetLast--;
					if (cols[1] < cols[0]) {
						skipSegment = true;
						break;
					}
				}

				isStart = t.cellOffsetToDayOffset(segmentCellOffsetFirst) == rangeDayOffsetStart;
				isEnd = segmentDayOffsetLast + 1 == rangeDayOffsetEnd; // +1 (exclusively)

				// segment in hidden month
				if ($.inArray(firstMonth+gridOffset,hiddenMonths) != -1)
					skipSegment = true;

				// we could enhance this, hiding segments on hiddendays
				if (!skipSegment)
					segments.push({
						gridOffset: gridOffset,
						row: row,
						leftCol: cols[0],
						rightCol: cols[1],
						isStart: isStart,
						isEnd: isEnd
					});
			}
		}

		return segments;
	}

	function daysInMonth(year, month) {
		return new Date(year, month, 0).getDate();
	}

	function dateInMonth(date, mi) {
		var y = date.year() - t.intervalStart.year();
		return (date.month() == mi-(y*12));
	}

	// grid number of row
	function rowToGridOffset(row) {
		var cnt = 0;
		for (var i=firstMonth; i<lastMonth; i++) {
			cnt += rowsForMonth[i];
			if (row < cnt) { return i-firstMonth; }
		}
		return -1;
	}

	// row index in grid
	function rowToGridRow(row) {
		var cnt = 0;
		for (var i=firstMonth; i<lastMonth; i++) {
			cnt += rowsForMonth[i];
			if (row < cnt) { return row-(cnt-rowsForMonth[i]); }
		}
		return -1;
	}

	function defaultEventEnd(event) {
		return event.intervalStart.clone();
	}

	function tableByOffset(offset) {
		return $(subTables[offset]);
	}

	function buildCoordGrids() {
		var nums = [];
		for (var i=firstMonth; i<lastMonth; i++) {
			nums.push(i);
		}
		coordinateGrids = [];
		$.each(nums, function(offset, m) {
			var grid = new CoordinateGrid(function(rows, cols) {
				var _subTable = tableByOffset(offset);
				var _head = _subTable.find('thead');
				var _headCells = _head.find('th.fc-year-weekly-head');
				var _bodyRows = _subTable.find('tbody tr');

				var e, n, p;
				_headCells.each(function(i, _e) {
					e = $(_e);
					n = e.offset().left;
					p = [n, n+e.outerWidth()];
					cols[i] = p;
				});
				_bodyRows.each(function(i, _e) {
					if (i < rowCnt) {
						e = $(_e);
						n = e.offset().top;
						p = [n, n+e.outerHeight()];
						rows[i] = p;
					}
				});
			});
			grid.offset = offset;
			coordinateGrids.push(grid);
		});

		hoverListener = new HoverListener(coordinateGrids);
	}

	colContentPositions = new HorizontalPositionCache(function(col) {
		return bodyCellTopInners.eq(col);
	});

	function colContentLeft(col, gridOffset) {
		var grid = tableByOffset(gridOffset);
		return colContentPositions.left(col) + grid.position().left;
	}

	function colContentRight(col, gridOffset) {
		var grid = tableByOffset(gridOffset);
		return colContentPositions.right(col) + grid.position().left;
	}

	function colLeft(col, gridOffset) {
		return colContentLeft(col, gridOffset);
	}

	function colRight(col, gridOffset) {
		return colContentRight(col, gridOffset);
	}

	function dateCell(date) {
		return {
			row: Math.floor(dayDiff(date, t.start) / 7),
			col: dayOfWeekCol(date.day())
		};
	}

	function dayOfWeekCol(dayOfWeek) {
		return ((dayOfWeek - Math.max(firstDay, nwe) + colCnt) % colCnt) * dis + dit;
	}

	function allDayRow(i) {
		return bodyRows.eq(i);
	}

	function allDayBounds(i) {
		return {
			left: 0,
			right: viewWidth
		};
	}


}
