/*
 Copyright (c) 2012-2017 Open Lab
 Written by Roberto Bicchierai and Silvia Chelazzi http://roberto.open-lab.com
 Permission is hereby granted, free of charge, to any person obtaining
 a copy of this software and associated documentation files (the
 "Software"), to deal in the Software without restriction, including
 without limitation the rights to use, copy, modify, merge, publish,
 distribute, sublicense, and/or sell copies of the Software, and to
 permit persons to whom the Software is furnished to do so, subject to
 the following conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

$.gridify = function (table, opt) {
  var options = {
    resizeZoneWidth: 10
  };

  $.extend(options, opt);

  var box = $("<div>").addClass("gdfWrapper");
  box.append(table);

  var head = table.clone();
  head.addClass("table ganttFixHead");
  //remove non head
  head.find("tbody").remove();
  box.append(head);

  box.append(table);

  var hTh = head.find(".gdfColHeader");
  var cTh = table.find(".gdfColHeader");
  for (var i = 0; i < hTh.length; i++) {
    hTh.eq(i).data("fTh", cTh.eq(i));
  }

  //--------- set table to 0 to prevent a strange 100%
  table.width(0);
  head.width(0);


  //----------------------  header management start
  head.find("th.gdfColHeader:not(.gdfied)").mouseover(function () {
    $(this).addClass("gdfColHeaderOver");

  }).on("mouseout.gdf", function () {
    $(this).removeClass("gdfColHeaderOver");
    if (!$.gridify.columInResize) {
      $("body").removeClass("gdfHResizing");
    }

  }).on("mousemove.gdf", function (e) {
    if (!$.gridify.columInResize) {
      var colHeader = $(this);
      var nextCol = colHeader.next();
      if (nextCol.length > 0 && nextCol.width() < options.resizeZoneWidth)
        colHeader = nextCol;

      if (!colHeader.is(".gdfResizable"))
        return;

      var mousePos = e.pageX - colHeader.offset().left;

      if (colHeader.width() - mousePos < options.resizeZoneWidth) {
        $("body").addClass("gdfHResizing");
      } else {
        $("body").removeClass("gdfHResizing");
      }
    }

  }).on("mousedown.gdf", function (e) {
    var colHeader = $(this);

    var nextCol = colHeader.next();
    if (nextCol.length > 0 && nextCol.width() < options.resizeZoneWidth)
      colHeader = nextCol;

    if (!colHeader.is(".gdfResizable"))
      return;

    var mousePos = e.pageX - colHeader.offset().left;
    if (colHeader.width() - mousePos < options.resizeZoneWidth) {
      $("body").unselectable();
      $.gridify.columInResize = colHeader;
      //on event for start resizing
      $(document).on("mousemove.gdf", function (e) {

        e.preventDefault();
        $("body").addClass("gdfHResizing");

        //manage resizing
        var w = e.pageX - $.gridify.columInResize.offset().left;
        w = w <= 1 ? 1 : w;
        $.gridify.columInResize.width(w);
        $.gridify.columInResize.data("fTh").width(w);


        //on mouse up on body to stop resizing
      }).on("mouseup.gdf", function () {

        //$("body").css({cursor: "auto"});

        $(this).off("mousemove.gdf").off("mouseup.gdf").clearUnselectable();
        $("body").removeClass("gdfHResizing");
        delete $.gridify.columInResize;

      });
    }

  }).on("dblclick.gdf", function () {
    var col = $(this);

    if (!col.is(".gdfResizable"))
      return;

    var idx = $("th", col.parents("table")).index(col);
    var columnTd = $("td:nth-child(" + (idx + 1) + ")", table);
    var w = 0;
    columnTd.each(function () {
      var td = $(this);
      var content = td.children("input").length ? td.children("input").val() : td.html();
      var tmp = $("<div/>").addClass("columnWidthTest").html(content).css({position: "absolute"});
      $("body").append(tmp);
      w = Math.max(w, tmp.width() + parseFloat(td.css("padding-left")));
      tmp.remove();
    });

    w = w + 5;
    col.width(w);
    col.data("fTh").width(w);

    return false;

  }).addClass("gdfied unselectable").attr("unselectable", "true");

  return box;
};




$.splittify = {
  init: function (where, first, second, perc) {

    //perc = perc || 50;

    var element = $("<div>").addClass("splitterContainer");
    var firstBox = $("<div>").addClass("splitElement splitBox1");
    var splitterBar = $("<div>").addClass("splitElement vSplitBar").attr("unselectable", "on").css("padding-top", where.height() / 2 + "px");
    var secondBox = $("<div>").addClass("splitElement splitBox2");


    var splitter = new Splitter(element, firstBox, secondBox, splitterBar);
    splitter.perc =  perc;

    firstBox.append(first);
    secondBox.append(second);

    element.append(firstBox).append(secondBox).append(splitterBar);

    where.append(element);

    var totalW = where.innerWidth();
    var splW = splitterBar.width();
    var fbw = totalW * perc / 100 - splW;
    //var realW = firstBox.get(0).scrollWidth;
    //fbw = fbw > realW? realW: fbw;
    fbw = fbw > totalW - splW - splitter.secondBoxMinWidth ? totalW - splW - splitter.secondBoxMinWidth : fbw;
    firstBox.width(fbw).css({left: 0});
    splitterBar.css({left: firstBox.width()});
    secondBox.width(totalW - fbw - splW).css({left: firstBox.width() + splW});

    splitterBar.on("mousedown.gdf", function (e) {

      e.preventDefault();
      $("body").addClass("gdfHResizing");

      $.splittify.splitterBar = $(this);
      //on event for start resizing
      //var realW = firstBox.get(0).scrollWidth;
      $("body").unselectable().on("mousemove.gdf", function (e) {
        //manage resizing

        e.preventDefault();

        var sb = $.splittify.splitterBar;
        var pos = e.pageX - sb.parent().offset().left;
        var w = sb.parent().width();
        var fbw = firstBox;

        pos = pos > splitter.firstBoxMinWidth ? pos : splitter.firstBoxMinWidth;
        //pos = pos < realW - 10 ? pos : realW - 10;
        pos = pos > totalW - splW - splitter.secondBoxMinWidth ? totalW - splW - splitter.secondBoxMinWidth : pos;
        sb.css({left: pos});
        firstBox.width(pos);
        secondBox.css({left: pos + sb.width(), width: w - pos - sb.width()});
        splitter.perc = (firstBox.width() / splitter.element.width()) * 100;

        //on mouse up on body to stop resizing
      }).on("mouseup.gdf", function () {
        $(this).off("mousemove.gdf").off("mouseup.gdf").clearUnselectable();
        delete $.splittify.splitterBar;

        $("body").removeClass("gdfHResizing");
      });
    });


    // keep both side in synch when scroll
    var stopScroll = false;
    var fs = firstBox.add(secondBox);
    fs.scroll(function (e) {
      var el = $(this);
      var top = el.scrollTop();

      var firstBoxHeader = firstBox.find(".ganttFixHead");
      var secondBoxHeader = secondBox.find(".ganttFixHead");

      if (el.is(".splitBox1") && stopScroll != "splitBox2") {
        stopScroll = "splitBox1";
        secondBox.scrollTop(top);
      } else if (el.is(".splitBox2") && stopScroll != "splitBox1") {
        stopScroll = "splitBox2";
        firstBox.scrollTop(top);
      }

	    firstBoxHeader.css('top', top).hide();
	    secondBoxHeader.css('top', top).hide();

      where.stopTime("reset").oneTime(100, "reset", function () {

	      stopScroll = "";
	      top = el.scrollTop();

	      firstBoxHeader.css('top', top).fadeIn();
	      secondBoxHeader.css('top', top).fadeIn();

      });

    });


    firstBox.on('mousewheel MozMousePixelScroll', function (event) {

      event.preventDefault();

      var deltaY = event.originalEvent.wheelDeltaY;
      if(!deltaY)
          deltaY=event.originalEvent.wheelDelta; 
      
      var deltaX = event.originalEvent.wheelDeltaX;

      if (event.originalEvent.axis) {
        deltaY = event.originalEvent.axis == 2 ? -event.originalEvent.detail : null;
        deltaX = event.originalEvent.axis == 1 ? -event.originalEvent.detail : null;
      }

      deltaY = Math.abs(deltaY) < 40 ? 40 * (Math.abs(deltaY) / deltaY) : deltaY;
      deltaX = Math.abs(deltaX) < 40 ? 40 * (Math.abs(deltaX) / deltaX) : deltaX;

      var scrollToY = secondBox.scrollTop() - deltaY;
      var scrollToX = firstBox.scrollLeft() - deltaX;

      // console.debug( firstBox.scrollLeft(), Math.abs(deltaX), Math.abs(deltaY));

      if (deltaY) secondBox.scrollTop(scrollToY);
      if (deltaX) firstBox.scrollLeft(scrollToX);

      return false;
    });


    function Splitter(element, firstBox, secondBox, splitterBar) {
      this.element = element;
      this.firstBox = firstBox;
      this.secondBox = secondBox;
      this.splitterBar = splitterBar;
      this.perc = 0;
      this.firstBoxMinWidth = 0;
      this.secondBoxMinWidth = 30;

      this.resize = function (newPerc, anim) {
        var animTime = anim ? anim : 0;
        this.perc = newPerc ? newPerc : this.perc;
        var totalW = this.element.width();
        var splW = this.splitterBar.width();
        var newW = totalW * this.perc / 100;
        newW = newW > this.firstBoxMinWidth ? newW : this.firstBoxMinWidth;
        newW = newW > totalW - splW - splitter.secondBoxMinWidth ? totalW - splW - splitter.secondBoxMinWidth : newW;
        this.firstBox.animate({width: newW}, animTime, function () {$(this).css("overflow-x", "scroll");});
        this.splitterBar.animate({left: newW}, animTime);
        this.secondBox.animate({left: newW + this.splitterBar.width(), width: totalW - newW - splW}, animTime, function () {$(this).css({"overflow-y": "auto", "overflow-x":"scroll"});});

      };

      var self = this;
      this.splitterBar.on("dblclick", function () {
        self.resize(50, true);
      });
    }
    
    return splitter;
  }

};


//<%------------------------------------------------------------------------  UTILITIES ---------------------------------------------------------------%>
function computeStart(start, backward) {
  return computeStartDate(start, backward).getTime();
}
function computeStartDate(start, backward) {
  var d = new Date(start);
  d.setHours(0, 0, 0, 0);
  //move to next working day
  while (GanttMaster.isHoliday(d)) {
    d.setDate(d.getDate() + (backward ? -1 : 1));
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeEnd(end, backward) {
  return computeEndDate(end, backward).getTime();
}
function computeEndDate(end, backward) {
  var d = new Date(end);
  d.setHours(23, 59, 59, 999);
  //move to next/last working day
  while (GanttMaster.isHoliday(d)) {
    d.setDate(d.getDate() + (backward ? -1 : 1));
  }
  d.setHours(23, 59, 59, 999);
  return d;
}

function computeEndByDuration(start, duration) {
  var d = new Date(start);
  var q = duration - 1;
  while (q > 0) {
    d.setDate(d.getDate() + 1);
    if (!GanttMaster.isHoliday(d))
      q--;
  }
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function computeStartByDuration(end, duration) {
  var d = new Date(end);
  var q = duration - 1;
  while (q > 0) {
    d.setDate(d.getDate() - 1);
    if (!GanttMaster.isHoliday(d))
      q--;
  }
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function incrementDateByWorkingDays(date, days) {
  var d = new Date(date);
  d.incrementDateByWorkingDays(days);
  return d.getTime();
}

function decrementDateByWorkingDays(date, days) {
  var d = new Date(date);
  d.decrementDateByWorkingDays(days);
  return d.getTime();
}

var decrementOneWorkingDateFromMillis = function (millis) {
  return (new Date(millis)).decrementDateByWorkingDays(1).getTime();
};

var incrementOneWorkingDateFromMillis = function (millis) {
  return (new Date(millis)).incrementDateByWorkingDays(1).getTime();
};


function recomputeDuration(start, end) {
  return new Date(start).distanceInWorkingDays(new Date(end));
}

function resynchDates(schedulingDir, leavingField, startField, startMilesField, durationField, endField, endMilesField) {
  var backward = schedulingDir === GanttConstants.SCHEDULE_DIR.BACKWARD;
  
  function resynchDatesSetFields(command) {
    //var duration = parseInt(durationField.val());
    var duration = parseInt(durationField.val());

    var start = computeStart(Date.parseString(startField.val()).getTime());

    var end = endField.val();
    if (end.length > 0) {
      end = Date.parseString(end);
      end.setHours(23, 59, 59, 999);
      end = computeEnd(end.getTime());
    }

    var date = new Date();
    var workingDays;
    if ("CHANGE_END" == command) {
      date.setTime(start);
      workingDays = _.max([duration - 1, 0]); // _.max to handle the case of 0 duration
      date.incrementDateByWorkingDays(workingDays);
      date.setHours(23, 59, 59, 999);
      end = computeEnd(date.getTime());
    } else if ("CHANGE_START" == command) {
      date.setTime(end);
      workingDays = _.max([duration - 1, 0]); // _.max to handle the case of 0 duration
      date.incrementDateByWorkingDays(-workingDays);
      date.setHours(0, 0, 0, 0);
      start = computeStart(date.getTime());
    } else if ("CHANGE_DURATION" == command) {
      if (duration !== 0) {
        duration = new Date(start).distanceInWorkingDays(new Date(end));
      }
    }

    startField.val(new Date(start).format());
    endField.val(new Date(end).format());
    durationField.val(duration);

    return {start: start, end: end, duration: duration};
  }

  var leavingFieldName = leavingField.prop("name");
  var durIsFilled = durationField.val().length > 0;
  var startIsFilled = startField.val().length > 0;
  var endIsFilled = endField.val().length > 0;
  var startIsMilesAndFilled = startIsFilled && (startMilesField.prop("checked") || startField.is("[readOnly]"));
  var endIsMilesAndFilled = endIsFilled && (endMilesField.prop("checked") || endField.is("[readOnly]"));

  if (durIsFilled) {
    if (isNaN(parseInt(durationField.val())) || parseInt(durationField.val()) < 0)
      durationField.val(1);
  }

  if (leavingFieldName.indexOf("Milestone") > 0) {
    if (startIsMilesAndFilled && endIsMilesAndFilled) {
      durationField.prop("readOnly", true);
    } else {
      durationField.prop("readOnly", false);
    }
    return;
  }

  //need at least two values to resynch the third
  if ((durIsFilled ? 1 : 0) + (startIsFilled ? 1 : 0) + (endIsFilled ? 1 : 0) < 2)
    return;

  var ret;
  if (leavingFieldName == 'start' && startIsFilled) {
    if (backward) {
      ret = resynchDatesSetFields("CHANGE_DURATION");
    } else {
      if (endIsMilesAndFilled && durIsFilled) {
        ret = resynchDatesSetFields("CHANGE_DURATION");
      } else if (durIsFilled) {
        ret = resynchDatesSetFields("CHANGE_END");
      }
    }
  } else if (leavingFieldName == 'duration' && durIsFilled && !(endIsMilesAndFilled && startIsMilesAndFilled)) {
    if ((endIsMilesAndFilled || backward) && !startIsMilesAndFilled) {
      ret = resynchDatesSetFields("CHANGE_START");
    } else if (!endIsMilesAndFilled) {
      //document.title=('go and change end!!');
        ret = resynchDatesSetFields("CHANGE_END");
    }

  } else if (leavingFieldName == 'end' && endIsFilled) {
    if (backward) {
      if (startIsMilesAndFilled && durIsFilled) {
        ret = resynchDatesSetFields("CHANGE_DURATION");
      } else if (durIsFilled) {
        ret = resynchDatesSetFields("CHANGE_START");
      } 
    } else {
      ret = resynchDatesSetFields("CHANGE_DURATION");
    }
  }
  return ret;
}

/*
b: backward, e: end, d: duration, s: start

b e d s -formulas no. ---- formulas (start, end) -------
0 0 0 1       1       newStart, newStart + oldDuration       
0 0 1 0       2       oldStart, oldStart + newDuration
0 0 1 1       3       newStart, newStart + newDuration
0 1 0 0       4       newEnd - oldDuration, newEnd
0 1 0 1       5       newStart, newEnd
0 1 1 0       2       oldStart, oldStart + newDuration
0 1 1 1       3       newStart, newStart + newDuration
-------------------------------------------------------
1 0 0 1       1       newStart, newStart + oldDuration
1 0 1 0       6       oldEnd - newDuration, oldEnd
1 0 1 1       6       oldEnd - newDuration, oldEnd
1 1 0 0       4       newEnd - oldDuration, newEnd
1 1 0 1       5       newStart, newEnd
1 1 1 0       7       newEnd - newDuration, newEnd
1 1 1 1       7       newEnd - newDuration, newEnd

This is the logical table used in the function resynchDatesLogically, to determine how to compute the new dates
of a task upon an update request, which may include a diverse combination of start, end and duration.

*/
function resynchDatesLogically (schedulingDir, newStart, newEnd, newDuration, originalTask) {

  var backward = schedulingDir === GanttConstants.SCHEDULE_DIR.BACKWARD;
  var startIsDefined = !_.isNil(newStart);
  var endIsDefined = !_.isNil(newEnd);
  var durationIsDefined = !_.isNil(newDuration) && !_.isNaN(newDuration) && newDuration > 0;
  var ret = {};
  var tmpDate;
  var oldDuration = Math.max(0, originalTask.duration - 1);
  if (durationIsDefined) {
    newDuration = Math.max(0, newDuration - 1);
  }

  if (startIsDefined) {
    tmpDate = new Date(newStart);
    tmpDate.setHours(0,0,0,0);
    newStart = tmpDate.getTime();
  } 

  if (endIsDefined) {
    tmpDate = new Date(newEnd);
    tmpDate.setHours(23,59,59,999);
    newEnd = tmpDate.getTime();
  } 

  if (startIsDefined && !endIsDefined && !durationIsDefined) { // move the start
    ret.start = newStart;
    ret.end = (new Date(newStart)).incrementDateByWorkingDays(oldDuration).getTime();
  } else if (endIsDefined && !startIsDefined && !durationIsDefined) { // move the end
    ret.start = (new Date(newEnd)).decrementDateByWorkingDays(oldDuration).getTime();
    ret.end = newEnd;
  } else if (endIsDefined && startIsDefined && !durationIsDefined) { // change the start and the end
    ret.start = newStart;
    ret.end = newEnd;
  } else {
    if (!backward) { // forward scheduling
      if (!startIsDefined && durationIsDefined) { // ignore end, use old start
        ret.start = originalTask.start;
        ret.end = (new Date(originalTask.start)).incrementDateByWorkingDays(newDuration).getTime();
      } else if (startIsDefined && durationIsDefined) { // ignore end, use new start
        ret.start = newStart;
        ret.end = (new Date(newStart)).incrementDateByWorkingDays(newDuration).getTime();
      }
    } else { // backward scheduling
      if (!endIsDefined && durationIsDefined) { // ignore start, use old end
        ret.start = (new Date(originalTask.end)).decrementDateByWorkingDays(newDuration).getTime();
        ret.end = originalTask.end;
      } else if (endIsDefined && durationIsDefined) { // ignore start, use new end
        ret.start = (new Date(newEnd)).decrementDateByWorkingDays(newDuration).getTime();
        ret.end = newEnd;
      }
    }
  }

  return ret;
}


