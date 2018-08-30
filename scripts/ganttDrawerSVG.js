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


 todo For compatibility with IE and SVGElements.getElementsByClassName not implemented changed every find starting from SVGElement (the other works fine)
 .find(".classname"))  -> .find("[class*=classname])
 */
function Ganttalendar(zoom, startmillis, endMillis, master, minGanttSize) {
  this.master = master; // is the a GantEditor instance
  //this.element; // is the jquery element containing gantt

  //this.svg; // instance of svg object containing gantt
  //this.tasksGroup; //instance of svg group containing tasks
  //this.linksGroup; //instance of svg group containing links

  this.zoom = zoom;
  this.minGanttSize = minGanttSize;
  this.includeToday = true; //when true today is always visible. If false boundaries comes from tasks periods
  this.showCriticalPath = false; //when true critical path is highlighted

  this.zoomLevels = [ "d", "w","w2","w3", "m","m2", "q", "q2", "s", "y"];

  this.element = this.create(zoom, startmillis, endMillis);

  this.linkOnProgress = false; //set to true when creating a new link
  this.taskHeight=20;
  // HINT: In this combination of fonts and their sizes, 40 px is the minimum row height (need also to be set in the css file for the classes .taskEditRow and .emptyRow) 
  // otherwise, chrome will add some fractions to height depending on the page zoom level making the grant table and Granttalendar not on the same lines.
  this.rowHeight = 40; 
  this.taskVertOffset=(this.rowHeight-this.taskHeight)/2;

}

Ganttalendar.prototype.zoomGantt = function (isPlus) {
  var curLevel = this.zoom;
  var pos = this.zoomLevels.indexOf(curLevel + "");

  var centerMillis=this.getCenterMillis();
  var newPos = pos;
  if (isPlus) {
    newPos = pos <= 0 ? 0 : pos - 1;
  } else {
    newPos = pos >= this.zoomLevels.length - 1 ? this.zoomLevels.length - 1 : pos + 1;
  }
  if (newPos != pos) {
    curLevel = this.zoomLevels[newPos];
    this.zoom = curLevel;
    this.refreshGantt();
    this.goToMillis(centerMillis);
  }
};

Ganttalendar.prototype.computeScaleFactor = function (zoom, initialWidth) {
  var defaultWidths = [100, 200/3, 150, 100, 15, 25, 30, 40, 50, 100];
  switch(zoom) {
    case "y": return (initialWidth || defaultWidths[0]) / (3600000 * 24 * 180);
    case "s": return (initialWidth || defaultWidths[1]) / (3600000 * 24 * 30);
    case "q2": return (initialWidth || defaultWidths[2]) / (3600000 * 24 * 30);
    case "q": return (initialWidth || defaultWidths[3]) / (3600000 * 24 * 10);
    case "m2": return (initialWidth || defaultWidths[4]) / (3600000 * 24);
    case "m": return (initialWidth || defaultWidths[5]) / (3600000 * 24);
    case "w3": return (initialWidth || defaultWidths[6]) / (3600000 * 24);
    case "w2": return (initialWidth || defaultWidths[7]) / (3600000 * 24);
    case "w": return (initialWidth || defaultWidths[8]) / (3600000 * 24);
    case "d": return (initialWidth || defaultWidths[9]) / (3600000 * 24);
  }
};


Ganttalendar.prototype.create = function (zoom, originalStartmillis, originalEndMillis) {
  //console.log("Gantt.create " + zoom + " - " + new Date(originalStartmillis) + " - " + new Date(originalEndMillis));
  //var prof = new Profiler("ganttDrawer.create");
  var self = this;

  function getPeriod(zoomLevel, stMil, endMillis) {
    var start = new Date(stMil);
    var end = new Date(endMillis);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    //reset hours
    if (zoomLevel == "d") {
      start.setFirstDayOfThisWeek();
      end.setFirstDayOfThisWeek();
      end.setDate(end.getDate() + 6);

      //reset day of week
    } else if (zoomLevel == "w" ) {
      start.setFirstDayOfThisWeek();
      start.setDate(start.getDate()-7);
      end.setFirstDayOfThisWeek();
      end.setDate(end.getDate() + 13);

    } else if (zoomLevel == "w2" ) {
      start.setFirstDayOfThisWeek();
      start.setDate(start.getDate()-7);
      end.setFirstDayOfThisWeek();
      end.setDate(end.getDate() + 20);

    } else if (zoomLevel == "w3" ) {
      start.setFirstDayOfThisWeek();
      start.setDate(start.getDate()-7);
      end.setFirstDayOfThisWeek();
      end.setDate(end.getDate() + 27);

      //reset day of month
    } else if (zoomLevel == "m") {
      start.setDate(1);
      start.setMonth(start.getMonth()-1);
      end.setDate(1);
      end.setMonth(end.getMonth() + 2);
      end.setDate(end.getDate() - 1);

    } else if (zoomLevel == "m2") {
      start.setDate(1);
      start.setMonth(start.getMonth()-1);
      end.setDate(1);
      end.setMonth(end.getMonth() + 3);
      end.setDate(end.getDate() - 1);

      //reset to day of week
    } else if (zoomLevel == "q") {
      start.setDate(start.getDate()-start.getDay()+1); //ISO 8601 counts week of year starting on Moday
      start.setDate(start.getDate()-7);
      end.setFirstDayOfThisWeek();
      end.setDate(end.getDate() + 13);

      //reset to quarter
    } else if (zoomLevel == "q2") {
      start.setDate(1);
      start.setMonth(Math.floor(start.getMonth() / 3) * 3);
      start.setMonth(start.getMonth()-3);
      end.setDate(1);
      end.setMonth(Math.floor(end.getMonth() / 3) * 3 + 6);
      end.setDate(end.getDate() - 1);

      //reset to semester
    } else if (zoomLevel == "s") {
      start.setDate(1);
      start.setMonth(Math.floor(start.getMonth() / 6) * 6);
      start.setMonth(start.getMonth()-6);
      end.setDate(1);
      end.setMonth(Math.floor(end.getMonth() / 6) * 6 + 12);
      end.setDate(end.getDate() - 1);

      //reset to year - > gen
    } else if (zoomLevel == "y") {
      start.setDate(1);
      start.setMonth(0);
      start.setFullYear(start.getFullYear()-1);
      end.setDate(1);
      end.setMonth(24);
      end.setDate(end.getDate() - 1);
    }

    return {start:start.getTime(), end:end.getTime()};
  }

  function createHeadCell(lbl, additionalClass, width) {
    var th = $("<div>").html(lbl);
    if (width)
      th.width(width);
    if (additionalClass)
      th.addClass(additionalClass);
    return th;
  }

  function createBodyCell(isEnd, additionalClass, width) {
    var ret = $("<div>").html("").addClass("ganttBodyCell");
    if (width)
      ret.width(width);
    if (isEnd)
      ret.addClass("end");
    if (additionalClass)
      ret.addClass(additionalClass);
    return ret;
  }

  function createGantt(zoom, startPeriod, endPeriod) {
    var tr1 = $("<div>").addClass("ganttHead1");
    var tr2 = $("<div>").addClass("ganttHead2");
    var trBody = $("<div>").addClass("ganttBody");

    var date = new Date(startPeriod);
    var counter = 0;
    var totalWidth = 0;
    var end, periodWidth, tmpDate, lbl;

    //this is computed by hand in order to optimize cell size
    var computedTableWidth;
    var computedScaleX = self.computeScaleFactor(zoom);
    // year
    if (zoom == "y") {
      
      counter = 0;
      date = new Date(startPeriod);
      while (date.getTime() <= endPeriod) {
        counter++;
        end = new Date(date.getTime());
        end.setMonth(end.getMonth() + 6);
        periodWidth=(end.getTime()-date.getTime())*computedScaleX;
        var sem = (Math.floor(date.getMonth() / 6) + 1);
        tr2.append(createHeadCell(GanttMaster.messages.GANTT_SEMESTER_SHORT + sem, null, periodWidth));
        trBody.append(createBodyCell(sem == 2, null, periodWidth));
        totalWidth += periodWidth;
        if (counter > 0 && counter % 2 === 0) {
          tr1.append(createHeadCell(date.format(GanttMaster.locales.header_year_format), null, totalWidth));
          totalWidth = 0;
        }
        date.setMonth(date.getMonth() + 6);
      }

      //semester
    } else if (zoom == "s") {

      counter = 0;
      date = new Date(startPeriod);
      while (date.getTime() <= endPeriod) {
        counter++;
        end = new Date(date.getTime());
        end.setMonth(end.getMonth() + 1);
        periodWidth=(end.getTime()-date.getTime())*computedScaleX;
        tr2.append(createHeadCell(date.format(GanttMaster.locales.header_semester_format_unit), null, periodWidth));
        trBody.append(createBodyCell((date.getMonth()+1) % 6 == 0, null, periodWidth));
        totalWidth += periodWidth;
        if (counter > 0 && counter % 6 === 0) {
          tmpDate = new Date(date.getTime());
          tmpDate.setMonth(tmpDate.getMonth() - 5);
          tr1.append(createHeadCell(tmpDate.format(GanttMaster.locales.header_semester_format_begin) + " - " + date.format(GanttMaster.locales.header_semester_format_end), null, totalWidth));
          totalWidth = 0;
        }
        date.setMonth(date.getMonth() + 1);
      }

      //quarter
     } else if (zoom == "q2") {

      counter = 0;
      date = new Date(startPeriod);
      while (date.getTime() <= endPeriod) {
        counter++;
        end = new Date(date.getTime());
        end.setMonth(end.getMonth() + 1);
        periodWidth=(end.getTime()-date.getTime())*computedScaleX;
        tr2.append(createHeadCell(date.format(GanttMaster.locales.header_quarter_format_month_unit), null, periodWidth));
        trBody.append(createBodyCell(date.getMonth() % 3 == 2, null, periodWidth));
        totalWidth += periodWidth;
        if (counter > 0 && counter % 3 === 0) {
          tmpDate = new Date(date);
          tmpDate.setMonth(tmpDate.getMonth() - 2);
          tr1.append(createHeadCell(tmpDate.format(GanttMaster.locales.header_quarter_format_begin) + " - " + date.format(GanttMaster.locales.header_quarter_format_end), null, totalWidth));
          totalWidth = 0;
        }
        date.setMonth(date.getMonth() + 1);
      }

      // quarter / week of year
    } else if (zoom == "q") {

      date = new Date(startPeriod);
      totalWidth = 0;
      while (date.getTime() <= endPeriod) {
        end = new Date(date.getTime());
        end.setDate(end.getDate() + Math.min(7, Math.ceil((endPeriod - date.getTime()) / (3600000 * 24))));
        lbl ="<small>"+GanttMaster.messages.WEEK_SHORT+"</small> "+ date.format(GanttMaster.locales.header_quarter_format_week_unit);
        periodWidth=(end.getTime()-date.getTime())*computedScaleX;
        tr2.append(createHeadCell(lbl, null, periodWidth));
        trBody.append(createBodyCell(false, null, periodWidth));
        date.setDate(date.getDate() + 7);
      }

      date = new Date(startPeriod);
      totalWidth = 0;
      var totalDays = 0;
      while (date.getTime() <= endPeriod) {
        end = new Date(date.getTime());
        end.setDate(end.getDate() + 1);
        periodWidth=(end.getTime()-date.getTime())*computedScaleX;
        totalWidth += periodWidth;
        totalDays++;
        if (date.getDate() === date.monthDays() || ( (date.getTime() + 24 * 3600 * 1000) > endPeriod)) {
          tr1.append(createHeadCell((totalDays > 14) ? date.format(GanttMaster.locales.header_month_format) : "", null, totalWidth));
          totalWidth = 0;
          totalDays = 0;
        }
        date.setDate(date.getDate() + 1);
      }

      //month
    } else if (zoom == "m2") {

      counter = 0;
      date = new Date(startPeriod);
      while (date.getTime() <= endPeriod) {
        counter++;
        end = new Date(date.getTime());
        end.setDate(end.getDate() + 1);
        periodWidth=(end.getTime()-date.getTime())*computedScaleX;
        tr2.append(createHeadCell(date.format(GanttMaster.locales.header_month_format_unit), GanttMaster.isHoliday(date) ? "holyH headSmall" : "headSmall", periodWidth));
        var nd = new Date(date.getTime());
        nd.setDate(date.getDate() + 1);
        trBody.append(createBodyCell(nd.getDate() == 1, GanttMaster.isHoliday(date) ? "holy" : null, periodWidth));
        totalWidth += periodWidth;
        if (counter === date.monthDays()) {
          tr1.append(createHeadCell(date.format(GanttMaster.locales.header_month_format), null, totalWidth)); 
          totalWidth = 0;
          counter = 0;
        }
        date.setDate(date.getDate() + 1);
      }

    } else if (zoom == "m") {


      counter = 0;
      date = new Date(startPeriod);
      while (date.getTime() <= endPeriod) {
        counter++;
        end = new Date(date.getTime());
        end.setDate(end.getDate() + 1);
        periodWidth=(end.getTime()-date.getTime())*computedScaleX;
        tr2.append(createHeadCell(date.format(GanttMaster.locales.header_month_format_unit), GanttMaster.isHoliday(date) ? "holyH" : null, periodWidth));
        tmpDate = new Date(date.getTime());
        tmpDate.setDate(date.getDate() + 1);
        trBody.append(createBodyCell(tmpDate.getDate() == 1, GanttMaster.isHoliday(date) ? "holy" : null, periodWidth));
        totalWidth += periodWidth;
        if (counter === date.monthDays()) {
          tr1.append(createHeadCell(date.format(GanttMaster.locales.header_month_format), null, totalWidth)); 
          totalWidth = 0;
          counter = 0;
        }
        date.setDate(date.getDate() + 1);
      }

      //week
    } else if (zoom == "w3") {

      counter = 0;
      date = new Date(startPeriod);
      while (date.getTime() <= endPeriod) {
        counter++;
        end = new Date(date.getTime());
        end.setDate(end.getDate() + 1);
        periodWidth=(end.getTime()-date.getTime())*computedScaleX;
        tr2.append(createHeadCell(date.format(GanttMaster.locales.header_week_format_unit).substr(0, 1), GanttMaster.isHoliday(date) ? "holyH" : null, periodWidth));
        trBody.append(createBodyCell(date.getDay() % 7 == (GanttMaster.locales.firstDayOfWeek + 6) % 7, GanttMaster.isHoliday(date) ? "holy" : null, periodWidth));
        totalWidth += periodWidth;
        if (counter > 0 && counter % 7 === 0) {
          tmpDate = new Date(date);
          tmpDate.setDate(tmpDate.getDate() - 6);
          tr1.append(createHeadCell(tmpDate.format(GanttMaster.locales.header_week_format_begin) + " - " + date.format(GanttMaster.locales.header_week_format_end), null, totalWidth));
          totalWidth = 0;
        }
        date.setDate(date.getDate() + 1);
      }

    } else if (zoom == "w2") {

      counter = 0;
      date = new Date(startPeriod);
      while (date.getTime() <= endPeriod) {
        counter++;
        end = new Date(date.getTime());
        end.setDate(end.getDate() + 1);
        periodWidth=(end.getTime()-date.getTime())*computedScaleX;
        tr2.append(createHeadCell(date.format(GanttMaster.locales.header_week_format_unit).substr(0, 1), GanttMaster.isHoliday(date) ? "holyH" : null, periodWidth));
        trBody.append(createBodyCell(date.getDay() % 7 == (GanttMaster.locales.firstDayOfWeek + 6) % 7, GanttMaster.isHoliday(date) ? "holy" : null, periodWidth));
        totalWidth += periodWidth;
        if (counter > 0 && counter % 7 === 0) {
          tmpDate = new Date(date);
          tmpDate.setDate(tmpDate.getDate() - 6);
          tr1.append(createHeadCell(tmpDate.format(GanttMaster.locales.header_week_format_begin) + " - " + date.format(GanttMaster.locales.header_week_format_end), null, totalWidth));
          totalWidth = 0;
        }
        date.setDate(date.getDate() + 1);
      }

    } else if (zoom == "w") {

      counter = 0;
      date = new Date(startPeriod);
      while (date.getTime() <= endPeriod) {
        counter++;
        end = new Date(date.getTime());
        end.setDate(end.getDate() + 1);
        periodWidth=(end.getTime()-date.getTime())*computedScaleX;
        tr2.append(createHeadCell(date.format(GanttMaster.locales.header_week_format_unit).substr(0, 1), GanttMaster.isHoliday(date) ? "holyH" : null, periodWidth));
        trBody.append(createBodyCell(date.getDay() % 7 == (GanttMaster.locales.firstDayOfWeek + 6) % 7, GanttMaster.isHoliday(date) ? "holy" : null, periodWidth));
        totalWidth += periodWidth;
        if (counter > 0 && counter % 7 === 0) {
          tmpDate = new Date(date);
          tmpDate.setDate(tmpDate.getDate() - 6);
          tr1.append(createHeadCell(tmpDate.format(GanttMaster.locales.header_week_format_begin) + " - " + date.format(GanttMaster.locales.header_week_format_end), null, totalWidth));
          totalWidth = 0;
        }
        date.setDate(date.getDate() + 1);
      }

      //days
    } else if (zoom == "d") {
      
      counter = 0;
      date = new Date(startPeriod);
      while (date.getTime() <= endPeriod) {
        counter++;
        end = new Date(date.getTime());
        end.setDate(end.getDate() + 1);
        periodWidth=(end.getTime()-date.getTime())*computedScaleX;
        tr2.append(createHeadCell(date.format(GanttMaster.locales.header_day_format_unit), GanttMaster.isHoliday(date) ? "holyH" : null, periodWidth));
        trBody.append(createBodyCell(date.getDay() % 7 == (GanttMaster.locales.firstDayOfWeek + 6) % 7, GanttMaster.isHoliday(date) ? "holy" : null, periodWidth));
        totalWidth += periodWidth;
        if (counter > 0 && counter % 7 === 0) {
          tmpDate = new Date(date);
          tmpDate.setDate(tmpDate.getDate() - 6);
          tr1.append(createHeadCell(tmpDate.format(GanttMaster.locales.header_day_format_begin) + " - " + date.format(GanttMaster.locales.header_day_format_end), null, totalWidth));
          totalWidth = 0;
        }
        date.setDate(date.getDate() + 1);
      }

    } else {
      console.error("Wrong level " + zoom);
    }

    computedTableWidth = (endPeriod - startPeriod)*computedScaleX;


    //set a minimal width
    computedTableWidth = Math.max(computedTableWidth, self.minGanttSize);

    var table = $("<div>");
    table.append(tr1).append(tr2);   // removed as on FF there are rounging issues  //.css({width:computedTableWidth});

    var head = table.clone().addClass("ganttFixHead");

    table.append(trBody).addClass("ganttTable");


    var height = self.master.editor.element.height();
    table.height(height);

    var box = $("<div>");
    box.addClass("gantt unselectable").attr("unselectable", "true").css({position:"relative", width:computedTableWidth});
    box.append(table);
    box.append(head);

    //create the svg
    box.svg({settings:{class:"ganttSVGBox"},
      onLoad:         function (svg) {
        //console.debug("svg loaded", svg);

        //creates gradient and definitions
        var defs = svg.defs('myDefs');


        //create backgound
        var extDep = svg.pattern(defs, "extDep", 0, 0, 10, 10, 0, 0, 10, 10, {patternUnits:'userSpaceOnUse'});
        var img=svg.image(extDep, 0, 0, 10, 10, self.master.resourceUrl +"hasExternalDeps.png",{opacity:0.3});

        self.svg = svg;
        $(svg).addClass("ganttSVGBox");

        //creates grid group
        var gridGroup = svg.group("gridGroup");

        //creates rows grid
        for (var i = 40; i <= height; i += self.rowHeight)
          //svg.line(gridGroup, 0, i, "100%", i, {class:"ganttLinesSVG"});
          svg.rect(gridGroup, 0, i, "100%",self.rowHeight, {class:"ganttLinesSVG"});

        //creates links group
        self.linksGroup = svg.group("linksGroup");

        //creates tasks group
        self.tasksGroup = svg.group("tasksGroup");

        //compute scalefactor fx
        //self.fx = computedTableWidth / (endPeriod - startPeriod);
        self.fx = computedScaleX;

        // drawTodayLine
        if (new Date().getTime() > self.startMillis && new Date().getTime() < self.endMillis) {
          var x = Math.round(((new Date().clearTime().getTime()) - self.startMillis) * self.fx);
          svg.line(gridGroup, x, 0, x, "100%", {class:"ganttTodaySVG"});
        }

      }
    });

    return box;
  }

  //if include today synch extremes
  if (this.includeToday) {
    var today = new Date().getTime();
    originalStartmillis = originalStartmillis > today ? today : originalStartmillis;
    originalEndMillis = originalEndMillis < today ? today : originalEndMillis;
  }

  //get best dimension fo gantt
  var period = getPeriod(zoom, originalStartmillis, originalEndMillis); //this is enlarged to match complete periods basing on zoom level

  //console.debug(new Date(period.start) + "   " + new Date(period.end));
  self.startMillis = period.start; //real dimension of gantt
  self.endMillis = period.end;
  self.originalStartMillis = originalStartmillis; //minimal dimension required by user or by task duration
  self.originalEndMillis = originalEndMillis;

  var table = createGantt(zoom, period.start, period.end);

  //prof.stop();
  return table;
};


//<%-------------------------------------- GANT TASK GRAPHIC ELEMENT --------------------------------------%>
Ganttalendar.prototype.drawTask = function (task) {
  //console.debug("drawTask", task.name,new Date(task.start));
  var self = this;
  //var prof = new Profiler("ganttDrawTask");
  editorRow = task.rowElement;
  if (!editorRow.is(':visible')) return;
  var top = editorRow.position().top ;// + editorRow.offsetParent().scrollTop();

  //var normStart=Math.round(task.start/(3600000*24))*(3600000*24)
  //var normX = Math.round((normStart - self.startMillis) * self.fx);

  var x = Math.round((task.start - self.startMillis) * self.fx);

  //console.debug(x,normX)


  task.hasChild = task.isParent();

  var taskDimensions = {x:x, y:top+self.taskVertOffset, width:Math.round((task.end - task.start) * self.fx),height:self.taskHeight};
  var taskBox = $(_createTaskSVG(task, taskDimensions));
  task.ganttElement = taskBox;
  if (self.showCriticalPath && task.isCritical)
    taskBox.addClass("critical");

  if (GanttMaster.permissions.canWrite && task.canWrite) {

    //bind all events on taskBox
    taskBox
      .click(function (e) { // manages selection
        e.stopPropagation();// to avoid body remove focused
        sendClassiXEvent(CLASSIX_EVENT_TYPE.CLICK, $(this).attr("taskid"));
        self.element.find("[class*=focused]").removeClass("focused");
        $(".ganttSVGBox .focused").removeClass("focused");
        var el = $(this);
        if (!self.resDrop)
          el.addClass("focused");
        self.resDrop = false; //hack to avoid select

        $("body").off("click.focused").one("click.focused", function (e) {
          if (e.which === 1) { // only left button deselects
            $(".ganttSVGBox .focused").removeClass("focused");
          }
        });

      }).dblclick(function () {
        sendClassiXEvent(CLASSIX_EVENT_TYPE.DB_CLICK, $(this).attr("taskid"));
      }).mouseenter(function () {
        //bring to top
        var el = $(this);
        if (!self.linkOnProgress) {
          el.find("[class*=linkHandleSVG]").show();
        } else {
          el.addClass("linkOver");
        }
      }).mouseleave(function (e) {
        var el = $(this);
        var pos = el.position();
        var dims = el[0].getBBox();
        // this if statement is required because this event is fired as soon as the pointer hovers a transparent or non-drawn
        // area, even if the pointer still in the boundaries of the task. 
        // taskDimensions.height/6 is the half of the radius of the dependencies circles.
        if (e.clientX < pos.left || e.clientX > (pos.left + dims.width) || e.clientY < (pos.top + taskDimensions.height/6) || e.clientY > (pos.top + dims.height - taskDimensions.height/6)) {
          el.removeClass("linkOver").find("[class*=linkHandleSVG]").hide();
        }
      }).mouseup(function (e) {
        $(":focus").blur(); // in order to save grid field when moving task
      }).mousedown(function () {
        var task = self.master.getTask($(this).attr("taskid"));
        task.rowElement.click();
      }).dragExtedSVG($(self.svg.root()), {
        canResize:  GanttMaster.permissions.canWrite && task.canWrite,
        canDrag:    GanttMaster.permissions.canWrite && task.canWrite,
        startDrag:  function (e) {
          $(".ganttSVGBox .focused").removeClass("focused");
        },
        drag:       function (e) {
          $("[from=\"" + task.id + "\"],[to=\"" + task.id + "\"]").trigger("update");
        },
        drop:       function (e) {
          self.resDrop = true; //hack to avoid select
          var taskbox = $(this);
          var taskid = taskbox.attr("taskid");
          var task = self.master.getTask(taskid);
          var s = Math.round(parseFloat(taskbox.attr("x")) / self.fx + self.startMillis);
          
          if (!task.depends) {
            self.master.beginTransaction();
            self.master.moveTask(task, new Date(s));
            self.master.endTransaction();
          } else {
            var dependsInp = $('.taskEditRow[taskid="'+ taskid + '"] input[name=depends]');
            var oldDepends = dependsInp.val();
            var days = (new Date(task.start)).distanceInWorkingDays(new Date(s));
            // this is needed because distanceInWorkingDays returns 1 on same dates
            days -= (days > 0) ? 1 : -1;  
            var newDepends = _.join(_.map(_.split(oldDepends, ","), function (d) {
              var parts = _.split(d, ":");
              parts[1] = parseInt((parts[1] || 0)) + days;
              if (parts[1] <= 0) parts.splice(1,1);
              return _.join(parts,":");
            }), ",");
            if (newDepends !== oldDepends) {
              dependsInp.focus();
              dependsInp.val(newDepends).blur();
            } else {
              self.master.beginTransaction();
              self.master.moveTask(task, new Date(task.start));
              self.master.endTransaction();
            }
          }
        },
        startResize:function (e) {
          //console.debug("startResize");
          $(".ganttSVGBox .focused").removeClass("focused");
          var taskbox = $(this);
          var text = $(self.svg.text(parseInt(taskbox.attr("x")) + parseInt(taskbox.attr("width") + 8), parseInt(taskbox.attr("y")), "", {"font-size":"10px", "fill":"red"}));
          taskBox.data("textDur", text);
        },
        resize:     function (e) {
          //find and update links from, to
          var taskbox = $(this);
          var st = Math.round((parseFloat(taskbox.attr("x")) / self.fx) + self.startMillis);
          var en = Math.round(((parseFloat(taskbox.attr("x")) + parseFloat(taskbox.attr("width"))) / self.fx) + self.startMillis);
          var d = computeStartDate(st).distanceInWorkingDays(computeEndDate(en));
          var text = taskBox.data("textDur");
          var taskBoxWidth = parseInt(taskbox.attr("width"));
          text.attr("x", parseInt(taskbox.attr("x")) + taskBoxWidth + 8).html(d);
          var label = taskBox.find('.taskLabelSVG, .taskLabelSVGWhite');
          var padding = 5;
          var textWidth = label[0].getBBox().width;

          if (textWidth + 2 * padding <= taskBoxWidth) {
            label.attr('transform', 'translate(-' + (taskBoxWidth/2 + textWidth/2)  + ',-3)').addClass('taskLabelSVGWhite').removeClass('taskLabelSVG');
          } else {
            label.attr('transform', 'translate(20,-3)').addClass('taskLabelSVG').removeClass('taskLabelSVGWhite');
          }

          $("[from=\"" + task.id + "\"],[to=\"" + task.id + "\"]").trigger("update");
        },
        stopResize: function (e) {
          self.resDrop = true; //hack to avoid select
          //console.debug(ui)
          var textBox = taskBox.data("textDur");
          if (textBox)
            textBox.remove();
          var taskbox = $(this);
          var task = self.master.getTask(taskbox.attr("taskid"));
          var st = Math.round((parseFloat(taskbox.attr("x")) / self.fx) + self.startMillis);
          var en = Math.round(((parseFloat(taskbox.attr("x")) + parseFloat(taskbox.attr("width"))) / self.fx) + self.startMillis);
          self.master.beginTransaction();
          self.master.changeTaskDates(task, new Date(st), new Date(en));
          self.master.endTransaction();
        }
      });

    //binding for creating link
    taskBox.find("[class*=linkHandleSVG]").mousedown(function (e) {
      e.preventDefault();
      e.stopPropagation();
      var taskBox = $(this).closest(".taskBoxSVG");
      var svg = $(self.svg.root());
      var offs = svg.offset();
      self.linkOnProgress = true;
      self.linkFromEnd = $(this).is(".taskLinkEndSVG");
      svg.addClass("linkOnProgress");

      // create the line
      var startX = parseFloat(taskBox.attr("x")) + (self.linkFromEnd ? parseFloat(taskBox.attr("width")) : 0);
      var startY = parseFloat(taskBox.attr("y")) + parseFloat(taskBox.attr("height")) / 2;
      var line = self.svg.line(startX, startY, e.pageX - offs.left - 5, e.pageY - offs.top - 5, {class:"linkLineSVG"});
      var circle = self.svg.circle(startX, startY, 5, {class:"linkLineSVG"});

      //bind mousemove to draw a line
      svg.bind("mousemove.linkSVG", function (e) {
        var offs = svg.offset();
        var nx = e.pageX - offs.left;
        var ny = e.pageY - offs.top;
        var c = Math.sqrt(Math.pow(nx - startX, 2) + Math.pow(ny - startY, 2));
        nx = nx - (nx - startX) * 10 / c;
        ny = ny - (ny - startY) * 10 / c;
        self.svg.change(line, { x2:nx, y2:ny});
        self.svg.change(circle, { cx:nx, cy:ny});
      });

      //bind mouseup un body to stop
      $("body").one("mouseup.linkSVG", function (e) {
        $(line).remove();
        $(circle).remove();
        self.linkOnProgress = false;
        svg.removeClass("linkOnProgress");

        $(self.svg.root()).unbind("mousemove.linkSVG");
        var targetBox = $(e.target).closest(".taskBoxSVG");
        //console.debug("create link from " + taskBox.attr("taskid") + " to " + targetBox.attr("taskid"));

        if (targetBox && targetBox.attr("taskid") != taskBox.attr("taskid")) {
          var taskTo;
          var taskFrom;
          if (self.linkFromEnd) {
            taskTo = self.master.getTask(targetBox.attr("taskid"));
            taskFrom = self.master.getTask(taskBox.attr("taskid"));
          } else {
            taskFrom = self.master.getTask(targetBox.attr("taskid"));
            taskTo = self.master.getTask(taskBox.attr("taskid"));
          }

          if (taskTo && taskFrom) {
            var gap = 0;
            var depInp = taskTo.rowElement.find("[name=depends]");
            depInp.val(depInp.val() + ((depInp.val() + "").length > 0 ? "," : "") + (taskFrom.getRow() + 1) + (gap != 0 ? ":" + gap : ""));
            depInp.blur();
          }
        }
      });
    });
  }
  //ask for redraw link
  self.redrawLinks();

  //prof.stop();


  function _createTaskSVG(task, dimensions) {
    var svg = self.svg;
    var taskSvg = svg.svg(self.tasksGroup, dimensions.x, dimensions.y, dimensions.width, dimensions.height, {class:"taskBox taskBoxSVG taskStatusSVG", status:task.status, taskid:task.id,fill:task.color||"#eee" });

    //svg.title(taskSvg, task.name);
    //external box
    var layout = svg.rect(taskSvg, 0, 0, "100%", "100%", {class:"taskLayout", rx:"2", ry:"2"});

    //svg.rect(taskSvg, 0, 0, "100%", "100%", {fill:"rgba(255,255,255,.3)"});

    //external dep
    if (task.hasExternalDep)
      svg.rect(taskSvg, 0, 0, "100%", "100%", {fill:"url(#extDep)"});

    //progress
    if (task.progress > 0) {
      var progress = svg.rect(taskSvg, 0, 0, (task.progress > 100 ? 100 : task.progress) + "%", "100%", {rx:"2", ry:"2", fill:"rgba(0,0,0,)"});
    }

    if (task.hasChild)
      svg.rect(taskSvg, 0, 0, "100%", 3, {fill:"#000"});

    if (task.startIsMilestone) {
      svg.image(taskSvg, -9, dimensions.height/2-9, 18, 18, self.master.resourceUrl +"milestone.png");
    }

    if (task.endIsMilestone) {
      svg.image(taskSvg, "100%",dimensions.height/2-9, 18, 18, self.master.resourceUrl +"milestone.png", {transform:"translate(-9)"});
    }

    //task label
    var textElement = svg.text(taskSvg, "100%", 18, task.name);
    var padding = 5;
    var textWidth = textElement.getBBox().width;
    if (textWidth + 2 * padding <= dimensions.width) {
      $(textElement).attr('transform', 'translate(-' + (dimensions.width/2 + textWidth/2)  + ',-3)').addClass('taskLabelSVGWhite');
    } else {
      $(textElement).attr('transform', 'translate(20,-3)').addClass('taskLabelSVG');
    }


    //link tool
    if (task.level>0){
      var margin = 4;
      svg.circle(taskSvg, 0,  dimensions.height/2,dimensions.height/3, {class:"taskLinkStartSVG linkHandleSVG", transform:"translate("+(-dimensions.height/3-margin)+")"});
      svg.circle(taskSvg, "100%",dimensions.height/2,dimensions.height/3, {class:"taskLinkEndSVG linkHandleSVG", transform:"translate("+(dimensions.height/3+margin)+")"});
    }
    return taskSvg;
  }

};


Ganttalendar.prototype.addTask = function (task) {
  //set new boundaries for gantt
  this.originalEndMillis = this.originalEndMillis > task.end ? this.originalEndMillis : task.end;
  this.originalStartMillis = this.originalStartMillis < task.start ? this.originalStartMillis : task.start;
};


//<%-------------------------------------- GANT DRAW LINK SVG ELEMENT --------------------------------------%>
//'from' and 'to' are tasks already drawn
Ganttalendar.prototype.drawLink = function (from, to, type) {
  var self = this;
  //console.debug("drawLink")
  var peduncolusSize = 10;

  /**
   * Given an item, extract its rendered position
   * width and height into a structure.
   */
  function buildRect(item) {
    var p = item.ganttElement.position();
    var rect = {
      left:  parseFloat(item.ganttElement.attr("x")),
      top:   parseFloat(item.ganttElement.attr("y")),
      width: parseFloat(item.ganttElement.attr("width")),
      height:parseFloat(item.ganttElement.attr("height"))
    };
    return rect;
  }

  /**
   * The default rendering method, which paints a start to end dependency.
   */
  function drawStartToEnd(from, to, ps) {
    var svg = self.svg;

    //this function update an existing link
    function update() {
      var group = $(this);
      var from = group.data("from");
      var to = group.data("to");

      var rectFrom = buildRect(from);
      var rectTo = buildRect(to);

      var fx1 = rectFrom.left;
      var fx2 = rectFrom.left + rectFrom.width;
      var fy = rectFrom.height / 2 + rectFrom.top;

      var tx1 = rectTo.left;
      var tx2 = rectTo.left + rectTo.width;
      var ty = rectTo.height / 2 + rectTo.top;


      var tooClose = tx1 < fx2 + 2 * ps;
      var r = 5; //radius
      var arrowOffset = 5;
      var up = fy > ty;
      var fup = up ? -1 : 1;

      var prev = fx2 + 2 * ps > tx1;
      var fprev = prev ? -1 : 1;

      var image = group.find("image");
      var p = svg.createPath();

      if (tooClose) {
        var firstLine = fup * (rectFrom.height / 2 - 2 * r + 2);
        p.move(fx2, fy)
          .line(ps, 0, true)
          .arc(r, r, 90, false, !up, r, fup * r, true)
          .line(0, firstLine, true)
          .arc(r, r, 90, false, !up, -r, fup * r, true)
          .line(fprev * 2 * ps + (tx1 - fx2), 0, true)
          .arc(r, r, 90, false, up, -r, fup * r, true)
          .line(0, (Math.abs(ty - fy) - 4 * r - Math.abs(firstLine)) * fup - arrowOffset, true)
          .arc(r, r, 90, false, up, r, fup * r, true)
          .line(ps, 0, true);
        image.attr({x:tx1 - 5, y:ty - 5 - arrowOffset});

      } else {
        p.move(fx2, fy)
          .line((tx1 - fx2) / 2 - r, 0, true)
          .arc(r, r, 90, false, !up, r, fup * r, true)
          .line(0, ty - fy - fup * 2 * r + arrowOffset, true)
          .arc(r, r, 90, false, up, r, fup * r, true)
          .line((tx1 - fx2) / 2 - r, 0, true);
        image.attr({x:tx1 - 5, y:ty - 5 + arrowOffset});
      }

      group.find("path").attr({d:p.path()});
    }


    // create the group
    var group = svg.group(self.linksGroup, "" + from.id + "-" + to.id);
    svg.title(group, from.name + " -> " + to.name);

    var p = svg.createPath();

    //add the arrow
    svg.image(group, 0, 0, 5, 10, self.master.resourceUrl +"linkArrow.png");
    //create empty path
    svg.path(group, p, {class:"taskLinkPathSVG"});

    //set "from" and "to" to the group, bind "update" and trigger it
    var jqGroup = $(group).data({from:from, to:to }).attr({from:from.id, to:to.id}).on("update", update).trigger("update");

    if (self.showCriticalPath && from.isCritical && to.isCritical)
      jqGroup.addClass("critical");

    jqGroup.addClass("linkGroup");
    return jqGroup;
  }


  /**
   * A rendering method which paints a start to start dependency.
   */
  function drawStartToStart(from, to) {
    console.error("StartToStart not supported on SVG");
    var rectFrom = buildRect(from);
    var rectTo = buildRect(to);
  }

  var link;
  // Dispatch to the correct renderer
  if (type == 'start-to-start') {
    link = drawStartToStart(from, to, peduncolusSize);
  } else {
    link = drawStartToEnd(from, to, peduncolusSize);
  }

  if (GanttMaster.permissions.canWrite && (from.canWrite || to.canWrite)) {
    link.click(function (e) {
      var el = $(this);
      e.stopPropagation();// to avoid body remove focused
      self.element.find("[class*=focused]").removeClass("focused");
      $(".ganttSVGBox .focused").removeClass("focused");
      if (!self.resDrop)
        el.addClass("focused");
      self.resDrop = false; //hack to avoid select

      $("body").off("click.focused").one("click.focused", function () {
        $(".ganttSVGBox .focused").removeClass("focused");
      });

    });
  }


};

Ganttalendar.prototype.redrawLinks = function () {
  //console.debug("redrawLinks ");
  var self = this;
  this.element.stopTime("ganttlnksredr");
  this.element.oneTime(60, "ganttlnksredr", function () {

    //var prof=new Profiler("gd_drawLink_real");

    //remove all links
    $("#linksSVG").empty();

    var collapsedDescendant = [];

    //[expand]
    collapsedDescendant = self.master.getCollapsedDescendant();

    var sortedLinks = self.master.links;

    // sort the links in an order that the critical ones are painted at the end
    if (self.showCriticalPath && !self.nonCriticalHidden) {
      sortedLinks = _.sortBy(sortedLinks, function (link) {
        return link.from.isCritical && link.to.isCritical;
      });
    }

    _.each(sortedLinks, function (link) {

      // hide links of hidden tasks
      if (collapsedDescendant.indexOf(link.from) >= 0 || collapsedDescendant.indexOf(link.to) >= 0) return true;
      if (self.master.nonCriticalHidden) {
        if (link.from.isHidden || link.to.isHidden) return true;
      }

      self.drawLink(link.from, link.to);
    });

    //prof.stop();
  });
};


Ganttalendar.prototype.reset = function () {
  this.element.find("[class*=linkGroup]").remove();
  this.element.find("[taskid]").remove();
};


Ganttalendar.prototype.redrawTasks = function () {
  //[expand]
  //var prof = new Profiler("ganttRedrawTasks");
  var collapsedDescendant = this.master.getCollapsedDescendant();
  for (var i = 0; i < this.master.tasks.length; i++) {
    var task = this.master.tasks[i];
    if (collapsedDescendant.indexOf(task) >= 0) continue;
    this.drawTask(task);
  }
  //prof.stop();
};

Ganttalendar.prototype.getScrollPos = function () {
  var par = this.element.parent();

  //try to maintain last scroll
  var scrollY = par.scrollTop();
  var scrollX = par.scrollLeft();

  return {scrollX: scrollX, scrollY: scrollY};
};

Ganttalendar.prototype.setScrollPos = function (scrollX, scrollY) {
  var par = this.element.parent();
  par.scrollTop(scrollY);
  par.scrollLeft(scrollX);
};


Ganttalendar.prototype.refreshGantt = function () {
  //console.debug("refreshGantt")

  if (this.showCriticalPath) {
    this.master.computeCriticalPath();
  }


  var par = this.element.parent();

  //try to maintain last scroll
  var scrollY = par.scrollTop();
  var scrollX = par.scrollLeft();

  this.element.remove();
  //guess the zoom level in base of period
  if (!this.zoom) {
    var days = Math.round((this.originalEndMillis - this.originalStartMillis) / (3600000 * 24));
    //"d", "w","w2","w3", "m","m2", "q", "s", "y"
    this.zoom = this.zoomLevels[days < 2 ? 0 : (days < 15 ? 1 : (days < 30 ? 2 : (days < 45 ? 3 : (days < 60 ? 4 : (days < 90 ? 5 : (days < 180 ? 6 : (days < 600 ? 7 : 8  )  )  )  ) ) ) )];
  }
  var domEl = this.create(this.zoom, this.originalStartMillis, this.originalEndMillis);
  this.element = domEl;
  par.append(domEl);

  //var computedWidth = par.find('.ganttHead2 th').first().outerWidth();
  //this.fx = this.computeScaleFactor(this.zoom, computedWidth);

  this.redrawTasks();

  //set old scroll  
  //console.debug("old scroll:",scrollX,scrollY)
  par.scrollTop(scrollY);
  par.scrollLeft(scrollX);

  //set current task
  this.synchHighlight();

};


Ganttalendar.prototype.fitGantt = function () {
  delete this.zoom;
  this.refreshGantt();
};

Ganttalendar.prototype.synchHighlight = function () {
  //console.debug("synchHighlight",this.master.currentTask);
  if (this.master.currentTask ){
    // take care of collapsed rows
    var ganttHighLighterPosition=this.master.editor.element.find(".taskEditRow:visible").index(this.master.currentTask.rowElement);
    this.master.gantt.element.find(".ganttLinesSVG").removeClass("rowSelected").eq(ganttHighLighterPosition).addClass("rowSelected");
  } else {
    $(".rowSelected").removeClass("rowSelected"); // todo non c'era
  }
};


Ganttalendar.prototype.getCenterMillis= function () {
  return parseInt((this.element.parent().scrollLeft()+this.element.parent().width()/2)/this.fx+this.startMillis);
};

Ganttalendar.prototype.goToMillis= function (millis) {
  var x = Math.round(((millis) - this.startMillis) * this.fx) -this.element.parent().width()/2;
  this.element.parent().scrollLeft(x);
};

Ganttalendar.prototype.centerOnToday = function () {
  this.goToMillis(new Date().getTime());
};


/**
 * Allows drag and drop and extesion of task boxes. Only works on x axis
 * @param opt
 * @return {*}
 */
$.fn.dragExtedSVG = function (svg, opt) {

  //doing this can work with one svg at once only
  var target;
  var svgX;
  var offsetMouseRect;

  var options = {
    canDrag:        true,
    canResize:      true,
    minSize:        10,
    startDrag:      function (e) {},
    drag:           function (e) {},
    drop:           function (e) {},
    startResize:    function (e) {},
    resize:         function (e) {},
    stopResize:     function (e) {}
  };

  $.extend(options, opt);

  this.each(function () {
    var el = $(this);
    svgX = svg.parent().offset().left; //parent is used instead of svg for a Firefox oddity
    if (options.canDrag)
      el.addClass("deSVGdrag");

    if (options.canResize || options.canDrag) {
      el.bind("mousedown.deSVG",function (e) {
          //console.debug("mousedown.deSVG");
          if ($(e.target).is("image")) {
            e.preventDefault();
          }

          target = $(this);
          var x1 = parseFloat(el.find("[class*=taskLayout]").offset().left);
          var x2 = x1 + parseFloat(el.attr("width"));
          var posx = e.pageX;
          var resizeZoneWidth = Math.min(10, (x2 - x1) / 3);

          $("body").unselectable();

          var one;

          //start resize end
          if (options.canResize && (posx<=x2 &&  posx >= x2 - resizeZoneWidth)) {
            //store offset mouse x2
            offsetMouseRect = x2 - e.pageX;
            target.attr("oldw", target.attr("width"));

            one = true;

            //bind event for start resizing
            $(svg).bind("mousemove.deSVG", function (e) {

              if (one) {
                //trigger startResize
                options.startResize.call(target.get(0), e);
                one = false;
              }

              //manage resizing
              var nW =  e.pageX - x1 + offsetMouseRect;

              target.attr("width", nW < options.minSize ? options.minSize : nW);
              //callback
              options.resize.call(target.get(0), e);
            });

            //bind mouse up on body to stop resizing
            $("body").one("mouseup.deSVG", stopResize);


          //start resize start
          } else  if (options.canResize && (posx>=x1 && posx<=x1+resizeZoneWidth)) {
            //store offset mouse x1
            offsetMouseRect = parseFloat(target.attr("x"));
            target.attr("oldw", target.attr("width")); //todo controllare se è ancora usato oldw

            one = true;

            //bind event for start resizing
            $(svg).bind("mousemove.deSVG", function (e) {

              if (one) {
                //trigger startResize
                options.startResize.call(target.get(0), e);
                one = false;
              }

              //manage resizing
              var nx1= offsetMouseRect-(posx-e.pageX);
              var nW = (x2-x1) + (posx-e.pageX);
              nW=nW < options.minSize ? options.minSize : nW;
              target.attr("x",nx1);
              target.attr("width", nW);
              //callback
              options.resize.call(target.get(0), e);
            });

            //bind mouse up on body to stop resizing
            $("body").one("mouseup.deSVG", stopResize);



            // start drag
          } else if (options.canDrag) {
            //store offset mouse x1
            offsetMouseRect = parseFloat(target.attr("x")) - e.pageX;
            target.attr("oldx", target.attr("x"));

            one = true;
            //bind event for start dragging
            $(svg).bind("mousemove.deSVG",function (e) {
              if (one) {
                //trigger startDrag
                options.startDrag.call(target.get(0), e);
                one = false;
              }

              //manage resizing
              target.attr("x", offsetMouseRect + e.pageX);
              //callback
              options.drag.call(target.get(0), e);

            }).bind("mouseleave.deSVG", drop);

            //bind mouse up on body to stop resizing
            $("body").one("mouseup.deSVG", drop);

          }
        }

      ).bind("mousemove.deSVG",
        function (e) {
          var el = $(this);
          var x1 = el.find("[class*=taskLayout]").offset().left;
          var x2 = x1 + parseFloat(el.attr("width"));
          var resizeZoneWidth = Math.min(10, (x2 - x1) / 3);
          var posx = e.pageX;

          //set cursor handle
          if (options.canResize  &&((posx<=x2 &&  posx >= x2 - resizeZoneWidth) || (posx>=x1 && posx<=x1 + resizeZoneWidth))) {
            el.addClass("deSVGhand");
          } else {
            el.removeClass("deSVGhand");
          }
        }

      ).addClass("deSVG");
    }
  });
  return this;


  function stopResize(e) {
    $(svg).unbind("mousemove.deSVG").unbind("mouseup.deSVG").unbind("mouseleave.deSVG");
    if (target && target.attr("oldw")!=target.attr("width"))
      options.stopResize.call(target.get(0), e); //callback
    target = undefined;
    $("body").clearUnselectable();
  }

  function drop(e) {
    $(svg).unbind("mousemove.deSVG").unbind("mouseup.deSVG").unbind("mouseleave.deSVG");
    if (target && target.attr("oldx") != target.attr("x"))
      options.drop.call(target.get(0), e); //callback
    target = undefined;
    $("body").clearUnselectable();
  }

};
