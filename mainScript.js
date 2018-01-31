var ge;

var ganttDataLoaded = false;

function receiveMessage(event)
{
  // check same origin.
  if (event.origin !== location.origin) return;

  // check the message validity
  if (!event.data || !event.data.type ) return;

  switch (event.data.type) {
    case "load_data": {
      if (ganttDataLoaded) {
        ge.reset();
      } else {
        initGantt();
      }
      loadData(event.data.data);
      ganttDataLoaded = true;
      break;
    }
  }

}

$(document).ready( function () {
  var msg = { type: 'fetch_data' };
  parent.postMessage(msg, location.origin);
});

window.addEventListener("message", receiveMessage, false);

if (window.addEventListener) {
  // For standards-compliant web browsers
  window.addEventListener("message", receiveMessage, false);
} else {
  window.attachEvent("onmessage", receiveMessage);
}

var initGantt = function () {
  // here starts gantt initialization
  ge = new GanttMaster();
  ge.set100OnClose=true;

  ge.init($("#workSpace"));
  loadI18n(); //overwrite with localized ones
};

var loadData = function (project) {

  //in order to force compute the best-fitting zoom level
  delete ge.gantt.zoom;

  if (!project.canWrite)
    $(".ganttButtonBar button.requireWrite").attr("disabled","true");

  ge.loadProject(project);
  ge.checkpoint(); //empty the undo stack
};

function loadI18n() {
  GanttMaster.messages = {
    "CANNOT_WRITE":"CANNOT_WRITE",
    "CHANGE_OUT_OF_SCOPE":"NO_RIGHTS_FOR_UPDATE_PARENTS_OUT_OF_EDITOR_SCOPE",
    "START_IS_MILESTONE":"START_IS_MILESTONE",
    "END_IS_MILESTONE":"END_IS_MILESTONE",
    "TASK_HAS_CONSTRAINTS":"TASK_HAS_CONSTRAINTS",
    "GANTT_ERROR_DEPENDS_ON_OPEN_TASK":"GANTT_ERROR_DEPENDS_ON_OPEN_TASK",
    "GANTT_ERROR_DESCENDANT_OF_CLOSED_TASK":"GANTT_ERROR_DESCENDANT_OF_CLOSED_TASK",
    "TASK_HAS_EXTERNAL_DEPS":"TASK_HAS_EXTERNAL_DEPS",
    "GANTT_ERROR_LOADING_DATA_TASK_REMOVED":"GANTT_ERROR_LOADING_DATA_TASK_REMOVED",
    "ERROR_SETTING_DATES":"ERROR_SETTING_DATES",
    "CIRCULAR_REFERENCE":"CIRCULAR_REFERENCE",
    "CANNOT_DEPENDS_ON_ANCESTORS":"CANNOT_DEPENDS_ON_ANCESTORS",
    "CANNOT_DEPENDS_ON_DESCENDANTS":"CANNOT_DEPENDS_ON_DESCENDANTS",
    "INVALID_DATE_FORMAT":"INVALID_DATE_FORMAT",
    "TASK_MOVE_INCONSISTENT_LEVEL":"TASK_MOVE_INCONSISTENT_LEVEL",

    "GANTT_QUARTER_SHORT":"trim.",
    "GANTT_SEMESTER_SHORT":"sem."
  };
}

function saveGantt() {
  var prj = ge.saveProject();
  var msg = { type: 'save_data', data: prj };
  parent.postMessage(msg, '*');
}