//This prototype is provided by the Mozilla foundation and
//is distributed under the MIT license.
//http://www.ibiblio.org/pub/Linux/LICENSES/mit.license

if (!Array.prototype.filter) {
  Array.prototype.filter = function (fun) {
    var len = this.length;
    if (typeof fun != "function")
      throw new TypeError();

    var res = [];
    var thisp = arguments[1];
    for (var i = 0; i < len; i++) {
      if (i in this) {
        var val = this[i]; // in case fun mutates this
        if (fun.call(thisp, val, i, this))
          res.push(val);
      }
    }
    return res;
  };
}

// ---------------------------------- oldvalues management
// update all values selected
jQuery.fn.updateOldValue = function () {
	this.each(function () {
		var el = $(this);
		var val=(el.is(":checkbox,:radio")?el.prop("checked"):el.val())+"";
		el.data("_oldvalue", val);
	});
	return this;
};

// return true if at least one element has changed
jQuery.fn.isValueChanged = function () {
	var ret = false;
	this.each(function () {
		var el = $(this);
		var val=(el.is(":checkbox,:radio")?el.prop("checked"):el.val())+"";
		if (val != el.data("_oldvalue") + "") {
			ret = true;
			return false;
		}
	});
	return ret;
};

jQuery.fn.getOldValue = function () {
	return $(this).data("_oldvalue");
};

jQuery.fn.fillJsonWithInputValues = function (jsonObject) {
  var inputs = this.find(":input");
  $.each(inputs.serializeArray(),function(){
    if (this.name) {
        jsonObject[this.name] = this.value;
    }
  });

  inputs.filter(":checkbox[name]").each(function () {
    var el = $(this);
    jsonObject[el.attr("name")] = el.is(":checked") ? "yes" : "no";

  });

  return this;
};
