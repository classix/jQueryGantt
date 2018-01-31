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

  loadI18n(); //overwrite with localized ones
  ge.init($("#workSpace"));
  
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

  GanttMaster.languageItems = {
    "STATUS_ACTIVE": "In Bearbeitung",
    "STATUS_DONE": "Erledigt",
    "STATUS_FAILED": "Fehlgeschalgen",
    "STATUS_SUSPENDED": "Suspendiert",
    "STATUS_UNDEFINED": "Undefiniert",
    "BUTTON_UNDO": "Rückgängig",
    "BUTTON_REDO": "Wiederholen",
    "BUTTON_INSERT_ABOVE": "Aktivität davon einfügen",
    "BUTTON_INSERT_BELOW": "Aktivität danach einfügen",
    "BUTTON_UNINDENT_TASK": "Aktivität nach links verschieben",
    "BUTTON_INDENT_TASK": "Aktivität nach rechts verschieben",
    "BUTTON_MOVE_UP": "Aktivität nach oben verschieben",
    "BUTTON_MOVE_DOWN": "Aktivität nach unten verschieben",
    "BUTTON_DELETE": "Löschen",
    "BUTTON_EXPAND_ALL": "Expandieren",
    "BUTTON_COLLAPSE_ALL": "Zusammenklappen",
    "BUTTON_ZOOM_OUT": "Zeitachse verkleinern",
    "BUTTON_ZOOM_IN": "Zeitachse vergrößern",
    "BUTTON_CRITICAL_PATH": "Kritischen Pfad anzeigen",
    "BUTTON_SHOW_ONLY_EDITOR": "Tabelle ausblenden",
    "BUTTON_SPLITTER_CENTER": "Ansicht zentrieren",
    "BUTTON_SHOW_ONLY_TABLE": "Diagrammbereich ausblenden",
    "BUTTON_FULLSCREEN": "Vollbild",
    "BUTTON_SAVE": "Speichern",
    "NAME_EINGEBEN": "Namen eingeben",
    "HEADER_CODE": "Abk.",
    "HEADER_NAME": "Aktivitätsname",
    "HEADER_START_MILESTONE": "Startdatum ist ein Meilenstein",
    "HEADER_START_DATE": "Startdatum",
    "HEADER_END_MILESTONE": "Enddatum ist ein Meilenstein",
    "HEADER_END_DATE": "Enddatum",
    "HEADER_DURATION": "Dauer",
    "HEADER_PROGRESS": "Fortschritt",
    "HEADER_DEPENDENCIES": "Abhängigkeiten"
  };
}

function saveGantt() {
  var prj = ge.saveProject();
  var msg = { type: 'save_data', data: prj };
  parent.postMessage(msg, '*');
}