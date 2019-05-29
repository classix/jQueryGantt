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

var GanttConstants = {
  SCHEDULE_DIR: {
    FORWARD: 0,
    BACKWARD: 1,
    NO_SCHEDULING: 2
  },
  ZERO_TASK_WIDTH: 3
};

function GanttMaster() {
  this.tasks = [];
  this.deletedTaskIds = [];
  this.links = [];

  //this.editor; //element for editor
  //this.gantt; //element for gantt
  //this.splitter; //element for splitter

  this.isMultiRoot=false; // set to true in case of tasklist

  this.schedulingDirection = GanttConstants.SCHEDULE_DIR.FORWARD;

  //this.workSpace;  // the original element used for containing everything
  //this.element; // editor and gantt box without buttons

  this.minEditableDate = 0;
  this.maxEditableDate = Infinity;
  this.set100OnClose=false;

  this.defaultTaskColor = "rgba(59, 191, 103, 0.9)";

  this.showSaveButton = false;

  this.fillWithEmptyLines=true; //when is used by widget it could be usefull to do not fill with empty lines

  this.minRowsInEditor=30; // number of rows always visible in editor

  this.serverClientTimeOffset = 0;

  this.proactiveMode = true; // request holiday information if missing

  //this.currentTask; // task currently selected;

  this.resourceUrl = "res/"; // URL to resources (images etc.)
  //this.__currentTransaction;  // a transaction object holds previous state during changes
  this.__undoStack = [];
  this.__redoStack = [];
  this.__inUndoRedo = false; // a control flag to avoid Undo/Redo stacks reset when needed

  var self = this;
}

GanttMaster.prototype.init = function (workSpace) {
  var place=$("<div>").prop("id","TWGanttArea").css( {padding:0, "overflow-y":"auto", "overflow-x":"hidden","border":"1px solid #e5e5e5",position:"relative"});
  workSpace.append(place).addClass("TWGanttWorkSpace");

  this.workSpace=workSpace;
  this.element = place;

  //by default task are coloured by status
  this.element.addClass('colorByStatus');

  var self = this;
  //load templates
  $.JST.loadTemplates();

  //create editor
  this.editor = new GridEditor(this);
  place.append(this.editor.gridified);

  //create gantt
  var startDate = !_.isNil(this.viewStartDate) ? this.viewStartDate : (new Date().getTime() - 3600000 * 24 * 2);
  var endDate = !_.isNil(this.viewEndDate) ? this.viewEndDate : (new Date().getTime() + 3600000 * 24 * 15);
  this.gantt = new Ganttalendar("m", startDate, endDate, this, place.width() * 0.6);

  //setup splitter
  self.splitter = $.splittify.init(place, this.editor.gridified, this.gantt.element, 50);
  self.splitter.firstBoxMinWidth = 5;
  self.splitter.secondBoxMinWidth = 20;

  //prepend buttons
  var ganttButtons = $.JST.createFromTemplate({}, "GANTBUTTONS");
  place.before(ganttButtons);
  this.checkButtonPermissions();

  //bindings
  workSpace.bind("refreshTasks.gantt", function () {
    self.redrawTasks();
  }).bind("refreshTask.gantt", function (e, task) {
    self.drawTask(task);
  }).bind("deleteFocused.gantt", function (e) {
    //delete task or link?
    var focusedSVGElement=self.gantt.element.find(".focused.focused.linkGroup");
    if (focusedSVGElement.size()>0)
      self.removeLink(focusedSVGElement.data("from"), focusedSVGElement.data("to"));
    else
    self.deleteCurrentTask();
  }).bind("addAboveCurrentTask.gantt", function () {
    self.addAboveCurrentTask();
  }).bind("addBelowCurrentTask.gantt", function () {
    self.addBelowCurrentTask();
  }).bind("indentCurrentTask.gantt", function () {
    self.indentCurrentTask();
  }).bind("outdentCurrentTask.gantt", function () {
    self.outdentCurrentTask();
  }).bind("moveUpCurrentTask.gantt", function () {
    self.moveUpCurrentTask();
  }).bind("moveDownCurrentTask.gantt", function () {
    self.moveDownCurrentTask();
  }).bind("collapseAll.gantt", function () {
    self.collapseAll();
  }).bind("expandAll.gantt", function () {
    self.expandAll();
  }).bind("fullScreen.gantt", function () {
    self.fullScreen();
  }).bind("zoomPlus.gantt", function () {
    self.gantt.zoomGantt(true);
  }).bind("zoomMinus.gantt", function () {
    self.gantt.zoomGantt(false);
  }).bind("undo.gantt", function () {
    if (!GanttMaster.permissions.canWrite)
      return;
    self.undo();
  }).bind("redo.gantt", function () {
    if (!GanttMaster.permissions.canWrite)
      return;
    self.redo();
  }).bind("resize.gantt", function () {
    self.resize();
  }).bind("refresh.gantt", function () {
    // redraws Ganttalendar (the table with the bars and dates)
    var gantt = self.gantt;
    gantt.refreshCritical();
    gantt.refreshGantt();
  });


  //keyboard management bindings
  $("body").bind("keydown.body", function (e) {
    

    var eventManaged = true;
    var isCtrl = e.ctrlKey || e.metaKey;
    var bodyOrSVG = e.target.nodeName.toLowerCase() == "body" || e.target.nodeName.toLowerCase() == "svg";
    var inWorkSpace=$(e.target).closest("#TWGanttArea").length>0;

    //store focused field
    var focusedField=$(":focus");
    var focusedSVGElement = self.gantt.element.find(".focused.focused");// orrible hack for chrome that seems to keep in memory a cached object

    var isFocusedSVGElement=focusedSVGElement.length >0;

    if ((inWorkSpace ||isFocusedSVGElement) && isCtrl && e.keyCode == 37) { // CTRL+LEFT on the grid
      self.outdentCurrentTask();
      focusedField.focus();

    } else if (inWorkSpace && isCtrl && e.keyCode == 38) { // CTRL+UP   on the grid
      self.moveUpCurrentTask();
      focusedField.focus();

    } else if (inWorkSpace && isCtrl && e.keyCode == 39) { //CTRL+RIGHT  on the grid
      self.indentCurrentTask();
      focusedField.focus();

    } else if (inWorkSpace && isCtrl && e.keyCode == 40) { //CTRL+DOWN   on the grid
      self.moveDownCurrentTask();
      focusedField.focus();

    } else if (isCtrl && e.keyCode == 89) { //CTRL+Y
      self.redo();

    } else if (isCtrl && e.keyCode == 90) { //CTRL+Y
      self.undo();


    } else if ( (isCtrl && inWorkSpace) &&   (e.keyCode == 8 || e.keyCode == 46)  ) { //CTRL+DEL CTRL+BACKSPACE  on grid
      self.deleteCurrentTask();

    } else if ( focusedSVGElement.is(".taskBox") &&   (e.keyCode == 8 || e.keyCode == 46)  ) { //DEL BACKSPACE  svg task
        self.deleteCurrentTask();

    } else if ( focusedSVGElement.is(".linkGroup") &&   (e.keyCode == 8 || e.keyCode == 46)  ) { //DEL BACKSPACE  svg link
        self.removeLink(focusedSVGElement.data("from"), focusedSVGElement.data("to"));

    } else {
      eventManaged=false;
    }


    if (eventManaged) {
      e.preventDefault();
      e.stopPropagation();
    }

  });

  //ask for comment input
  $("#saveGanttButton").after($('#LOG_CHANGES_CONTAINER'));

  //ask for comment management
  this.element.on("saveRequired.gantt",this.manageSaveRequired);


  //resize
  $(window).resize(function () {
    place.css({width: "100%", height: $(window).height() - place.position().top});
    place.trigger("resize.gantt");
  }).oneTime(2, "resize", function () {$(this).trigger("resize");});


};

