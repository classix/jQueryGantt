// the variable representing jQueryGantt
var ge;
// tells whether jQueryGantt has been initialised before or not
var ganttDataLoaded = false;

var ganttOptions = {};

var CLASSIX_EVENT_TYPE = {
  CLICK: 1,
  DB_CLICK: 2
};

/**
 * Sends an error message with an error text to the parent window, so that the parent window can show it 
 * accordingly to the parent window style
 * @param {string} text the error message
 */
var showErrorMsg = function (text) {
  var msg = { type: 'error', text: text };
  parent.postMessage(msg, location.origin);
};

/**
 * handels the received messages from the WebWidget Wrapper in MorphIT
 */
var receiveMessage = function (event)
{
  // check same origin.
  if (event.origin !== location.origin) return;

  // check the message validity
  if (!event.data || !event.data.type ) return;

  switch (event.data.type) {
    case "load_data": {
      if (!_.isNil(event.data.options)) {
        _.merge(ganttOptions, event.data.options);
      }
      if (!_.isNil(event.data.project)) {
        loadGantt(event.data.project, event.data.dependencies);
      }
      break;
    }
    case "update_data": {
      if (!_.isNil(event.data)) {
        updateTasksAndDeps(event.data.tasks, event.data.dependencies, event.data.selectedTaskId);
      }
      break;
    }
    case "update_options": {
      setOptions(event.data.options);
      break;
    }
    case "update_locales": {
      setLocale(event.data.data);
      break;
    }
    case "update_holidays": {
      setHolidays(event.data);
      // check if this was a response of a holidays request
      if (ge) {
        // normal transactions
        if (ge.__chachedTransaction) {
          ge.registerTransaction(ge.__chachedTransaction.func, ge.__chachedTransaction.options);
        } 
        // lite transactions (used mainly for rendering)
        if (ge.__chachedLiteTransaction) {
          ge.registerTransaction(ge.__chachedLiteTransaction.func, ge.__chachedLiteTransaction.options);
        }
      }
      break;
    }
    case "update_permissions": {
      setPermissions(event.data.data);
      break;
    }
    case "do_action": {
      switch(event.data.data.action) {
        case "toggle_critical_path": {
          ge.showHideCriticalPath(event.data.data.status);
          break;
        }
        case "toggle_only_critical": {
          ge.showHideNonCriticalTasks();
          break;
        }
        case "save_data": {
          saveGantt();
          break;
        }
        case "fit_range_into_view": {
          ge.gantt.fitRangeIntoView(event.data.data.rangeStart, event.data.data.rangeEnd);
          break;
        }
        case "schedule_project": {
          ge.scheduleProject(event.data.data.date);
          break;
        }
      }
    }
  }
};

$(document).ready( function () {
  // attach message event listener
  window.addEventListener("message", receiveMessage, false);
  // send init message to MorphIT to inform that the initialization has been done
  var msg = { type: 'initialize' };
  parent.postMessage(msg, location.origin);
});

var setPermissions = function (permissions) {
  _.assign(GanttMaster.permissions, permissions);

  if (ganttDataLoaded) {
    var project = ge.saveProject();
    ge.reset();
    ge.loadProject(project, true);
    ge.checkpoint(); //empty the undo stack
  }
};

var setOptions = function (options) {
  if (!_.isNil(options)) {
    _.merge(ganttOptions, options);
    if (ganttDataLoaded) {
      var project = ge.saveProject();
      applyOptions();
      ge.reset();
      if (!_.isNil(ganttOptions.zoom)) {
        project.zoom = ganttOptions.zoom;
      }
      ge.loadProject(project, true);
      ge.checkpoint(); //empty the undo stack
    }
  }
};

