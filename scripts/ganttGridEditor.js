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
function GridEditor(master) {
  this.master = master; // is the a GantEditor instance

  var editorTabel = $.JST.createFromTemplate(master, "TASKSEDITHEAD");
  if (!GanttMaster.permissions.canSeeDep)
    editorTabel.find(".requireCanSeeDep").hide();

  this.gridified = $.gridify(editorTabel);

  this.element = this.gridified.find(".gdfTable").eq(1);
}


GridEditor.prototype.fillEmptyLines = function () {
  //console.debug("fillEmptyLines")
  var factory = new TaskFactory(this.master);
  var master = this.master;

  //console.debug("GridEditor.fillEmptyLines");
  var rowsToAdd = master.minRowsInEditor - this.element.find(".taskEditRow").length;
  var empty=this.element.find(".emptyRow").length;
  rowsToAdd=Math.max(rowsToAdd,empty>5?0:5-empty);

  //fill with empty lines
  for (var i = 0; i < rowsToAdd; i++) {
    var emptyRow = $.JST.createFromTemplate({}, "TASKEMPTYROW");
    if (!GanttMaster.permissions.canSeeDep)
      emptyRow.find(".requireCanSeeDep").hide();

    //click on empty row create a task and fill above
    emptyRow.click(function (ev) {
      //console.debug("emptyRow.click")
      var emptyRow = $(this);
      //add on the first empty row only
      if (!GanttMaster.permissions.canWrite || !GanttMaster.permissions.canAdd || emptyRow.prevAll(".emptyRow").length > 0)
        return;

      master.beginTransaction();
      var lastTask;
      var start = new Date().getTime();
      var end = new Date().getTime();
      var level = 0;
      if (master.tasks[0]) {
        start = master.tasks[0].start;
        end = master.tasks[0].end;
        level = master.tasks[0].level + 1;
      }

      //fill all empty previouses
      var cnt=0;
      emptyRow.prevAll(".emptyRow").addBack().each(function () {
        cnt++;
        var ch = factory.build("tmp_fk" + new Date().getTime()+"_"+cnt, "", "", level, start, end, 1, null, master.defaultTaskColor);
        var task = master.addTask(ch);
        lastTask = ch;
      });
      master.endTransaction();
      if (lastTask.rowElement) {
        //lastTask.rowElement.click();  removed R&S 22/03/2016 il click è bindato comunque
        lastTask.rowElement.find("[name=name]").focus();//focus to "name" input
      }
    });
    this.element.append(emptyRow);
  }
};


GridEditor.prototype.addTask = function (task, row, hideIfParentCollapsed) {
  //console.debug("GridEditor.addTask",task,row);
  //var prof = new Profiler("editorAddTaskHtml");

  //remove extisting row
  this.element.find('[taskId="' + task.id + "\"]").remove();

  var taskRow = $.JST.createFromTemplate(task, "TASKROW");

  if (!GanttMaster.permissions.canSeeDep)
    taskRow.find(".requireCanSeeDep").hide();

  //save row element on task
  task.rowElement = taskRow;

  this.bindRowEvents(task, taskRow);

  if (typeof(row) != "number") {
    var emptyRow = this.element.find(".emptyRow:first"); //tries to fill an empty row
    if (emptyRow.length > 0)
      emptyRow.replaceWith(taskRow);
    else
      this.element.append(taskRow);
  } else {
    var tr = this.element.find("tr.taskEditRow").eq(row);
    if (tr.length > 0) {
      tr.before(taskRow);
    } else {
      this.element.append(taskRow);
    }

  }

  //[expand]
  if (hideIfParentCollapsed) {
    if (task.collapsed) taskRow.addClass('collapsed');
    var collapsedDescendant = this.master.getCollapsedDescendant();
    if (collapsedDescendant.indexOf(task) >= 0) taskRow.hide();
  }

  return taskRow;
};

GridEditor.prototype.refreshExpandStatus = function (task) {
  //console.debug("refreshExpandStatus",task);
  if (!task) return;
  if (task.isParent()) {
    task.rowElement.addClass("isParent");
  } else {
    task.rowElement.removeClass("isParent");
  }

  var par = task.getParent();
  if (par && !par.rowElement.is("isParent")) {
    par.rowElement.addClass("isParent");
  }

};