GanttMaster.messages = {
  "CANNOT_WRITE":                          "CANNOT_WRITE",
  "CHANGE_OUT_OF_SCOPE":                   "NO_RIGHTS_FOR_UPDATE_PARENTS_OUT_OF_EDITOR_SCOPE",
  "START_IS_MILESTONE":                    "START_IS_MILESTONE",
  "END_IS_MILESTONE":                      "END_IS_MILESTONE",
  "TASK_HAS_CONSTRAINTS":                  "TASK_HAS_CONSTRAINTS",
  "GANTT_ERROR_DEPENDS_ON_OPEN_TASK":      "GANTT_ERROR_DEPENDS_ON_OPEN_TASK",
  "GANTT_ERROR_DESCENDANT_OF_CLOSED_TASK": "GANTT_ERROR_DESCENDANT_OF_CLOSED_TASK",
  "TASK_HAS_EXTERNAL_DEPS":                "TASK_HAS_EXTERNAL_DEPS",
  "GANTT_ERROR_LOADING_DATA_TASK_REMOVED": "GANTT_ERROR_LOADING_DATA_TASK_REMOVED",
  "CIRCULAR_REFERENCE":                    "CIRCULAR_REFERENCE",
  "CANNOT_MOVE_TASK":                      "CANNOT_MOVE_TASK",
  "CANNOT_DEPENDS_ON_ANCESTORS":           "CANNOT_DEPENDS_ON_ANCESTORS",
  "CANNOT_DEPENDS_ON_GROUPS":              "CANNOT_DEPENDS_ON_GROUPS",
  "CANNOT_DEPENDS_ON_DESCENDANTS":         "CANNOT_DEPENDS_ON_DESCENDANTS",
  "INVALID_DATE_FORMAT":                   "INVALID_DATE_FORMAT",
  "GANTT_QUARTER_SHORT":                   "GANTT_QUARTER_SHORT",
  "GANTT_SEMESTER_SHORT":                  "GANTT_SEMESTER_SHORT",
  "PLEASE_SAVE_PROJECT":                   "PLEASE_SAVE_PROJECT",
  "MISSING_HOLIDAY":                       "MISSING_HOLIDAY"
};

GanttMaster.locales = {
  monthNames: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  // Month abbreviations. Change this for local month names 
  monthAbbreviations: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  // Full day names. Change this for local month names
  dayNames: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
  // Day abbreviations. Change this for local month names
  dayAbbreviations: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
  // Used for parsing ambiguous dates like 1/2/2000 - default to preferring 'American' format meaning Jan 2.
  // Set to false to prefer 'European' format meaning Feb 1
  preferAmericanFormat: false,
  // Set to 0=SUn for American 1=Mon for european
  firstDayOfWeek: 1,
  defaultFormat: "M/d/yyyy",
  millisInWorkingDay: 28800000,
  workingDays: [1,2,3,4,5],
  holidays: [],
  // formats in Ganttalendar ...
  header_year_format: "yyyy",
  header_semester_format_begin: "MMMM",
  header_semester_format_end: "MMMM yyyy",
  header_semester_format_unit: "MMM",
  header_quarter_format_begin: "MMMM",
  header_quarter_format_end: "MMMM yyyy",
  header_quarter_format_month_unit: "MMMM",
  header_quarter_format_week_unit: "w",
  header_month_format: "MMMM yyyy",
  header_month_format_unit: "d",
  header_week_format_begin: "d. MMMM",
  header_week_format_end: "d. MMMM yyyy",
  header_week_format_unit: "EEEE",
  header_day_format_begin: "d. MMMM",
  header_day_format_end: "d. MMMM yyyy",
  header_day_format_unit: "EEEE"
};

GanttMaster.permissions = {
  canWrite: true,
  canAdd: true,
  canDelete: true,
  canInOutdent: true,
  canMoveUpDown: true,
  canSeeDep: true,
  canSeeCriticalPath: true
};

GanttMaster.isHolidayInfoAvailable = function (start, end) {

  var ret = false;

  if (start && end) { // check range
    ret = GanttMaster.locales.holidaysStartDate && GanttMaster.locales.holidaysEndDate &&
      start >= GanttMaster.locales.holidaysStartDate && end <= GanttMaster.locales.holidaysEndDate;
  } else { // check only one date
    var date = start;
    ret = GanttMaster.locales.holidaysStartDate && GanttMaster.locales.holidaysEndDate &&
      date >= GanttMaster.locales.holidaysStartDate && date <= GanttMaster.locales.holidaysEndDate;
  }

  return ret;
};

/**
 * checks whether the specified date lies in a date region, to which holiday information exists.
 * If this applies, the date is returned as it, regardless of padding.
 * Otherwise the nearest date with existent holiday information will be returned, after adding time padding,
 * if the padding parameter is set.
 * @param {Date Object} date to check
 * @param {Number} padding the padding to add in days, if padding is > 1 or = 0. Otherwise (in case of padding between 0 and 1), 
 * padding is the percentage of the time span, for which holiday information exist. 
 */
GanttMaster.getNearstDateWithHolidayInfo = function (date, padding) {

  padding = _.defaultTo(padding, 0);
  
  if (!GanttMaster.locales.holidaysStartDate || !GanttMaster.locales.holidaysEndDate) return undefined;

  if (GanttMaster.isHolidayInfoAvailable(date)) return date;

  var distanceToStart = Math.abs(date.getTime() - GanttMaster.locales.holidaysStartDate.getTime());
  var distanceToEnd = Math.abs(date.getTime() - GanttMaster.locales.holidaysEndDate.getTime());

  if (padding > 0 && padding < 1) {
    var paddingMillis = ((distanceToStart < distanceToEnd)? 1 : -1) * padding * (GanttMaster.locales.holidaysEndDate.getTime() - GanttMaster.locales.holidaysStartDate.getTime());
    var refDate = (distanceToStart < distanceToEnd) ? GanttMaster.locales.holidaysStartDate : GanttMaster.locales.holidaysEndDate;
    return new Date(refDate.getTime() + paddingMillis);
  } else {
    return (distanceToStart < distanceToEnd) ? new Date(GanttMaster.locales.holidaysStartDate).add('d', padding) : new Date(GanttMaster.locales.holidaysEndDate).add('d', -1 * padding);
  }

};

GanttMaster.isHoliday = function (date) { 

  date.clearTime();

  // check working day
  var isWorkingDay = _.includes(GanttMaster.locales.workingDays, date.getDay());
  if (!isWorkingDay) return true;

  // check holiday
  if (!GanttMaster.locales.holidaysStartDate || !GanttMaster.locales.holidaysEndDate || date < GanttMaster.locales.holidaysStartDate || date > GanttMaster.locales.holidaysEndDate) {
    ge.setHolidayErrorOnTransaction(date);
  }
  return GanttMaster.locales.holidays.indexOf(date.getTime()) !== -1; // the date has been cleared already
  
};


GanttMaster.prototype.createTask = function (id, name, code, level, start, end, duration, color) {
  var factory = new TaskFactory(this);
  return factory.build(id, name, code, level, start, end, duration, null, color);
};