var setLocale = function (data) {
  
  var dpOptions = $.datepicker.regional[data.locale];
  if (dpOptions) {
    if (data.locales.defaultFormat) {
      dpOptions.dateFormat = data.locales.defaultFormat.toLowerCase().replace(/yyyy/g, 'yy');
    }
    $.datepicker.setDefaults(dpOptions);
  }

  _.assign(GanttMaster.messages, data.langItems);
  _.assign(GanttMaster.locales, data.locales);

  if (ganttDataLoaded) {
    $('.hasDatepicker').datepicker("option", $.datepicker.regional[data.locale]);
    $('.hasDatepicker').datepicker("option", "dateFormat", GanttMaster.locales.defaultFormat.toLowerCase().replace(/yyyy/g, 'yy'));

    // update the texts
    $.JST.updateTexts($("#workSpace"));
    // update the time table (Ganttalendar)
    $('#workSpace').trigger('refresh.gantt');
  }
};

var setHolidays = function (data) {

  if (!_.isNil(data.workingDays)) {
    // Gantt needs at least one working day
    if (data.workingDays.length) {
      GanttMaster.locales.workingDays = data.workingDays;
    } else {
      console.warn('Gantt: No working days specified at all. The standard will be used');
    } 
  }

  GanttMaster.locales.holidays = _.map(data.holidays, function (d) { return Date.parseString(d, GanttMaster.locales.defaultFormat).clearTime().getTime(); });
  GanttMaster.locales.holidaysStartDate = Date.parseString(data.startDate, GanttMaster.locales.defaultFormat).clearTime();
  GanttMaster.locales.holidaysEndDate = Date.parseString(data.endDate, GanttMaster.locales.defaultFormat).clearTime();
};

var applyOptions = function () {
  var originalKeys = ['isMultiRoot', 'minEditableDate', 'maxEditableDate', 'completeOnClose', 'fillWithEmptyRows', 
  'minRowsInEditor', 'showSaveButton', 'schedulingDirection', 'autoUpdate', 'autoComputeCriticalPath', 'viewStartDate', 
  'viewEndDate', 'includeToday', 'autoShrinkCalendar', 'useStatus', 'defaultTaskColor', 'proactiveMode'];
  var mapKeys = ['isMultiRoot', 'minEditableDate', 'maxEditableDate', 'set100OnClose', 'fillWithEmptyLines', 'minRowsInEditor', 
  'showSaveButton', 'schedulingDirection', 'autoUpdate', 'autoComputeCriticalPath', 'viewStartDate', 'viewEndDate', 
  'includeToday', 'autoShrinkCalendar', 'useStatus', 'defaultTaskColor', 'proactiveMode'];
  
  for (var i = 0; i < originalKeys.length; i++) {
    var value = ganttOptions[originalKeys[i]];
    if (!_.isNil(value)) {
      ge[mapKeys[i]] = value;
    }
  }

  if (ge.gantt) {
    if (!_.isNil(ganttOptions.viewStartDate)) {
      ge.gantt.originalStartMillis = ganttOptions.viewStartDate;
    }
    if (!_.isNil(ganttOptions.viewEndDate)) {
      ge.gantt.originalEndMillis = ganttOptions.viewEndDate;
    }
  }
};

// we need to convert the dependecies relationships from "task id" to "line index", because JQueryGantt works with line indices
// but ClassiX Core need to use the ids to make it easier for the InstantView programmer
var convertDependencies = function (dep, tasks) {
  if(_.isEmpty(dep)) return "";
  return _.join(_.map(_.split(dep, ","), function (d) {
    var parts = _.split(d, ":");
    parts[0] = _.findIndex(tasks, {id: _.trim(parts[0])}) + 1;
    return _.join(parts,":");
  }), ",");
};

var attachDependenciesToTasks = function (deps, tasks) {
  // process dependencies that are specifies under "dependencies" and not inline in task
  if (!_.isNil(deps) && !_.isNil(tasks)) {
    _.each(tasks, function (task) {
      var extDependencies = convertDependencies(_.join(_.map(_.filter(deps, {to: task.id}), function (d) { 
        return d.from + ((d.buffer > 0) ? ":" + d.buffer : "");
      }), ","), tasks);
      task.depends += (task.depends !== "" ? "," : "") + extDependencies;
    });
  }
};