GridEditor.prototype.refreshTaskRow = function (task) {
  //console.debug("refreshTaskRow")
  //var profiler = new Profiler("editorRefreshTaskRow");

  var canWrite= GanttMaster.permissions.canWrite && task.canWrite;

  var row = task.rowElement;

  row.find(".taskRowIndex").html(task.getRow() + 1);
  row.find(".indentCell").css("padding-left", task.level * 10 + 18);
  row.find("[name=name]").val(task.name).prop("readonly",!canWrite);
  row.find("[name=code]").val(task.code).prop("readonly",!canWrite);
  row.find("[status]").attr("status", task.status);

  row.find("[name=duration]").val(task.duration).prop("readonly",!canWrite);
  row.find("[name=progress]").val(task.progress).prop("readonly",!canWrite || task.progressByWorklog==true);
  row.find("[name=startIsMilestone]").prop("checked", task.startIsMilestone).prop("disabled",!canWrite);
  row.find("[name=start]").val(new Date(task.start).format()).updateOldValue().prop("readonly",!canWrite); // called on dates only because for other field is called on focus event
  row.find("[name=endIsMilestone]").prop("checked", task.endIsMilestone).prop("disabled",!canWrite);
  row.find("[name=end]").val(new Date(task.end).format()).updateOldValue().prop("readonly",!canWrite);
  row.find("[name=depends]").val(task.depends).prop("readonly",!canWrite || !GanttMaster.permissions.canSeeDep);

  if (canWrite && !row.data('inputEventsBound')) {
    this.bindRowInputEvents(task, row);
  } else if (!canWrite && row.data('inputEventsBound')) {
    this.unbindRowInputEvents(row);
  }

  //manage collapsed
  if (task.collapsed)
    row.addClass("collapsed");
  else
    row.removeClass("collapsed");


  //Enhancing the function to perform own operations
  this.master.element.trigger('gantt.task.afterupdate.event', task);
  //profiler.stop();
};

GridEditor.prototype.redraw = function () {
  //console.debug("GridEditor.prototype.redraw")
  //var prof = new Profiler("ganttGridEditorRedraw");
  for (var i = 0; i < this.master.tasks.length; i++) {
    this.refreshTaskRow(this.master.tasks[i]);
  }
  // check if new empty rows are needed
  if (this.master.fillWithEmptyLines)
    this.fillEmptyLines();

  //prof.stop()

};

GridEditor.prototype.reset = function () {
  this.element.find("[taskid]").remove();
};


GridEditor.prototype.bindRowEvents = function (task, taskRow) {
  var self = this;
  //console.debug("bindRowEvents",this,this.master,GanttMaster.permissions.canWrite, task.canWrite);

  //bind row selection
  taskRow.click(function (event) {
    var row = $(this);
    //console.debug("taskRow.click",row.attr("taskid"),event.target)
    //var isSel = row.hasClass("rowSelected");
    row.closest("table").find(".rowSelected").removeClass("rowSelected");
    row.addClass("rowSelected");

    //set current task
    self.master.currentTask = self.master.getTask(row.attr("taskId"));

    //move highlighter
    self.master.gantt.synchHighlight();

    //if offscreen scroll to element
    var top = row.position().top;
    if (top > self.element.parent().height()) {
      row.offsetParent().scrollTop(top - self.element.parent().height() + 100);
    } else if (top <= 40) {
      row.offsetParent().scrollTop(row.offsetParent().scrollTop() - 40 + top);
    }
  });


  if (GanttMaster.permissions.canWrite && task.canWrite) {
    self.bindRowInputEvents(task, taskRow);
  } else { //cannot write: disable input
    taskRow.find("input").prop("readonly", true);
    taskRow.find("input:checkbox,select").prop("disabled", true);
  }

  if (!GanttMaster.permissions.canSeeDep)
    taskRow.find("[name=depends]").attr("readonly", true);

  self.bindRowExpandEvents(task, taskRow);
};


GridEditor.prototype.bindRowExpandEvents = function (task, taskRow) {
  var self = this;
  //expand collapse
  taskRow.find(".exp-controller").click(function () {
    var el = $(this);
    var taskId = el.closest("[taskid]").attr("taskid");
    var task = self.master.getTask(taskId);
    if (task.collapsed) {
      self.master.expand(task,false);
    } else {
      self.master.collapse(task,false);
    }
  });
};