//update depends strings
GanttMaster.prototype.updateDependsStrings = function () {
  
  for (var i = 0; i < this.tasks.length; i++) {
    // remove all links from new parents
    var task = this.tasks[i];
    if (task.isParent()) {
      _.remove(this.links, function (l) { return l.from === task || l.to === task; });
    }
    //remove all deps (clear all deps string)
    this.tasks[i].depends = "";
  }

  for (var j = 0; j < this.links.length; j++) {
    var link = this.links[j];
    link.to.depends = link.to.depends + (link.to.depends == "" ? "" : ",") + (link.from.getRow() + 1) + (link.lag ? ":" + link.lag : "");
  }

};

GanttMaster.prototype.removeLink = function (fromTask, toTask) {
  
  if (!GanttMaster.permissions.canWrite || (!fromTask.canWrite && !toTask.canWrite))
    return;

  var self = this;
  var cachedParameter = {
    fromTaskId: _.clone(fromTask.id),
    toTaskId: _.clone(toTask.id)
  };

  this.registerTransaction(function() {
    var found = false;
    
    var fromTask = self.getTask(cachedParameter.fromTaskId);
    var toTask = self.getTask(cachedParameter.toTaskId);

    for (var i = 0; i < self.links.length; i++) {
      if (self.links[i].from == fromTask && self.links[i].to == toTask) {
        self.links.splice(i, 1);
        found = true;
        break;
      }
    }

    if (found) {
      self.updateDependsStrings();
      if (self.updateLinks(toTask))
        self.changeTaskDates(toTask, toTask.start, toTask.end, false, toTask.duration === 0, false); // fake change to force date recomputation from dependencies
    }

  });
};

GanttMaster.prototype.removeAllLinks = function (task, openTrans) {
  
  if (!GanttMaster.permissions.canWrite || (!task.canWrite && !task.canWrite))
    return;

  var self = this;
  var cachedParameter = {
    taskId: _.clone(task.id)
  };

  var changeFunc = function () {

    var task = self.getTask(cachedParameter.taskId);

    var found = false;
    for (var i = 0; i < self.links.length; i++) {
      if (self.links[i].from == task || self.links[i].to == task) {
        self.links.splice(i, 1);
        found = true;
      }
    }
  
    if (found) {
      self.updateDependsStrings();
    }
  };

  if (openTrans) {
    this.registerTransaction(changeFunc);
  } else {
    changeFunc();
  }

};

//------------------------------------  ADD TASK --------------------------------------------
GanttMaster.prototype.addTask = function (task, row, forceAdd) {
  
  
  if (!forceAdd && (!GanttMaster.permissions.canWrite || !GanttMaster.permissions.canAdd ))
    return;

  task.master = this; // in order to access controller from task

  //replace if already exists
  var pos = -1;
  for (var i = 0; i < this.tasks.length; i++) {
    if (task.id == this.tasks[i].id) {
      pos = i;
      break;
    }
  }

  if (pos >= 0) {
    this.tasks.splice(pos, 1);
    row = parseInt(pos);
  }

  //add task in collection
  if (typeof(row) != "number") {
    this.tasks.push(task);
  } else {
    this.tasks.splice(row, 0, task);

    //recompute depends string
    this.updateDependsStrings();
  }

  //add Link collection in memory
  var linkLoops = !this.updateLinks(task);

  //set the status according to parent
  if (this.useStatus) {
    if (task.getParent())
      task.status = task.getParent().status;
    else
      task.status = "STATUS_ACTIVE";
  }

  var ret = task;
  if (linkLoops || !task.setPeriod(task.start, task.end)) {
    //remove task from in-memory collection
    
    this.tasks.splice(task.getRow(), 1);
    ret = undefined;
  } else {
    //append task to editor
    this.editor.addTask(task, row);
    //append task to gantt
    this.gantt.addTask(task);
  }

//trigger addedTask event 
  $(this.element).trigger("addedTask.gantt", task);
  return ret;
};


/**
 * a project contais tasks and info about permisions
 * @param project
 */
GanttMaster.prototype.loadProject = function (project, keepScroll) {

  var backward = this.schedulingDirection === GanttConstants.SCHEDULE_DIR.BACKWARD;
  

  var self = this;

  this.registerTransaction(function() {

    self.serverClientTimeOffset = typeof project.serverTimeOffset != "undefined" ? (parseInt(project.serverTimeOffset) + new Date().getTimezoneOffset() * 60000) : 0;

    if (project.minEditableDate)
      self.minEditableDate = computeStart(project.minEditableDate, backward);
    else
      self.minEditableDate = -Infinity;

    if (project.maxEditableDate)
      self.maxEditableDate = computeEnd(project.maxEditableDate, backward);
    else
      self.maxEditableDate = Infinity;

    //shift dates in order to have client side the same hour (e.g.: 23:59) of the server side
    for (var i = 0; i < project.tasks.length; i++) {
      var task = project.tasks[i];
      task.start += self.serverClientTimeOffset;
      task.end += self.serverClientTimeOffset;
    }

    self.loadTasks(project.tasks, project.selectedRow);
    self.deletedTaskIds = [];

    //recover saved zoom level
    if (project.zoom) {
      self.gantt.zoom = project.zoom;
    }

  });

  if (!keepScroll) {

    // fit the splitter position
    setTimeout(function () {
      var newPercent = $(".gdfTable").width() / $("body").width() * 100;
      if (newPercent < 50 && newPercent > 0) {
        self.splitter.resize(newPercent);
      }
    });
    

    if (this.includeToday) {
      this.gantt.element.oneTime(200, function () {self.gantt.centerOnToday();});
    }
  }
};


GanttMaster.prototype.loadTasks = function (tasks, selectedRow, isForRollBack) {

  
  var factory = new TaskFactory(this);
  //reset
  this.reset();

  var task;

  for (var i = 0; i < tasks.length; i++) {
    task = tasks[i];
    if (!(task instanceof Task)) {
      var t = factory.build(task.id, task.name, task.code, task.level, task.start, task.end, task.duration, task.collapsed, task.color);
      for (var key in task) {
        if (key != "end" && key != "start") {
          t[key] = task[key]; //copy all properties
        }
      }
      task = t;
    }
    task.master = this; // in order to access controller from task
    this.tasks.push(task);  //append task at the end
  }

  
  for (var j = 0; j < this.tasks.length; j++) {
    task = this.tasks[j];

    var numOfError = this.__currentTransaction && this.__currentTransaction.errors ? this.__currentTransaction.errors.length : 0;
    //add Link collection in memory
    while (!this.updateLinks(task)) {  // error on update links while loading can be considered as "warning". Can be displayed and removed in order to let transaction commits.
      if (this.__currentTransaction && numOfError != this.__currentTransaction.errors.length) {
        var msg = "";
        while (numOfError < this.__currentTransaction.errors.length) {
          var err = this.__currentTransaction.errors.pop();
          msg = msg + err.msg + "\n\n";
        }
        showErrorMsg(msg);
      }
      this.removeAllLinks(task, false);
    }

    if (!task.setPeriod(task.start, task.end, !isForRollBack, false, task.duration === 0, false)) {
      showErrorMsg(GanttMaster.messages.GANTT_ERROR_LOADING_DATA_TASK_REMOVED + "\n" + task.name);
      //remove task from in-memory collection
      this.tasks.splice(task.getRow(), 1);
    } else {
      //append task to editor
      this.editor.addTask(task, null, true);
      //append task to gantt
      this.gantt.addTask(task);
    }
  }

  //this.editor.fillEmptyLines();
  //prof.stop();

  // re-select old row if tasks is not empty
  if (this.tasks && this.tasks.length > 0) {
    selectedRow = selectedRow ? selectedRow : 0;
    this.tasks[selectedRow].rowElement.click();
  }
};


