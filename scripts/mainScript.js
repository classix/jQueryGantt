// the variable representing jQueryGantt
var ge;
// tells whether jQueryGantt has been initialised before or not
var ganttDataLoaded = false;

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
      loadGantt(event.data);
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
  }
};

var attachMsgListener = function () {
  window.addEventListener("message", receiveMessage, false);

  if (window.addEventListener) {
    // For standards-compliant web browsers
    window.addEventListener("message", receiveMessage, false);
  } else {
    window.attachEvent("onmessage", receiveMessage);
  }
};

$(document).ready( function () {

  attachMsgListener();
  // send init message to MorphIT to inform that the initialization has been done
  var msg = { type: 'initialize' };
  parent.postMessage(msg, location.origin);
});

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
      console.error('Error: No working days specified at all. The standard will be used');
    } 
  }

  GanttMaster.locales.holidays = _.map(data.holidays, function (d) { return Date.parseString(d, GanttMaster.locales.dateFormat).clearTime().getTime(); });
  GanttMaster.locales.holidaysStartDate = Date.parseString(data.startDate, GanttMaster.locales.dateFormat);
  GanttMaster.locales.holidaysEndDate = Date.parseString(data.endDate, GanttMaster.locales.dateFormat);
};

var loadGantt = function (data) {

  var project = data.data;

  if (ganttDataLoaded) {
    ge.reset();
  } else {
    // here starts gantt initialization
    ge = new GanttMaster();
    // sets the progress status of a task to 100% when it is marked completed
    ge.set100OnClose=true;
    ge.init($("#workSpace"));
  }

  //in order to force compute the best-fitting zoom level
  delete ge.gantt.zoom;

  if (!project.canWrite)
    $(".ganttButtonBar button.requireWrite").attr("disabled","true");
 
  ge.loadProject(project);
  ge.checkpoint(); //empty the undo stack

  ganttDataLoaded = true;
};

function saveGantt() {
  var prj = ge.saveProject();
  var msg = { type: 'save_data', data: prj };
  parent.postMessage(msg, location.origin);
}