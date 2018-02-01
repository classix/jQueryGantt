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
    case "change_locale": {
      setLocale(event.data.data.locale, event.data.data.langItems);
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
  // send init message to MorphIT to fetch data
  var msg = { type: 'fetch_data' };
  parent.postMessage(msg, location.origin);
});

var setLocale = function (locale, langItems) {
  
  $.datepicker.setDefaults($.datepicker.regional[locale]);
  GanttMaster.messages = langItems;

  if (ganttDataLoaded) {
    $('.hasDatepicker').datepicker( "option", $.datepicker.regional[locale] );
    // TODO apply the changes of GanttMaster.messages to the templates and formats.
  }
};

var loadGantt = function (data) {

  var project = data.data;

  setLocale(data.options.locale, data.options.langItems);

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
  parent.postMessage(msg, '*');
}