GanttMaster.prototype.getTask = function (taskId) {
  var ret;
  for (var i = 0; i < this.tasks.length; i++) {
    var tsk = this.tasks[i];
    if (tsk.id == taskId) {
      ret = tsk;
      break;
    }
  }
  return ret;
};

GanttMaster.prototype.getTaskIndex = function (task) {
  return _.indexOf(this.tasks, task) + 1;
};

GanttMaster.prototype.changeTaskDeps = function (task) {
  if (this.schedulingDirection === GanttConstants.SCHEDULE_DIR.BACKWARD) {
    return task.moveTo(task.end);
  } else {
    return task.moveTo(task.start);
  }
};

GanttMaster.prototype.changeTaskDates = function (task, start, end, ignoreMilestones, noDuration, fromEditor) {
  return task.setPeriod(start, end, false, ignoreMilestones, noDuration, fromEditor);
};


GanttMaster.prototype.moveTask = function (task, newDate) {
  return task.moveTo(newDate, true, task.isParent());
};


GanttMaster.prototype.taskIsChanged = function () {
  
  var master = this;

  //refresh is executed only once every 50ms
  this.element.stopTime("gnnttaskIsChanged");

  this.element.oneTime(50, "gnnttaskIsChanged", function () {
    master.gantt.refreshCritical();
    master.editor.redraw();
    master.gantt.refreshGantt(); 
    master.element.trigger("gantt.refreshGanttCompleted");
    // send the updated data to ClassiX Core
    if (master.autoUpdate) {
      updateGantt();
    }
  });
};


GanttMaster.prototype.checkButtonPermissions = function () {
  var ganttButtons=this.element.parent().find(".ganttButtonBar");

  // show all buttons
  ganttButtons.find(".requireCanWrite, .requireCanAdd, .requireCanInOutdent, .requireCanMoveUpDown, .requireCanDelete, .requireCanSeeCriticalPath").show();

  //hide buttons basing on permissions
  if (!GanttMaster.permissions.canWrite) {
    ganttButtons.find(".requireCanWrite").hide();
  }

  if (!GanttMaster.permissions.canAdd) {
    ganttButtons.find(".requireCanAdd").hide();
  }

  if (!GanttMaster.permissions.canInOutdent) {
    ganttButtons.find(".requireCanInOutdent").hide();
  }

  if (!GanttMaster.permissions.canMoveUpDown) {
    ganttButtons.find(".requireCanMoveUpDown").hide();
  }

  if (!GanttMaster.permissions.canDelete) {
    ganttButtons.find(".requireCanDelete").hide();
  }

  if (!GanttMaster.permissions.canSeeCriticalPath) {
    ganttButtons.find(".requireCanSeeCriticalPath").hide();
  }

  // show/hide save button
  ganttButtons.find(".btnSave")[this.showSaveButton?'show':'hide']();

};


GanttMaster.prototype.redraw = function () {
  this.gantt.refreshCritical();
  this.editor.redraw();
  this.gantt.refreshGantt();
};

GanttMaster.prototype.reset = function () {
  
  this.tasks = [];
  this.links = [];
  this.deletedTaskIds = [];
  if (!this.__inUndoRedo) {
    this.__undoStack = [];
    this.__redoStack = [];
  } else { // don't reset the stacks if we're in an Undo/Redo, but restart the inUndoRedo control
    this.__inUndoRedo = false;
  }
  delete this.currentTask;

  this.checkButtonPermissions();

  this.editor.reset();
  this.gantt.reset();
};


GanttMaster.prototype.showTaskEditor = function (taskId) {
  var task = this.getTask(taskId);
  task.rowElement.find(".edit").click();
};

GanttMaster.prototype.saveProject = function () {
  return this.saveGantt(false);
};

GanttMaster.prototype.saveGantt = function (forTransaction) {
  var saved = [];
  for (var i = 0; i < this.tasks.length; i++) {
    var task = this.tasks[i];
    var cloned = task.clone();
    delete cloned.master;
    delete cloned.rowElement;
    delete cloned.ganttElement;

    var self = this;

    //shift back to server side timezone
    if (!forTransaction) {
      _.each(["start", "end", "earliestStart", "earliestFinish", "latestStart", "latestFinish"], function (prop) {
        if (!_.isNil(cloned[prop])) {
          cloned[prop] -= self.serverClientTimeOffset;
        }
      });
    }

    saved.push(cloned);
  }

  var ret = {tasks: saved};
  if (this.currentTask) {
    ret.selectedRow = this.currentTask.getRow();
  }

  ret.deletedTaskIds = this.deletedTaskIds;  //this must be consistent with transactions and undo

  if (!forTransaction) {
    ret.canWrite = GanttMaster.permissions.canWrite;
    ret.zoom = this.gantt.zoom;

    //mark un-changed task and assignments
    this.markUnChangedTasksAndAssignments(ret);

  }

  //prof.stop();
  return ret;
};


GanttMaster.prototype.markUnChangedTasksAndAssignments=function(newProject){
  
  //si controlla che ci sia qualcosa di cambiato, ovvero che ci sia l'undo stack
  if (this.__undoStack.length>0){
    var oldProject=JSON.parse(ge.__undoStack[0]);
    //si looppano i "nuovi" task
    for (var i=0;i<newProject.tasks.length;i++){
      var newTask=newProject.tasks[i];
      //se è un task che c'erà già
      if (typeof (newTask.id) === "string" && !newTask.id.startsWith("tmp_")){
        //si recupera il vecchio task
        var oldTask;
        for (var j=0;j<oldProject.tasks.length;j++){
          if (oldProject.tasks[j].id==newTask.id){
            oldTask=oldProject.tasks[j];
            break;
          }
        }

        //si controlla se ci sono stati cambiamenti
        var taskChanged=
          oldTask.id != newTask.id ||
          oldTask.code != newTask.code ||
          oldTask.name != newTask.name ||
          oldTask.start != newTask.start ||
          oldTask.startIsMilestone != newTask.startIsMilestone ||
          oldTask.end != newTask.end ||
          oldTask.endIsMilestone != newTask.endIsMilestone ||
          oldTask.duration != newTask.duration ||
          oldTask.status != newTask.status ||
          oldTask.typeId != newTask.typeId ||
          oldTask.relevance != newTask.relevance ||
          oldTask.progress != newTask.progress ||
          oldTask.progressByWorklog != newTask.progressByWorklog ||
          oldTask.description != newTask.description ||
          oldTask.level != newTask.level||
          oldTask.depends != newTask.depends;

        newTask.unchanged=!taskChanged;

      }
    }
  }
};

