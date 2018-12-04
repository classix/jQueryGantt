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
        loadGantt(event.data.project);
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
      break;
    }
    case "update_permissions": {
      setPermissions(event.data.data);
      break;
    }
    case "do_action": {
      switch(event.data.data.action) {
        case "toggle_critical_path": {
          ge.showHideCriticalPath();
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
    applyOptions();
    if (ganttDataLoaded) {
      var project = ge.saveProject();
      ge.reset();
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
  GanttMaster.locales.holidaysStartDate = Date.parseString(data.startDate, GanttMaster.locales.defaultFormat);
  GanttMaster.locales.holidaysEndDate = Date.parseString(data.endDate, GanttMaster.locales.defaultFormat);
};

var applyOptions = function () {
  var originalKeys = ['isMultiRoot', 'minEditableDate', 'maxEditableDate', 'completeOnClose', 'fillWithEmptyRows', 'minRowsInEditor', 'showSaveButton', 'schedulingDirection', 'autoUpdate', 'autoComputeCriticalPath'];
  var mapKeys = ['isMultiRoot', 'minEditableDate', 'maxEditableDate', 'set100OnClose', 'fillWithEmptyLines', 'minRowsInEditor', 'showSaveButton', 'schedulingDirection', 'autoUpdate', 'autoComputeCriticalPath'];
  
  for (var i = 0; i < originalKeys.length; i++) {
    var value = ganttOptions[originalKeys[i]];
    if (!_.isNil(value)) {
      ge[mapKeys[i]] = value;
    }
  }
};

var loadGantt = function (data) {

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
 
  ge.loadProject(data);
  ge.checkpoint(); //empty the undo stack

  ganttDataLoaded = true;
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