var loadGantt = function (project, dependecies) {

  if (ganttDataLoaded) {
    applyOptions();
    ge.reset();
  } else {
    // here starts gantt initialization 
    ge = new GanttMaster(); 
    applyOptions();
    ge.init($("#workSpace")); 
  }

  //in order to force compute the best-fitting zoom level
  delete ge.gantt.zoom;

  _.each(project.tasks, function (task) {
    task.depends = convertDependencies(task.depends, project.tasks);
  });

  attachDependenciesToTasks(dependecies, project.tasks);
 
  ge.loadProject(project);
  ge.checkpoint(); //empty the undo stack

  ganttDataLoaded = true;
};

var updateTasksAndDeps = function (tasks, deps, selectedTaskId) {

  if (!ganttDataLoaded) return;
  var factory = new TaskFactory(ge);

  // convert the depends attributes of the tasks to dependencies, because we need first all tasks added before creating the
  // links between them (because we cannout predict the line number and yet to be added tasks could have dependencies between them )
  deps = deps || [];
  _.each(tasks, function (task) {
    if (_.trim(task.depends) != "") {
      _.each(_.split(task.depends, ","), function (d) {
        var parts = _.split(d, ":");
        deps.push({
          from: _.trim(parts[0]),
          to: task.id,
          buffer: parts.length > 1 ? parseInt(parts[1]) : 0 
        });
      });
      delete task.depends;
    }
  });

  // delete tasks to delete
  var tasksToDelete = _.intersectionWith(ge.tasks, _.remove(tasks, function (t) { return t.delete; }), function (o1, o2) { return o1.id === o2.id; });
  _.each(tasksToDelete, function (t) {
    t.deleteTask();
  });

  // add new tasks
  var newTasks = _.remove(tasks, function (t) { return -1 === _.findIndex(ge.tasks, {id: t.id}); });
  _.each(newTasks, function (t) {
    var newTask = factory.build(t.id, t.name, t.code, t.level, t.start + ge.serverClientTimeOffset, t.end + ge.serverClientTimeOffset, t.duration, t.collapsed, t.color);
    for (var key in t) {
      if (key != "end" && key != "start") {
        if (!_.isNil(t[key])) {
          newTask[key] = t[key]; //copy all properties
        }
      }
    }
    ge.addTask(newTask, null, true);
    
    // hide the new task if the parent is collapsed
    var parent = newTask.getParent();
    if (parent) {
      ge.editor.refreshExpandStatus(parent);
      if (parent.isCollapsed()) {
        newTask.rowElement.hide();
      }
    }
  });

  // alter existing tasks
  _.each(tasks, function (t) {
    var existingTask = _.find(ge.tasks, {id: t.id});
    if (!existingTask) return true; //continue
    for (var key in t) {
      if (!_.includes(["start", "end", "id", "depends", "duration", "level", "collapsed"], key)) {
        if (!_.isNil(t[key])) {
          existingTask[key] = t[key]; //copy all properties
        }
      }
    }

    // level
    if (!_.isNil(t.level) && t.level >= 0) {
      var levelDiff = t.level - _.defaultTo(existingTask.level, 0);
      if (levelDiff !== 0) {
        var oldParent = existingTask.getParent();
        if (levelDiff > 0) { // indent
          _.times(levelDiff, function () { existingTask.indent(); });
        } else if (levelDiff < 0) { // outdent
          _.times(-1 * levelDiff, function () { existingTask.outdent(); });
        }
        var newParent = existingTask.getParent();
        ge.editor.refreshExpandStatus(existingTask);
        if (oldParent) ge.editor.refreshExpandStatus(oldParent);
        if (newParent) {
          ge.editor.refreshExpandStatus(newParent);
          if (newParent.isCollapsed()) {
            existingTask.rowElement.hide();
          } else {
            existingTask.rowElement.show();
          }
        }
      }
    }

    // collapsed
    if (!_.isNil(t.collapsed) && t.collapsed !== _.defaultTo(existingTask.collapsed, false)) {
      if (t.collapsed) {
        ge.collapse(existingTask, false);
      } else {
        ge.expand(existingTask, false);
      }
    }

    if (!_.isNil(t.start) || !_.isNil(t.end) || (!_.isNil(t.duration) && !_.isNaN(t.duration) && t.duration > 0)) {
      // start, end, duration
      var dates = resynchDatesLogically(ge.schedulingDirection, t.start, t.end, t.duration, existingTask);
      ge.changeTaskDates(existingTask, dates.start, dates.end);
    }

  });

  var getTaskIndexCached = _.memoize(function (id) { return _.findIndex(ge.tasks, {id: id}); });

  // now update the dependencies
  var groupedDeps = _.groupBy(deps, 'to');
  _.each(groupedDeps, function (newDeps, to) {

    var taskToUpdateDeps = _.find(ge.tasks, {id: to});
    if (!taskToUpdateDeps) return true; // continue

    var existingDeps = [];
    taskToUpdateDeps.depends = _.trim(taskToUpdateDeps.depends);
    if (taskToUpdateDeps.depends != "") {
      _.each(_.split(taskToUpdateDeps.depends, ','), function (d) {
        var parts = _.split(d, ':');
        existingDeps.push({from: _.trim(parts[0]), buffer: parts.length > 1 ? _.parseInt(parts[1]) : 0});
      });
    }

    _.each(newDeps, function (d) {
      d.from = _.toString(getTaskIndexCached(d.from));
      if (d.delete) { // remove exisiting dependecy
        _.remove(existingDeps, {from: d.from});
      } else {
        var existingDep = _.find(existingDeps, {from: d.from});
        if (existingDep) { // update the buffer of an existent dependency
          if (!_.isNil(d.buffer) && !_.isNaN(d.buffer) && d.buffer >= 0) { 
            existingDep.buffer = d.buffer;
          }
        } else { // add a new dependency
          existingDeps.push({from: d.from, buffer: _.defaultTo(d.buffer, 0)});
        }
      }
    });
    var newDepString = _.join(_.map(existingDeps, function (d) { return d.from + ((d.buffer > 0) ? ":" + d.buffer : ""); }), ",");

    var oldDeps = taskToUpdateDeps.depends;
    taskToUpdateDeps.depends = newDepString;

    // update links
    var linkOK = ge.updateLinks(taskToUpdateDeps);
    if (linkOK) {
      ge.changeTaskDeps(taskToUpdateDeps);
    } else {
      taskToUpdateDeps.depends = oldDeps;
      return true; // continue
    }

  });

  ge.redraw();

  if (!_.isNil(selectedTaskId)) {
    var selTask = _.find(ge.tasks, {id: selectedTaskId});
    if (selTask) {
      selTask.rowElement.click();
    }
  }
};

function sendClassiXEvent(eventType, args) {
  var event_data = {};
  switch (eventType) {
    case CLASSIX_EVENT_TYPE.CLICK: {
      event_data.eventType = "click";
      event_data.taskId = args;
      break;
    }
    case CLASSIX_EVENT_TYPE.DB_CLICK: {
      event_data.eventType = "dbclick";
      event_data.taskId = args;
      break;
    }
  }
  var msg = { type: 'handle_event', data: event_data };
  parent.postMessage(msg, location.origin);
}

function saveGantt() {
  var prj = ge.saveProject();
  var msg = { type: 'save_data', data: prj };
  parent.postMessage(msg, location.origin);
}

function updateGantt() {
  var prj = ge.saveProject();
  var msg = { type: 'update_data', data: prj };
  parent.postMessage(msg, location.origin);
}

function requestHolidays(startDate, endDate) {
  var msg = { type: 'get_holidays', data: {startDate: startDate, endDate: endDate}};
  parent.postMessage(msg, location.origin);
}