GanttMaster.prototype.updateLinks = function (task) {

  // defines isLoop function
  function isLoop(task, target, visited) {
    if (target == task) {
      return true;
    }

    var sups = task.getSuperiors();

    //my parent' superiors are my superiors too
    var p = task.getParent();
    while (p) {
      sups = sups.concat(p.getSuperiors());
      p = p.getParent();
    }

    //my children superiors are my superiors too
    var chs = task.getChildren();
    for (var i = 0; i < chs.length; i++) {
      sups = sups.concat(chs[i].getSuperiors());
    }

    var loop = false;
    //check superiors
    for (var j = 0; j < sups.length; j++) {
      var supLink = sups[j];
      if (supLink.from == target) {
        loop = true;
        break;
      } else {
        if (visited.indexOf(supLink.from.id + "x" + target.id) <= 0) {
          visited.push(supLink.from.id + "x" + target.id);
          if (isLoop(supLink.from, target, visited)) {
            loop = true;
            break;
          }
        }
      }
    }

    //check target parent
    var tpar = target.getParent();
    if (tpar) {
      if (visited.indexOf(task.id + "x" + tpar.id) <= 0) {
        visited.push(task.id + "x" + tpar.id);
        if (isLoop(task, tpar, visited)) {
          loop = true;
        }
      }
    }

    //prof.stop();
    return loop;
  }

  //remove my depends
  this.links = this.links.filter(function (link) {
    return link.to != task;
  });

  var todoOk = true;

  if (!_.isNil(task.depends) && !_.isEmpty(task.depends)) {

    if (task.isParent()) {
      this.setErrorOnTransaction(GanttMaster.messages.CANNOT_DEPENDS_ON_GROUPS + "\n\"" + task.name+"\"");
      todoOk = false;
    }

    //cannot depend from an ancestor
    var parents = task.getParents();
    //cannot depend from descendants
    var descendants = task.getDescendant();

    var deps = task.depends.split(",");
    var newDepsString = "";

    var visited = [];
    for (var j = 0; j < deps.length; j++) {
      var dep = deps[j]; // in the form of row(lag) e.g. 2:3,3:4,5
      var par = dep.split(":");
      var lag = 0;

      if (par.length > 1) {
        lag = parseInt(par[1]);
      }

      var sup = this.tasks[parseInt(par[0] - 1)];

      if (sup) {
        if (sup.isParent()) {
          this.setErrorOnTransaction(GanttMaster.messages.CANNOT_DEPENDS_ON_GROUPS + "\n\"" + sup.name+"\"");
          todoOk = false;
        }
        else if (parents && parents.indexOf(sup) >= 0) {
          this.setErrorOnTransaction("\""+task.name + "\"\n" + GanttMaster.messages.CANNOT_DEPENDS_ON_ANCESTORS + "\n\"" + sup.name+"\"");
          todoOk = false;

        } else if (descendants && descendants.indexOf(sup) >= 0) {
          this.setErrorOnTransaction("\""+task.name + "\"\n" + GanttMaster.messages.CANNOT_DEPENDS_ON_DESCENDANTS + "\n\"" + sup.name+"\"");
          todoOk = false;

        } else if (isLoop(sup, task, visited)) {
          todoOk = false;
          this.setErrorOnTransaction(GanttMaster.messages.CIRCULAR_REFERENCE + "\n\"" + task.name + "\" -> \"" + sup.name+"\"");
        } else {
          this.links.push(new Link(sup, task, lag));
          newDepsString = newDepsString + (newDepsString.length > 0 ? "," : "") + dep;
        }
      }
    }

    task.depends = newDepsString;

  }

  //prof.stop();

  return todoOk;
};


GanttMaster.prototype.moveUpCurrentTask = function () {
  var self = this;
  
  if (self.currentTask) {
  if (!GanttMaster.permissions.canWrite  || !self.currentTask.canWrite || !GanttMaster.permissions.canMoveUpDown )
    return;

    self.registerTransaction(function () {
      self.currentTask.moveUp();
    });
  }
};

GanttMaster.prototype.moveDownCurrentTask = function () {
  var self = this;
  if (self.currentTask) {
  if (!GanttMaster.permissions.canWrite  || !self.currentTask.canWrite || !GanttMaster.permissions.canMoveUpDown )
    return;

    self.registerTransaction(function () {
      self.currentTask.moveDown();
    });

  }
};

GanttMaster.prototype.outdentCurrentTask = function () {
  var self = this;
  if (self.currentTask) {
  if (!GanttMaster.permissions.canWrite || !self.currentTask.canWrite  || !GanttMaster.permissions.canInOutdent)
    return;

    var par = self.currentTask.getParent();

    self.registerTransaction(function () {
      self.currentTask.outdent();
    });

    //[expand]
    if (par) self.editor.refreshExpandStatus(par);
  }
};

GanttMaster.prototype.indentCurrentTask = function () {
  var self = this;
  if (self.currentTask) {
  if (!GanttMaster.permissions.canWrite || !self.currentTask.canWrite|| !GanttMaster.permissions.canInOutdent)
    return;

    self.registerTransaction(function () {
      self.currentTask.indent();
    });

    var newParent = self.currentTask.getParent();
    if (newParent && newParent.isCollapsed()) {
      self.currentTask.rowElement.hide();
    }
  }
};

GanttMaster.prototype.addBelowCurrentTask = function () {
  var self = this;
  if (!GanttMaster.permissions.canWrite|| !GanttMaster.permissions.canAdd)
    return;

  this.registerTransaction(function () {
    var factory = new TaskFactory(self);
    var ch;
    var row = 0;
    if (self.currentTask && self.currentTask.name) {
      ch = factory.build("tmp_" + new Date().getTime(), "", "", self.currentTask.level+ (self.currentTask.isParent()||self.currentTask.level==0?1:0), self.currentTask.start, self.currentTask.end, 1, null, self.defaultTaskColor);
      row = self.currentTask.getRow() + 1;

      if (row > 0) {
        var task = self.addTask(ch, row);
        if (task) {
          task.rowElement.click();
          task.rowElement.find("[name=name]").focus();
        }
      }
    }
  });
};

GanttMaster.prototype.addAboveCurrentTask = function () {
  var self = this;
  if (!GanttMaster.permissions.canWrite || !GanttMaster.permissions.canAdd)
    return;

  this.registerTransaction(function () {

    var factory = new TaskFactory(self);
    var ch;
    var row = 0;
    if (self.currentTask  && self.currentTask.name) {
      //cannot add brothers to root
      if (self.currentTask.level <= 0)
        return;

      ch = factory.build("tmp_" + new Date().getTime(), "", "", self.currentTask.level, self.currentTask.start, self.currentTask.end, 1, null, self.defaultTaskColor);
      row = self.currentTask.getRow();

      if (row > 0) {
        var task = self.addTask(ch, row);
        if (task) {
          task.rowElement.click();
          task.rowElement.find("[name=name]").focus();
        }
      }
    }

  });
  
};

GanttMaster.prototype.deleteCurrentTask = function () {
  
  var self = this;
  if (!self.currentTask || !GanttMaster.permissions.canDelete && !self.currentTask.canDelete)
    return;

  this.registerTransaction(function () {
    var row = self.currentTask.getRow();
    if (self.currentTask && (row > 0 || self.isMultiRoot || self.currentTask.isNew()) ) {
      var par = self.currentTask.getParent();

      self.currentTask.deleteTask();
      self.currentTask = undefined;

      //recompute depends string
      self.updateDependsStrings();

      //redraw
      self.redraw();

      //[expand]
      if (par) self.editor.refreshExpandStatus(par);

      //focus next row
      row = row > self.tasks.length - 1 ? self.tasks.length - 1 : row;
      if (row >= 0) {
        self.currentTask = self.tasks[row];
        self.currentTask.rowElement.click();
        self.currentTask.rowElement.find("[name=name]").focus();
      }
    }
  });
};




GanttMaster.prototype.collapseAll = function () {
  
  if (this.currentTask){
    this.currentTask.collapsed=true;
    var desc = this.currentTask.getDescendant();
    for (var i=0; i<desc.length; i++) {
      if (desc[i].isParent()) // set collapsed only if is a parent
        desc[i].collapsed = true;
      desc[i].rowElement.hide();
    }

    this.redraw();

  }
};