GridEditor.prototype.unbindRowInputEvents = function (taskRow) {
  
  taskRow.find(".date").each(function () {
    
    var el = $(this);

    if (el.datepicker) { el.datepicker("destroy"); }

    el.off('focus');
    el.off('blur');
  });

  taskRow.find(":checkbox").off('click');
  taskRow.find("input:text:not(.date)").off('focus').off('blur').off('keyup');
  taskRow.find("input").off('keydown').off('focus');
  taskRow.find(".taskStatus").off('click');

  taskRow.data('inputEventsBound', false);
};

GridEditor.prototype.bindRowInputEvents = function (task, taskRow) {
  var self = this;

  //bind dateField on dates
  taskRow.find(".date").each(function () {
    var el = $(this);

    el.datepicker({
      onSelect: function (d) {
        $(this).blur();
      }
    });

    el.focus(function (e) {
      $(this).addClass("editing");
    }).blur(function (date) {
      var inp = $(this);
      if (inp.isValueChanged()) {
        if (!Date.isValid(inp.val())) {
          showErrorMsg(GanttMaster.messages.INVALID_DATE_FORMAT);
          inp.val(inp.getOldValue());

        } else {
          var row = inp.closest("tr");
          var taskId = row.attr("taskId");
          var task = self.master.getTask(taskId);

          var leavingField = inp.prop("name");
          var dates = resynchDates(self.master.schedulingDirection, inp, row.find("[name=start]"), row.find("[name=startIsMilestone]"), row.find("[name=duration]"), row.find("[name=end]"), row.find("[name=endIsMilestone]"));
          //console.debug("resynchDates",new Date(dates.start), new Date(dates.end),dates.duration)
          //update task from editor
          self.master.beginTransaction();
          self.master.changeTaskDates(task, dates.start, dates.end, true);
          self.master.endTransaction();
          inp.updateOldValue(); //in order to avoid multiple call if nothing changed
        }
      }
      $(this).removeClass("editing");
    });
  });


  //milestones checkbox
  taskRow.find(":checkbox").click(function () {
    var el = $(this);
    var row = el.closest("tr");
    var taskId = row.attr("taskId");

    var task = self.master.getTask(taskId);

    //update task from editor
    var field = el.prop("name");

    if (field == "startIsMilestone" || field == "endIsMilestone") {
      self.master.beginTransaction();
      //milestones
      task[field] = el.prop("checked");
      resynchDates(self.master.schedulingDirection, el, row.find("[name=start]"), row.find("[name=startIsMilestone]"), row.find("[name=duration]"), row.find("[name=end]"), row.find("[name=endIsMilestone]"));
      self.master.endTransaction();
    }

  });


  var updateFunction = function (event) {
    var el = $(this);
    var row = el.closest("tr");
    var taskId = row.attr("taskId");
    var task = self.master.getTask(taskId);
    //update task from editor
    var field = el.prop("name");
    //console.debug("blur",field)

    var par;

    if (el.isValueChanged()) {
      self.master.beginTransaction();

      if (field == "depends") {

        var oldDeps = task.depends;
        task.depends = el.val();

        // update links
        var linkOK = self.master.updateLinks(task);
        if (linkOK) {

          if (self.master.useStatus) {
            //synchronize status from superiors states
            var sups = task.getSuperiors();

            /*
            for (var i = 0; i < sups.length; i++) {
              if (!sups[i].from.synchronizeStatus())
                break;
            }
            */

            var oneFailed=false;
            var oneUndefined=false;
            var oneActive=false;
            var oneSuspended=false;
            for (var i = 0; i < sups.length; i++) {
              oneFailed=oneFailed|| sups[i].from.status=="STATUS_FAILED";
              oneUndefined=oneUndefined|| sups[i].from.status=="STATUS_UNDEFINED";
              oneActive=oneActive|| sups[i].from.status=="STATUS_ACTIVE";
              oneSuspended=oneSuspended|| sups[i].from.status=="STATUS_SUSPENDED";
            }

            if (oneFailed){
              task.changeStatus("STATUS_FAILED");
            } else if (oneUndefined){
              task.changeStatus("STATUS_UNDEFINED");
            } else if (oneActive){
              task.changeStatus("STATUS_SUSPENDED");
            } else  if (oneSuspended){
              task.changeStatus("STATUS_SUSPENDED");
            } else {
              task.changeStatus("STATUS_ACTIVE");
            }

          }

          self.master.changeTaskDeps(task); //dates recomputation from dependencies
        } else {
          task.depends = oldDeps;
        }

      } else if (field == "duration") {
        var dates = resynchDates(self.master.schedulingDirection, el, row.find("[name=start]"), row.find("[name=startIsMilestone]"), row.find("[name=duration]"), row.find("[name=end]"), row.find("[name=endIsMilestone]"));
        self.master.changeTaskDates(task, dates.start, dates.end, true);
      } else if (field == "name" && el.val() == "") { // remove unfilled task
        par = task.getParent();
        task.deleteTask();
        self.fillEmptyLines();

        if (par) self.refreshExpandStatus(par);
        self.master.gantt.synchHighlight();


      } else if (field == "progress" ) {
        task[field]=parseFloat(el.val())||0;
        el.val(task[field]);

      } else {
        task[field] = el.val();
      }
      self.master.endTransaction();

    } else if (field == "name" && el.val() == "") { // remove unfilled task even if not changed
      if (task.getRow()!=0) {
        par = task.getParent();
        task.deleteTask();
        self.fillEmptyLines();
        if (par) self.refreshExpandStatus(par);
        self.master.gantt.synchHighlight();
      } else {
        el.oneTime(1,"foc",function(){$(this).focus();}); //
        event.preventDefault();
        //return false;
      }

    }
  };

  //binding on blur for task update (date exluded as click on calendar blur and then focus, so will always return false, its called refreshing the task row)
  taskRow.find("input:text:not(.date)").focus(function () {
    $(this).addClass("editing");
    $(this).updateOldValue();
  }).blur(function (event) {
    $(this).removeClass("editing");
    updateFunction.call(this, event);
  }).keyup(function (event) {
    var othis = this;
    if (event.keyCode === 13) {
      updateFunction.call(othis, event);
      $(othis).updateOldValue();
      $(othis).removeClass("editing");
    } else {
      $(this).addClass("editing");
    }
  });

  //cursor key movement
  taskRow.find("input").keydown(function (event) {
    var theCell = $(this);
    var theTd = theCell.parent();
    var theRow = theTd.parent();
    var col = theTd.prevAll("td").length;

    var ret = true;
    if (!event.ctrlKey) {
      var td, inp;

      switch (event.keyCode) {

        case 37: //left arrow
          if (!theCell.is(":text") || (!this.selectionEnd || this.selectionEnd == 0))
            theTd.prev().find("input").focus();
          break;
        case 39: //right arrow
          if (!theCell.is(":text") || (!this.selectionEnd || this.selectionEnd == this.value.length))
            theTd.next().find("input").focus();
          break;

        case 38: //up arrow
          //var prevRow = theRow.prev();
          var prevRow = theRow.prevAll(":visible:first");
          td = prevRow.find("td").eq(col);
          inp = td.find("input");

          if (inp.length > 0)
            inp.focus();
          break;
        case 40: //down arrow
          //var nextRow = theRow.next();
          var nextRow = theRow.nextAll(":visible:first");
          td = nextRow.find("td").eq(col);
          inp = td.find("input");
          if (inp.length > 0)
            inp.focus();
          else
            nextRow.click(); //create a new row
          break;
        case 36: //home
          break;
        case 35: //end
          break;

        case 9: //tab
        case 13: //enter
          break;
      }
    }
    return ret;

  }).focus(function () {
    $(this).closest("tr").click();
  });


  //change status
  taskRow.find(".taskStatus").click(function () {
    var el = $(this);
    var tr = el.closest("[taskid]");
    var taskId = tr.attr("taskid");
    var task = self.master.getTask(taskId);

    var changer = $.JST.createFromTemplate({}, "CHANGE_STATUS");
    changer.find("[status=" + task.status + "]").addClass("selected");
    changer.find(".taskStatus").click(function (e) {
      e.stopPropagation();
      var newStatus = $(this).attr("status");
      changer.remove();
      self.master.beginTransaction();
      task.changeStatus(newStatus);
      self.master.endTransaction();
      el.attr("status", task.status);
    });
    el.oneTime(5000, "hideChanger", function () {
      changer.remove();
    });
    el.after(changer);
  });

  taskRow.data('inputEventsBound', true);

};