GanttMaster.prototype.fullScreen = function () {
  
  if (window.frameElement) {
    if (this.workSpace.is(".ganttFullScreen")) {
      $(window.frameElement).css({ position: "", top: "", left: "", bottom: "", right: "", margin: "", zIndex: "", backgroundColor: "", width: "", height: ""});
    } else {
      $(window.frameElement).css({ position: "fixed", top:0, left:0, bottom:0, right: 0, margin: "auto", zIndex: 27, backgroundColor: "#fff", width: "100%", height: "100%" });
    }
    this.workSpace.toggleClass("ganttFullScreen").resize();
    $("#fullscrbtn .teamworkIcon").html(this.workSpace.is(".ganttFullScreen")?"€":"@");
  }
};


GanttMaster.prototype.expandAll = function () {
  
  if (this.currentTask){
    this.currentTask.collapsed=false;
    var desc = this.currentTask.getDescendant();
    for (var i=0; i<desc.length; i++) {
      desc[i].collapsed = false;
      desc[i].rowElement.show();
    }

    this.redraw();

  }
};



GanttMaster.prototype.collapse = function (task, all) {
  
  task.collapsed=true;
  task.rowElement.addClass("collapsed");

  var descs = task.getDescendant();
  for (var i = 0; i < descs.length; i++)
    descs[i].rowElement.hide();


  this.gantt.refreshCritical();
  this.gantt.refreshGantt();

};

GanttMaster.prototype.showHideCriticalPath = function (mode) {
    
    if (!mode || mode === 'toggle') {
      this.gantt.showCriticalPath = !this.gantt.showCriticalPath;
    } else if (mode === 'on') {
      this.gantt.showCriticalPath = true;
    } else {
      this.gantt.showCriticalPath = false;
    }
    
    this.redraw();
    this.element.parent().find(".showCriticalPathButton").toggleClass("redButton");
};

GanttMaster.prototype.showHideNonCriticalTasks =  function () {
  var allTasks = this.tasks;
  if (this.nonCriticalHidden) {
    // the non critical tasks are hidden, so we want to show all tasks
    _.each(allTasks, function (task) {
      if (!task.isCritical) {
        task.isHidden = false;
        task.rowElement.show();
      }
    });
  } else { // only show the critical tasks
    
    // check if the critical path is shown
    if (!this.gantt.showCriticalPath) {
      // show and compute the critical path
      this.showHideCriticalPath();
    }

    // now hide all non critical tasks
    _.each(allTasks, function (task) {
      if (!task.isCritical) {
        task.isHidden = true;
        task.rowElement.hide();
      }
    });
  }
  this.nonCriticalHidden = !this.nonCriticalHidden;
  this.gantt.refreshCritical();
  this.gantt.refreshGantt();
  this.element.parent().find(".onlyCriticalTasksButton").toggleClass("redButton");
};

GanttMaster.prototype.scheduleProject = function (schedulingDate) {
  if (this.schedulingDirection === GanttConstants.SCHEDULE_DIR.NO_SCHEDULING) return;

  var self = this;
  var schedulingDiff = 0;

  if (schedulingDate > 0) {

    var taskMoved = false;

    if (this.schedulingDirection === GanttConstants.SCHEDULE_DIR.FORWARD) { // forward scheduling
      var minStart = _.minBy(this.tasks, 'start').start;
      schedulingDiff = minStart - schedulingDate;
      if (schedulingDiff !== 0) {
        // move the tasks that are free from incoming links
        _.each(this.tasks, function (t) { 
          if (!_.find(self.links, {to: t})) { 
            t.moveTo(t.start - schedulingDiff);
            taskMoved = true;
          }
        });
      }
    } else { // backward scheduling
      var maxEnd = _.maxBy(this.tasks, 'end').end;
      schedulingDiff = schedulingDate - maxEnd;
      if (schedulingDiff !== 0) {
        // move the tasks that are free from outgoing links
        _.each(this.tasks, function (t) { 
          if (!_.find(self.links, {from: t})) {
            t.moveTo(t.end + schedulingDiff);
            taskMoved = true;
          }
        });
      }
    }

    if (taskMoved) {
      this.redraw();
    }
  }

};


GanttMaster.prototype.expand = function (task,all) {
  
  task.collapsed=false;
  task.rowElement.removeClass("collapsed");

  var collapsedDescendant = this.getCollapsedDescendant();
  var descs = task.getDescendant();
  for (var i = 0; i < descs.length; i++) {
    var childTask = descs[i];
    if (collapsedDescendant.indexOf(childTask) >= 0) continue;
    childTask.rowElement.show();
  }

  this.gantt.refreshCritical();
  this.gantt.refreshGantt();

};


GanttMaster.prototype.getCollapsedDescendant = function () {
  var allTasks = this.tasks;
  var collapsedDescendant = [];
  for (var i = 0; i < allTasks.length; i++) {
    var task = allTasks[i];
    if (collapsedDescendant.indexOf(task) >= 0) continue;
    if (task.collapsed) collapsedDescendant = collapsedDescendant.concat(task.getDescendant());
  }
  return collapsedDescendant;
};

//<%----------------------------- TRANSACTION MANAGEMENT ---------------------------------%>
GanttMaster.prototype.beginTransaction = function (lite) {
  var transName = lite ? '__currentLiteTransaction' : '__currentTransaction';
  if (!this[transName] || lite) {
    this[transName] = {
      snapshot: lite ? null : JSON.stringify(this.saveGantt(true)),
      errors: []
    };
  } else {
    console.error("Cannot open twice a transaction");
  }
  return this[transName];
};


//this function notify an error to a transaction -> transaction will rollback
GanttMaster.prototype.setErrorOnTransaction = function (errorMessage, task) {
  if (this.__currentTransaction) {
    this.__currentTransaction.errors.push({msg: errorMessage, task: task});
  } else {
    console.error(errorMessage);
  }
};

GanttMaster.prototype.setHolidayErrorOnTransaction = function (start, end, forceOnLite) {

  end = _.defaultTo(end, start);

  var genericErrorSetter = function (ct) {
    if (!ct.holidayRequest) {
      ct.holidayRequest = {startDate: new Date(start.getTime()), endDate: new Date(end.getTime())};
    } else {
      if (start < ct.holidayRequest.startDate) {
        ct.holidayRequest.startDate = new Date(start.getTime());
      }
      if (end > ct.holidayRequest.endDate) {
        ct.holidayRequest.endDate = new Date(end.getTime());
      }
    }
  };

  if (!forceOnLite && this.__currentTransaction) { // try to set the holiday request on a normal transaction
    genericErrorSetter(this.__currentTransaction);
  } else if (this.__currentLiteTransaction) { // if no normal transaction is found, try to set the request on a lite transaction
    genericErrorSetter(this.__currentLiteTransaction);
  } else {
    console.log("There is no current transaction to set holiday error on.");
  }
};

GanttMaster.prototype.isTransactionInError = function () {
  if (!this.__currentTransaction) {
    console.error("Transaction never started.");
    return true;
  } else {
    return this.__currentTransaction.errors.length > 0;
  }

};

GanttMaster.prototype.registerTransaction = function (func, options) {
  options = options || {};
  // start transaction
  var t = this.beginTransaction(options.lite);
  // save the parameter in case of caching
  t.func = func;
  t.options = options;
  // execute the function
  func();
  // clear cached transaction, after it has been executed
  var transName = options.lite ? '__cachedLiteTransaction' : '__cachedTransaction';
  if (ge[transName] && func === ge[transName].func && options === ge[transName].options) {
    ge[transName] = null;
  }
  // end transaction
  this.endTransaction(options.withoutUndo, options.lite);
};

GanttMaster.prototype.endTransaction = function (withoutUndo, lite) {

  var transName = lite ? '__currentLiteTransaction' : '__currentTransaction';

  var msg = "";

  if (!this[transName]) {
    console.error("Transaction never started.");
    return true;
  }

  if (lite) {

    if (this.__currentLiteTransaction.holidayRequest) {

      if (this.proactiveMode) {
        // here we need to send a get_locale message
        requestHolidays(this.__currentLiteTransaction.holidayRequest.startDate, this.__currentLiteTransaction.holidayRequest.endDate);
        this.__cachedLiteTransaction = {
          func: this.__currentLiteTransaction.func, 
          options: this.__currentLiteTransaction.options 
        };
      } else {
        msg += GanttMaster.messages.MISSING_HOLIDAY + '\n (' + this.__currentLiteTransaction.holidayRequest.startDate.format() +
                ' - ' + this.__currentLiteTransaction.holidayRequest.endDate.format() + ')';
      }
  
      if (msg != "") {
        showErrorMsg(msg);
      }

      this.__currentLiteTransaction = undefined;

      return false;
    }

    return true;

  }

  var ret = true;

  //no error -> commit
  if (this.__currentTransaction.errors.length <= 0 && !this.__currentTransaction.holidayRequest) {
    

    //put snapshot in undo
    if (!withoutUndo) {
      this.__undoStack.push(this.__currentTransaction.snapshot);
    }
    //clear redo stack
    this.__redoStack = [];

    //shrink gantt bundaries
    if (this.autoShrinkCalendar) {
      this.gantt.originalStartMillis = Infinity;
      this.gantt.originalEndMillis = -Infinity;
      for (var i = 0; i < this.tasks.length; i++) {
        var task = this.tasks[i];
        if (this.gantt.originalStartMillis > task.start)
          this.gantt.originalStartMillis = task.start;
        if (this.gantt.originalEndMillis < task.end)
          this.gantt.originalEndMillis = task.end;
      }
    }
    //enqueue for gantt refresh
    this.taskIsChanged(); 

    //error -> rollback and/or holiday missing -> react
  } else {
    ret = false;
    

    if (this.__currentTransaction.errors.length) {
      //compose error message
      for (var j = 0; j < this.__currentTransaction.errors.length; j++) {
        var err = this.__currentTransaction.errors[j];
        msg = msg + err.msg + "\n\n";
      }      
    }

    if (this.__currentTransaction.holidayRequest) {
      if (this.proactiveMode) {
        // here we need to send a get_locale message
        requestHolidays(this.__currentTransaction.holidayRequest.startDate, this.__currentTransaction.holidayRequest.endDate);
        this.__cachedTransaction = {
          func: this.__currentTransaction.func, 
          options: this.__currentTransaction.options 
        };
      } else {
        msg += GanttMaster.messages.MISSING_HOLIDAY + '\n (' + this.__currentTransaction.holidayRequest.startDate.format() +
               ' - ' + this.__currentTransaction.holidayRequest.endDate.format() + ')';
      }
    }

    if (msg != "") {
      showErrorMsg(msg);
    }

    //try to restore changed tasks
    var oldTasks = JSON.parse(this.__currentTransaction.snapshot);
    this.deletedTaskIds = oldTasks.deletedTaskIds;
    this.__inUndoRedo = true; // avoid Undo/Redo stacks reset
    this.loadTasks(oldTasks.tasks, oldTasks.selectedRow, true);
    this.redraw();

  }
  //reset transaction
  this.__currentTransaction = undefined;

  //show/hide save button
  this.saveRequired();

  //[expand]
  this.editor.refreshExpandStatus(this.currentTask);

  return ret;
};

// inhibit undo-redo
GanttMaster.prototype.checkpoint = function () {
  
  this.__undoStack = [];
  this.__redoStack = [];
  this.saveRequired();
};

//----------------------------- UNDO/REDO MANAGEMENT ---------------------------------%>

GanttMaster.prototype.undo = function () {
  
  if (this.__undoStack.length > 0) {
    var his = this.__undoStack.pop();
    this.__redoStack.push(JSON.stringify(this.saveGantt()));
    var oldTasks = JSON.parse(his);
    this.deletedTaskIds = oldTasks.deletedTaskIds;
    this.__inUndoRedo = true; // avoid Undo/Redo stacks reset
    this.loadTasks(oldTasks.tasks, oldTasks.selectedRow, true);
    
    this.redraw();
    //show/hide save button
    this.saveRequired();

    // send the update message to ClassiX Core
    if (this.autoUpdate) {
      updateGantt();
    }
    
  }
};

GanttMaster.prototype.redo = function () {
  
  if (this.__redoStack.length > 0) {
    var his = this.__redoStack.pop();
    this.__undoStack.push(JSON.stringify(this.saveGantt()));
    var oldTasks = JSON.parse(his);
    this.deletedTaskIds = oldTasks.deletedTaskIds;
    this.__inUndoRedo = true; // avoid Undo/Redo stacks reset
    this.loadTasks(oldTasks.tasks, oldTasks.selectedRow, true);
    this.redraw();
    

    this.saveRequired();

    // send the update message to ClassiX Core
    if (this.autoUpdate) {
      updateGantt();
    }
  }
};


GanttMaster.prototype.saveRequired = function () {
  
  //show/hide save button
  if(this.__undoStack.length>0 && GanttMaster.permissions.canWrite) {
    $("#saveGanttButton").removeClass("disabled");
    $("form[alertOnChange] #Gantt").val(new Date().getTime()); // set a fake variable as dirty
    this.element.trigger("saveRequired.gantt",[true]);
  } else {
    $("#saveGanttButton").addClass("disabled");
    $("form[alertOnChange] #Gantt").updateOldValue(); // set a fake variable as clean
    this.element.trigger("saveRequired.gantt",[false]);
  }
};


GanttMaster.prototype.resize = function () {
  
  this.splitter.resize();
};



/**
 * Compute the critical path using Backflow algorithm.
 * Translated from Java code supplied by M. Jessup here http://stackoverflow.com/questions/2985317/critical-path-method-algorithm
 *
 * For each task computes:
 * earliestStart, earliestFinish, latestStart, latestFinish, criticalCost
 *
 * A task on the critical path has isCritical=true
 * A task not in critical path can float by latestStart-earliestStart days
 *
 * If you use critical path avoid usage of dependencies between different levels of tasks
 *
 * WARNNG: It ignore milestones!!!!
 * @return {*}
 */
GanttMaster.prototype.computeCriticalPath = function () {

  if (!this.tasks)
    return false;

  // do not consider grouping tasks
  var tasks = this.tasks.filter(function (t) {
    return !t.isParent(); 
  });

  // reset values
  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    t.earliestStart = -1;
    t.earliestFinish = -1;
    t.latestStart = -1;
    t.latestFinish = -1;
    t.criticalCost = -1;
    t.isCritical = false;
  }

  // tasks whose critical cost has been calculated
  var completed = [];
  // tasks whose critical cost needs to be calculated
  var remaining = tasks.concat(); // put all tasks in remaining as a copy


  // Backflow algorithm
  // while there are tasks whose critical cost isn't calculated.
  while (remaining.length > 0) {
    var progress = false;

    // find a new task to calculate
    for (var k = 0; k < remaining.length; k++) {
      var task = remaining[k];
      var inferiorTasks = task.getInferiorTasks();

      if (containsAll(completed, inferiorTasks)) {
        // all dependencies calculated, critical cost is max dependency critical cost, plus our cost
        var critical = 0;
        for (var j = 0; j < inferiorTasks.length; j++) {
          var ta = inferiorTasks[j];
          var critCostWithDepsLag = ta.criticalCost + _.find(this.links, {from: task, to: ta}).lag;
          if (critCostWithDepsLag > critical) {
            critical = critCostWithDepsLag;
          }
        }
        task.criticalCost = critical + task.duration;
        // set task as calculated an remove
        completed.push(task);
        remaining.splice(k, 1);

        // note we are making progress
        progress = true;
      }
    }
    // If we haven't made any progress then a cycle must exist in
    // the graph and we wont be able to calculate the critical path
    if (!progress) {
      console.error("Cyclic dependency, algorithm stopped!");
      return false;
    }
  }

  // set earliestStart, earliestFinish, latestStart, latestFinish
  computeMaxCost(tasks);
  var initialNodes = initials(tasks);
  calculateEarly(initialNodes);
  correctZeroDaysTasks(_.filter(tasks, function (t) {return t.duration === 0;}));
  calculateCritical(tasks);
  calculateFloats(tasks);

  _.each(this.tasks, function (t) {
    if (t.isParent() && t.level === 0) { // root group
      calculateGroupDates(t);
    }
  });

  return tasks;

  function containsAll(set, targets) {
    for (var i = 0; i < targets.length; i++) {
      if (set.indexOf(targets[i]) < 0)
        return false;
    }
    return true;
  }

  function correctZeroDaysTasks (zeroTasks) {
    _.each(zeroTasks, function (zeroTask) {
      var unifiedDate = new Date(zeroTask.start);
      zeroTask.earliestStartDate = unifiedDate;
      zeroTask.earliestFinishDate = new Date(unifiedDate.getTime());
      zeroTask.latestStartDate = new Date(unifiedDate.getTime());
      zeroTask.latestFinishDate = new Date(unifiedDate.getTime());
    });
  }

  function computeMaxCost(tasks) {
    var max = -1;
    var maxEnd = 0;
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];

      if (t.duration === 0) continue;

      if (t.criticalCost > max)
        max = t.criticalCost;

      if (t.end > maxEnd)
        maxEnd = t.end;
    }
    
    for (var j = 0; j < tasks.length; j++) {
      var ta = tasks[j];
      ta.setLatest(max, maxEnd);
    }
  }

  function findInitialsDeep (task, initials) {
    var infs = task.getInferiorTasks();
    _.each(infs, function (inf) {
      if (inf.duration > 0) {
        initials.push(inf);
      } else {
        findInitialsDeep(inf, initials);
      }
    });
  }

  function initials(tasks) {
    var initials = [];
    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];

      if (!task.depends || task.depends == "") {
        if (task.duration > 0) {
          initials.push(task);
        } else {
          // include it in the critical path, but not in the initials to avoid confusing root dates.
          task.earliestStart = 0;
          task.earliestFinish = task.duration;

          findInitialsDeep(task, initials);
        }
      }
    }
    return initials;
  }

  function calculateEarly(initials) {
    for (var i = 0; i < initials.length; i++) {
      var initial = initials[i];
      initial.earliestStart = 0;
      initial.earliestFinish = initial.duration;
      initial.earliestStartDate = initial.start;
      initial.earliestFinishDate = initial.end;
      setEarly(initial, new Date(initial.start));
    }
  }

  function setEarly(initial, rootDate) {
    var completionTime = initial.earliestFinish;
    var inferiorTasks = initial.getInferiorTasks();
    for (var i = 0; i < inferiorTasks.length; i++) {
      var t = inferiorTasks[i];
      completionTime += _.find(initial.master.links, {from: initial, to: t}).lag || 0;
      if (completionTime >= t.earliestStart) {
        t.earliestStart = completionTime;
        t.earliestStartDate = new Date(rootDate.getTime()).incrementDateByWorkingDays(t.earliestStart).getTime();
        t.earliestFinish = completionTime + t.duration;
        t.earliestFinishDate = new Date(rootDate.getTime()).incrementDateByWorkingDays(t.earliestFinish - (t.duration === 0 ? 0 : 1)).getTime();
      } 
      setEarly(t, rootDate);
    }
  }

  function calculateCritical(tasks) {
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      t.isCritical = (t.earliestStart == t.latestStart);
    }
  }

  function calculateFloats(tasks) {
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      t.totalFloat = t.latestStart - t.earliestStart;

      var minEarliestStartOfSucc = Infinity;
      var successors = t.getInferiorTasks();
      if (successors.length) {
          minEarliestStartOfSucc = _.minBy(successors, 'earliestStart').earliestStart;
      }
      t.freeFloat = minEarliestStartOfSucc - t.earliestFinish;
    }
  }

  function calculateGroupDates (group) {
      // beginn with the furthermost child group using recursivity to use the computed dates in the case of nested groups
      // escpecially if a group consists only of subgroups.
      _.each(_.filter(group.getChildren(), function (child) { return child.isParent();}), function (childGroup) {
        calculateGroupDates(childGroup);
      });
      var nonZeroChildren = _.filter(group.getChildren(), function(c) {return c.duration > 0;});
      group.earliestStartDate = new Date(_.minBy(nonZeroChildren, 'earliestStartDate').earliestStartDate);
      group.earliestFinishDate = (new Date(group.earliestStartDate.getTime())).incrementDateByWorkingDays(Math.max(0, group.duration - 1));
      group.latestFinishDate = new Date(_.maxBy(nonZeroChildren, 'latestFinishDate').latestFinishDate);
      var maxCriticalCostInGroup = _.maxBy(group.getChildren(), 'criticalCost').criticalCost;
      group.latestStartDate = (new Date(group.latestFinishDate.getTime())).decrementDateByWorkingDays(Math.max(0, maxCriticalCostInGroup - 1));
  }

};

//------------------------------------------- MANAGE CHANGE LOG INPUT ---------------------------------------------------
GanttMaster.prototype.manageSaveRequired=function(ev, showSave) {
  

  function checkChanges() {
    var changes = false;
    //there is somethin in the redo stack?
    if (ge.__undoStack.length > 0) {
      var oldProject = JSON.parse(ge.__undoStack[0]);
      //si looppano i "nuovi" task
      for (var i = 0; !changes && i < ge.tasks.length; i++) {
        var newTask = ge.tasks[i];
        //se è un task che c'erà già
        if (!(""+newTask.id).startsWith("tmp_")) {
          //si recupera il vecchio task
          var oldTask;
          for (var j = 0; j < oldProject.tasks.length; j++) {
            if (oldProject.tasks[j].id == newTask.id) {
              oldTask = oldProject.tasks[j];
              break;
            }
          }
          // chack only status or dateChanges
          if (oldTask && (oldTask.status != newTask.status || oldTask.start != newTask.start || oldTask.end != newTask.end)) {
            changes = true;
            break;
          }
        }
      }
    }
    $("#LOG_CHANGES_CONTAINER").css("display", changes ? "inline-block" : "none");
  }


  if (showSave) {
    $("body").stopTime("gantt.manageSaveRequired").oneTime(200, "gantt.manageSaveRequired", checkChanges);
  } else {
    $("#LOG_CHANGES_CONTAINER").hide();
  }

};

