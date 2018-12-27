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

/**
 * A method to instantiate valid task models from
 * raw data.
 */
function TaskFactory(master) {

  /**
   * Build a new Task
   */
  this.build = function (id, name, code, level, start, end, duration, collapsed, color) {

    var newStart, newEnd; 
    switch (master.schedulingDirection) {
      case GanttConstants.SCHEDULE_DIR.FORWARD: { 
        newStart = computeStart(start, false);
        newEnd = computeEndByDuration(newStart, duration);
        break;
      }
      case GanttConstants.SCHEDULE_DIR.BACKWARD: {
        newEnd = computeEnd(end, true);
        newStart = computeStartByDuration(newEnd, duration);
        break;
      }
      case GanttConstants.SCHEDULE_DIR.NO_SCHEDULING: {
        newStart = (new Date(start)).setHours(0,0,0,0);
        newEnd = (new Date(end)).setHours(23,59,59,999);
        break;
      }
    }

    return new Task(id, name, code, level, newStart, newEnd, duration, collapsed, color);
  };

}

function Task(id, name, code, level, start, end, duration, collapsed, color) {
  this.id = id;
  this.name = name;
  this.progress = 0;
  this.progressByWorklog = false;
  this.relevance = 0;
  this.type = "";
  this.typeId = "";
  this.description = "";
  this.code = code;
  this.level = level;
  this.status = "STATUS_UNDEFINED";
  this.depends = "";
  this.canWrite = true; // by default all tasks are writeable
  this.color = color;

  this.start = start;
  this.duration = duration;
  this.end = end;

  this.startIsMilestone = false;
  this.endIsMilestone = false;

  this.collapsed = collapsed;

  this.assigs = [];
}

Task.prototype.clone = function () {
  var ret = {};
  for (var key in this) {
    if (typeof(this[key]) != "function") {
      ret[key] = this[key];
    }
  }
  return ret;
};

//<%---------- SET PERIOD ---------------------- --%>
Task.prototype.setPeriod = function (start, end, force, ignoreMilestones, isGroup) {

  //console.debug("setPeriod ",this.code,this.name,new Date(start), new Date(end));
  //var profilerSetPer = new Profiler("gt_setPeriodJS");

  var backward = this.master.schedulingDirection === GanttConstants.SCHEDULE_DIR.BACKWARD;

  if (start instanceof Date) {
    start = start.getTime();
  }

  if (end instanceof Date) {
    end = end.getTime();
  }

  var originalPeriod = {
    start:    this.start,
    end:      this.end,
    duration: this.duration
  };

  //todo mossa qui R&S 30/3/2016 perchè altrimenti il calcolo della durata, che è stato modificato sommando giorni, sbaglia
  //compute legal start/end 
  start = computeStart(start, backward);
  end = computeEnd(end, backward);

  // groups can only be moved and cannot be resized on their own
  if (isGroup) {
    return this.moveTo(backward ? end : start, ignoreMilestones, true);
  }

  var newDuration = recomputeDuration(start, end);

  //if are equals do nothing and return true
  if (!force && start == originalPeriod.start && end == originalPeriod.end && newDuration == originalPeriod.duration) {
    //console.debug("Periods are identical!")
    return true;
  }

  if (newDuration == this.duration) { // is shift
    return this.moveTo(backward ? end : start, ignoreMilestones);
  }

  //console.debug("setStart",date,date instanceof Date);
  var wantedDateMillis = backward ? end : start;

  if (backward) {
    // cannot end before start
    if (end < start) {
      end = start;
    }
  } else {
    // cannot start after end
    if (start > end) {
      start = end;
    }
  }

  //set a legal start
  //start = computeStart(start); //todo R&S 30/3/2016 messo in vetta

  //if there are dependencies compute the start date and eventually moveTo
  var dateBySupInf = this[backward ? "computeEndByInferiors" : "computeStartBySuperiors"](backward ? end : start, backward);
  if (dateBySupInf != (backward ? end : start)) {
    return this.moveTo(dateBySupInf, false);
  }

  var somethingChanged = false;

  if (backward) {
    if (this.end != end || this.end != wantedDateMillis) {
      this.end = end;
      somethingChanged = true;
    }
  } else {
    if (this.start != start || this.start != wantedDateMillis) {
      this.start = start;
      somethingChanged = true;
    }
  }

  // set end/start
  var wantedDateMillis2 = backward ? start : end;

  //end = computeEnd(end);//todo R&S 30/3/2016 messo in vetta

  if (backward) {
    if (this.start != start || this.start != wantedDateMillis2) {
      this.start = start;
      somethingChanged = true;
    }
  } else {
    if (this.end != end || this.end != wantedDateMillis2) {
      this.end = end;
      somethingChanged = true;
    }
  }

  this.duration = recomputeDuration(this.start, this.end);

  //profilerSetPer.stop();

  //nothing changed exit
  if (!somethingChanged)
    return true;

  //cannot write exit
  if (!this.canWrite) {
    this.master.setErrorOnTransaction("\"" + this.name + "\"\n" + GanttMaster.messages.CANNOT_WRITE, this);
    return false;
  }

  var todoOk = true;

  //check global boundaries
  if (this.start < this.master.minEditableDate || this.end > this.master.maxEditableDate) {
    this.master.setErrorOnTransaction("\"" + this.name + "\"\n" +GanttMaster.messages.CHANGE_OUT_OF_SCOPE, this);
    todoOk = false;
  }

  //console.debug("set period: somethingChanged",this);
  if (todoOk && !updateTree(this)) {
    todoOk = false;
  }

  if (todoOk) {
    if (backward) {
      todoOk = this.propagateToSuperiors(start);
    } else {
      todoOk = this.propagateToInferiors(end);
    }
  }
  return todoOk;
};


//<%---------- MOVE TO ---------------------- --%>
Task.prototype.moveTo = function (date, ignoreMilestones, groupMove) {
  //console.debug("moveTo ",this.code,this.name,new Date(start),this.duration,ignoreMilestones);
  //var profiler = new Profiler("gt_task_moveTo");

  var backward = this.master.schedulingDirection === GanttConstants.SCHEDULE_DIR.BACKWARD;

  if (date instanceof Date) {
    date = date.getTime();
  }

  var originalPeriod = {
    start: this.start,
    end:   this.end
  };

  var wantedDateMillis = date;

  //set a legal start/end
  date = backward ? computeEnd(date, backward) : computeStart(date, backward);

  //if start/end is milestone cannot be move
  if (!ignoreMilestones && this[backward ? "endIsMilestone" : "startIsMilestone"] && date != this[backward ? "end": "start"]) {
    //notify error
    this.master.setErrorOnTransaction("\"" + this.name + "\"\n" +GanttMaster.messages[backward ? "END_IS_MILESTONE" : "START_IS_MILESTONE"], this);
    return false;
  } 

  //if depends, start/end is set to max end + lag of superior
  var dateBySupInf = this[backward? "computeEndByInferiors" : "computeStartBySuperiors"](date, backward);


  //todo if there are dependencies the new start,end must be contained into parent dates
  /*var parent=this.getParent();
  if (start!=startBySuperiors){
    var proposedEnd = computeEndByDuration(startBySuperiors, this.duration);
    // if outside parent's scoce error
    if (parent && (startBySuperiors<parent.start || proposedEnd>parent.end)) {
      this.master.setErrorOnTransaction("\"" + this.name + "\"\n" +GanttMaster.messages["CANNOT_MOVE_TASK"], this);
      return false;
    } else {
      start = startBySuperiors;
    }
  }*/

  var start = backward ? computeStartByDuration(dateBySupInf, this.duration) : dateBySupInf;
  var end = backward ? dateBySupInf : computeEndByDuration(dateBySupInf, this.duration);

  if (this[backward ? "end" : "start"] != dateBySupInf || this[backward ? "end" : "start"] != wantedDateMillis) {
    /*//in case of end is milestone it never changes, but recompute duration
    if (!ignoreMilestones && this.endIsMilestone) {
      end = this.end;
      this.duration = recomputeDuration(start, end);
    }*/
    //in case of end is milestone it never changes!
    if (!ignoreMilestones && this[backward ? "startIsMilestone" : "endIsMilestone"] && (backward ? (start!=this.start) : (end!=this.end))) {
      this.master.setErrorOnTransaction("\"" + this.name + "\"\n" +GanttMaster.messages[backward ? "START_IS_MILESTONE" : "END_IS_MILESTONE"], this);
      return false;
    }
    this.start = start;
    this.end = end;
    //profiler.stop();

    //check global boundaries
    if (this.start < this.master.minEditableDate || this.end > this.master.maxEditableDate) {
      this.master.setErrorOnTransaction("\"" + this.name + "\"\n" +GanttMaster.messages.CHANGE_OUT_OF_SCOPE, this);
      return false;
    }

    

    //loops children to shift them in case of manual shift of a group by the user
    if (groupMove) {
      var panDeltaInWD = new Date(originalPeriod[backward ? "end" : "start"]).distanceInWorkingDays(new Date(this[backward ? "end" : "start"]));
      var children = this.getChildren();
      for (var i = 0; i < children.length; i++) {
        ch = children[i];
        var chDate = new Date(ch[backward? "end" :"start"]).incrementDateByWorkingDays(panDeltaInWD);
        if (!ch.moveTo(chDate, false)) {
          return false;
        }
      }
    }

  }

  //console.debug("set period: somethingChanged",this);
  if (!updateTree(this)) {
    return false;
  }

  if (backward) {
    return this.propagateToSuperiors(start);
  } else {
    return this.propagateToInferiors(end);
  }
};


//<%---------- PROPAGATE TO INFERIORS ---------------------- --%>
Task.prototype.propagateToInferiors = function (end) {
  //and now propagate to inferiors
  var todoOk = true;
  var infs = this.getInferiors();
  if (infs && infs.length > 0) {
    for (var i = 0; i < infs.length; i++) {
      var link = infs[i];
      if (!link.to.canWrite) {
        this.master.setErrorOnTransaction(GanttMaster.messages.CANNOT_WRITE + "\n\"" + link.to.name + "\"", link.to);
        break;
      }
      todoOk = link.to.moveTo(end, false); //this is not the right date but moveTo checks start
      if (!todoOk)
        break;
    }
  }
  return todoOk;
};

//<%---------- PROPAGATE TO SUPERIORS ---------------------- --%>
Task.prototype.propagateToSuperiors = function (start) {
  //and now propagate to inferiors
  var todoOk = true;
  var sups = this.getSuperiors();
  if (sups && sups.length > 0) {
    for (var i = 0; i < sups.length; i++) {
      var link = sups[i];
      if (!link.from.canWrite) {
        this.master.setErrorOnTransaction(GanttMaster.messages.CANNOT_WRITE + "\n\"" + link.from.name + "\"", link.from);
        break;
      }
      todoOk = link.from.moveTo(start, false); //this is not the right date but moveTo checks start
      if (!todoOk)
        break;
    }
  }
  return todoOk;
};


//<%---------- COMPUTE START BY SUPERIORS ---------------------- --%>
Task.prototype.computeStartBySuperiors = function (proposedStart, backward) {
  //if depends -> start is set to max end + lag of superior
  var supEnd=proposedStart;
  var sups = this.getSuperiors();
  if (sups && sups.length > 0) {
    supEnd=0;
    for (var i = 0; i < sups.length; i++) {
      var link = sups[i];
      supEnd = Math.max(supEnd, incrementDateByWorkingDays(link.from.end, link.lag + 1));
    }
  }
  return computeStart(supEnd, backward);
};

Task.prototype.computeEndByInferiors = function(proposedEnd, backward) {
  //if depends -> end is set to min start + lag of inferior
  var infStart = proposedEnd;
  var infs = this.getInferiors();
  if (infs && infs.length > 0) {
    for (var i = 0; i < infs.length; i++) {
      var link = infs[i];
      if (i === 0) {
        infStart = decrementDateByWorkingDays(link.to.start, link.lag + 1);
      } else {
        infStart = Math.min(infStart, decrementDateByWorkingDays(link.to.start, link.lag + 1));
      }
    }
  }
  return computeEnd(infStart, backward);
};


function updateTree(task) {
  //console.debug("updateTree ",task.code,task.name);
  var error;

  //try to enlarge parent
  var p = task.getParent();

  //no parent:exit
  if (!p)
    return true;

  var children = p.getChildren();
  var bs = Infinity;
  var be = 0;
  for (var i = 0; i < children.length; i++) {
    var ch = children[i];
    be = Math.max(be, ch.end);
    bs = Math.min(bs, ch.start);
  }

  //propagate updates if needed
  if (bs != p.start || be != p.end) {

    //can write?
    if (!p.canWrite) {
      task.master.setErrorOnTransaction(GanttMaster.messages.CANNOT_WRITE + "\n" + p.name, task);
      return false;
    }

    return p.setPeriod(bs, be);
  }

  return true;
}


//<%---------- CHANGE STATUS ---------------------- --%>
Task.prototype.changeStatus = function (newStatus,forceStatusCheck) {
  //console.debug("changeStatus: "+this.name+" from "+this.status+" -> "+newStatus);

  var cone = this.getDescendant();

  function propagateStatus(task, newStatus, manuallyChanged, propagateFromParent, propagateFromChildren) {
    //console.debug("propagateStatus",task.name, task.status,newStatus, manuallyChanged, propagateFromParent, propagateFromChildren);
    var oldStatus = task.status;

    //no changes exit
    if (newStatus == oldStatus && !forceStatusCheck) {
      return true;
    }

    var todoOk = true;
    task.status = newStatus;

    var sups, par;

    //xxxx -> STATUS_DONE            may activate dependent tasks, both suspended and undefined. Will set to done all children.
    //STATUS_FAILED -> STATUS_DONE   do nothing if not forced by hand
    if (newStatus == "STATUS_DONE") {

      if ((manuallyChanged || oldStatus != "STATUS_FAILED")) { //cannot set failed task as closed for cascade - only if changed manually

        //can be closed only if superiors are already done
        sups = task.getSuperiors();
        for (var i = 0; i < sups.length; i++) {
          if (sups[i].from.status != "STATUS_DONE" && cone.indexOf(sups[i].from)<0) { // è un errore se un predecessore è non chiuso ed è fuori dal cono
            if (manuallyChanged || propagateFromParent)  //genere un errore bloccante se è cambiato a mano o se il cambiamento arriva dal parent ed ho una dipendenza fuori dal cono (altrimenti avrei un attivo figlio di un chiuso
              task.master.setErrorOnTransaction(GanttMaster.messages.GANTT_ERROR_DEPENDS_ON_OPEN_TASK + "\n\"" + sups[i].from.name + "\" -> \"" + task.name + "\"");
            todoOk = false;
            break;
          }
        }

        if (todoOk) {
          // set progress to 100% if needed by settings
          if (task.master.set100OnClose && !task.progressByWorklog ){
            task.progress=100;
          }

          //set children as done
          propagateStatusToChildren(task,newStatus,false);

          //set inferiors as active
          propagateStatusToInferiors(task.getInferiors(), "STATUS_ACTIVE");
        }
      } else { // una propagazione tenta di chiudere un task fallito
        todoOk = false;
      }


      //  STATUS_UNDEFINED -> STATUS_ACTIVE       all children become active, if they have no dependencies.
      //  STATUS_SUSPENDED -> STATUS_ACTIVE       sets to active all children and their descendants that have no inhibiting dependencies.
      //  STATUS_DONE -> STATUS_ACTIVE            all those that have dependencies must be set to suspended.
      //  STATUS_FAILED -> STATUS_ACTIVE          nothing happens: child statuses must be reset by hand.
    } else if (newStatus == "STATUS_ACTIVE") {

      if ((manuallyChanged || oldStatus != "STATUS_FAILED")) { //cannot set failed task as closed for cascade - only if changed manually

        //can be active only if superiors are already done, not only on this task, but also on ancestors superiors
        sups = task.getSuperiors();

        for (var j = 0; j < sups.length; j++) {
          if (sups[j].from.status != "STATUS_DONE") {
            if (manuallyChanged || propagateFromChildren)
              task.master.setErrorOnTransaction(GanttMaster.messages.GANTT_ERROR_DEPENDS_ON_OPEN_TASK + "\n\"" + sups[j].from.name + "\" -> \"" + task.name + "\"");
            todoOk = false;
            break;
          }
        }

        // check if parent is already active
        if (todoOk) {
          par = task.getParent();
          if (par && par.status != "STATUS_ACTIVE") {
            // todoOk = propagateStatus(par, "STATUS_ACTIVE", false, false, true); //todo abbiamo deciso di non far propagare lo status verso l'alto
            todoOk = false;
          }
        }


        if (todoOk) {
          if (oldStatus == "STATUS_UNDEFINED" || oldStatus == "STATUS_SUSPENDED") {
            //set children as active
            propagateStatusToChildren(task,newStatus,true);
          }

          //set inferiors as suspended
          propagateStatusToInferiors( task.getInferiors(), "STATUS_SUSPENDED");
        }
      } else {
        todoOk = false;
      }

      // xxxx -> STATUS_SUSPENDED       all active children and their active descendants become suspended. when not failed or forced
    } else if (newStatus == "STATUS_SUSPENDED" ) {
      if (manuallyChanged || oldStatus != "STATUS_FAILED") { //cannot set failed task as closed for cascade - only if changed manually

        //check if parent if not active
        par = task.getParent();
        if (par && (par.status != "STATUS_ACTIVE" && par.status != "STATUS_SUSPENDED")) {
          todoOk = false;
        }


        if (todoOk) {
          //set children as STATUS_SUSPENDED
          propagateStatusToChildren(task, newStatus, true);

          //set inferiors as STATUS_SUSPENDED
          propagateStatusToInferiors( task.getInferiors(), newStatus);
        }
      } else {
        todoOk = false;
      }

      // xxxx -> STATUS_FAILED children and dependent failed
      // xxxx -> STATUS_UNDEFINED  children and dependant become undefined.
    } else if (newStatus == "STATUS_FAILED" || newStatus == "STATUS_UNDEFINED") {

      //set children as failed or undefined
      propagateStatusToChildren(task,newStatus,false);

      //set inferiors as failed
      propagateStatusToInferiors( task.getInferiors(), newStatus);
    }
    if (!todoOk) {
      task.status = oldStatus;
      //console.debug("status rolled back: "+task.name + " to " + oldStatus);
    }

    return todoOk;
  }

  /**
   * A helper method to traverse an array of 'inferior' tasks
   * and signal a status change.
   */
  function propagateStatusToInferiors( infs, status) {
    for (var i = 0; i < infs.length; i++) {
      propagateStatus(infs[i].to, status, false, false, false);
    }
  }

  /**
   * A helper method to loop children and propagate new status
   */
  function propagateStatusToChildren(task, newStatus, skipClosedTasks) {
    var chds = task.getChildren();
    for (var i = 0; i < chds.length; i++)
      if (!(skipClosedTasks && chds[i].status == "STATUS_DONE") )
        propagateStatus(chds[i], newStatus, false, true, false);
  }


  var manuallyChanged=true;

  var oldStatus = this.status;
  //first call
  if (propagateStatus(this, newStatus, manuallyChanged, false, false)) {
    return true;
  } else {
    this.status = oldStatus;
    return false;
  }
};

Task.prototype.synchronizeStatus = function () {
  //console.debug("synchronizeStatus",this.name);
  var oldS = this.status;
  this.status = this.getParent()?this.getParent().status:"STATUS_UNDEFINED"; // di default si invalida lo stato mettendo quello del padre, in modo che inde/outd siano consistenti
  return this.changeStatus(oldS,true);
};

Task.prototype.isLocallyBlockedByDependencies = function () {
  if (!this.master.useStatus) return false;
  var sups = this.getSuperiors();
  var blocked = false;
  for (var i = 0; i < sups.length; i++) {
    if (sups[i].from.status != "STATUS_DONE") {
      blocked = true;
      break;
    }
  }
  return blocked;
};

//<%---------- TASK STRUCTURE ---------------------- --%>
Task.prototype.getRow = function () {
  ret = -1;
  if (this.master)
    ret = this.master.tasks.indexOf(this);
  return ret;
};


Task.prototype.getParents = function () {
  var ret;
  if (this.master) {
    var topLevel = this.level;
    var pos = this.getRow();
    ret = [];
    for (var i = pos; i >= 0; i--) {
      var par = this.master.tasks[i];
      if (topLevel > par.level) {
        topLevel = par.level;
        ret.push(par);
      }
    }
  }
  return ret;
};


Task.prototype.getParent = function () {
  var ret;
  if (this.master) {
    for (var i = this.getRow(); i >= 0; i--) {
      var par = this.master.tasks[i];
      if (this.level > par.level) {
        ret = par;
        break;
      }
    }
  }
  return ret;
};


Task.prototype.isParent = function () {
  var ret = false;
  if (this.master) {
    var pos = this.getRow();
    if (pos < this.master.tasks.length - 1)
      ret = this.master.tasks[pos + 1].level > this.level;
  }
  return ret;
};

Task.prototype.isCollapsed = function () {
  var parent = this.getParent();
  if (!parent) return this.collapsed;
  return this.collapsed || parent.isCollapsed();
};


Task.prototype.getChildren = function () {
  var ret = [];
  if (this.master) {
    var pos = this.getRow();
    for (var i = pos + 1; i < this.master.tasks.length; i++) {
      var ch = this.master.tasks[i];
      if (ch.level == this.level + 1)
        ret.push(ch);
      else if (ch.level <= this.level) // exit loop if parent or brother
        break;
    }
  }
  return ret;
};


Task.prototype.getDescendant = function () {
  var ret = [];
  if (this.master) {
    var pos = this.getRow();
    for (var i = pos + 1; i < this.master.tasks.length; i++) {
      var ch = this.master.tasks[i];
      if (ch.level > this.level)
        ret.push(ch);
      else
        break;
    }
  }
  return ret;
};


Task.prototype.getSuperiors = function () {
  var ret = [];
  var task = this;
  if (this.master) {
    ret = this.master.links.filter(function (link) {
      return link.to == task;
    });
  }
  return ret;
};

Task.prototype.getLinks = function (outgoing) {
  var self = this;
  return this.master.links.filter(function (link) {
    return link[outgoing ? 'from' : 'to'] === self;
  });
};

Task.prototype.getSuperiorTasks = function () {
  var ret = [];
  var sups = this.getSuperiors();
  for (var i = 0; i < sups.length; i++)
    ret.push(sups[i].from);
  return ret;
};


Task.prototype.getInferiors = function () {
  var ret = [];
  var task = this;
  if (this.master) {
    ret = this.master.links.filter(function (link) {
      return link.from == task;
    });
  }
  return ret;
};

Task.prototype.getInferiorTasks = function () {
  var ret = [];
  var infs = this.getInferiors();
  for (var i = 0; i < infs.length; i++)
    ret.push(infs[i].to);
  return ret;
};

Task.prototype.deleteTask = function () {
  //console.debug("deleteTask",this.name,this.master.deletedTaskIds)
  //if is the current one remove it
  if (this.master.currentTask && this.master.currentTask.id==this.id)
    delete this.master.currentTask;

  var oldParent = this.getParent();

  //delete both dom elements if exists
  if (this.rowElement)
    this.rowElement.remove();
  if (this.ganttElement)
    this.ganttElement.remove();

  //remove children
  var chd = this.getChildren();
  for (var i = 0; i < chd.length; i++) {
    //add removed child in list
    chd[i].deleteTask();
  }

  if (!this.isNew())
    this.master.deletedTaskIds.push(this.id);

  //remove from in-memory collection
  this.master.tasks.splice(this.getRow(), 1);

  //remove from links
  var task = this;
  this.master.links = this.master.links.filter(function (link) {
    return link.from != task && link.to != task;
  });

  var oldSiblings = oldParent.getChildren();
  if (oldSiblings.length) {
    updateTree(oldSiblings[0]);
  }
};


Task.prototype.isNew = function () {
  return (this.id + "").indexOf("tmp_") == 0;
};

Task.prototype.isDependent = function (t) {
  //console.debug("isDependent",this.name, t.name)
  var task = this;
  var dep = this.master.links.filter(function (link) {
    return link.from == task;
  });

  // is t a direct dependency?
  for (var i = 0; i < dep.length; i++) {
    if (dep[i].to == t)
      return true;
  }
  // is t an indirect dependency
  for (var j = 0; j < dep.length; j++) {
    if (dep[j].to.isDependent(t)) {
      return true;
    }
  }
  return false;
};

Task.prototype.setLatest = function (maxCost, maxEnd) {
  this.latestStart = maxCost - this.criticalCost;
  this.latestStartDate = (new Date(maxEnd)).decrementDateByWorkingDays(this.criticalCost - 1).getTime();
  this.latestFinish = this.latestStart + this.duration;
  this.latestFinishDate = (new Date(this.latestStartDate)).incrementDateByWorkingDays(this.duration - 1).getTime();
};


//<%------------------------------------------  INDENT/OUTDENT --------------------------------%>
Task.prototype.indent = function () {
  //console.debug("indent", this);
  //a row above must exist
  var row = this.getRow();

  //no row no party
  if (row <= 0)
    return false;

  var ret = false;
  var taskAbove = this.master.tasks[row - 1];
  var newLev = this.level + 1;
  if (newLev <= taskAbove.level + 1) {
    ret = true;

    //trick to get parents after indent
    this.level++;
    var createsNoLoops = this.master.updateLinks(this);
    if (!createsNoLoops) return;
    var futureParents = this.getParents();
    this.level--;

    var oldLevel = this.level;
    for (var i = row; i < this.master.tasks.length; i++) {
      var desc = this.master.tasks[i];
      if (desc.level > oldLevel || desc == this) {
        desc.level++;
        //remove links from this and descendant to my parents
        this.master.links = this.master.links.filter(function (link) {
          var linkToParent = false;
          if (link.to == desc)
            linkToParent = futureParents.indexOf(link.from) >= 0;
          else if (link.from == desc)
            linkToParent = futureParents.indexOf(link.to) >= 0;
          return !linkToParent;
        });
        //remove links from this and descendants to predecessors of parents in order to avoid loop
        var predecessorsOfFutureParents=[];
        for (var j=0;j<futureParents.length;j++)
          predecessorsOfFutureParents=predecessorsOfFutureParents.concat(futureParents[j].getSuperiorTasks());

        this.master.links = this.master.links.filter(function (link) {
          var linkToParent = false;
          if (link.from == desc)
            linkToParent = predecessorsOfFutureParents.indexOf(link.to) >= 0;
          return !linkToParent;
        });


      } else
        break;
    }

    var parent = this.getParent();
    // set start date to parent' start if no deps
    if (parent && !this.depends) {
      var new_end = computeEndByDuration(parent.start, this.duration);
      this.master.changeTaskDates(this, parent.start, new_end, false, this.isParent());
    }

    //recompute depends string
    this.master.updateDependsStrings();
    //change parent size 
    updateTree(this);
    if (this.master.useStatus) {
      //force status check starting from parent
      this.getParent().synchronizeStatus();
    }
  }
  return ret;
};


Task.prototype.outdent = function () {
  //console.debug("outdent", this);

  //a level must be >1 -> cannot escape from root
  if (this.level <= 1)
    return false;

  var ret = false;
  var oldLevel = this.level;
  var oldParent = this.getParent();

  ret = true;
  var row = this.getRow();
  for (var i = row; i < this.master.tasks.length; i++) {
    var desc = this.master.tasks[i];
    if (desc.level > oldLevel || desc == this) {
      desc.level--;
    } else
      break;
  }

  var task = this;
  var chds = this.getChildren();
  //remove links from me to my new children
  this.master.links = this.master.links.filter(function (link) {
    var linkExist = (link.to == task && chds.indexOf(link.from) >= 0 || link.from == task && chds.indexOf(link.to) >= 0);
    return !linkExist;
  });


  // change my size according to my children
  if (chds.length) {
    updateTree(chds[0]);
  }

  //recompute depends string
  this.master.updateDependsStrings();

  // change the size of my new parents
  updateTree(this);

  // change the size of my old parents
  var oldSiblings = oldParent.getChildren();
  if (oldSiblings.length) {
    updateTree(oldSiblings[0]);
  }

  if (this.master.useStatus) {
    //force status check
    this.synchronizeStatus();
  }
  
  return ret;
};


//<%------------------------------------------  MOVE UP / MOVE DOWN --------------------------------%>
Task.prototype.moveUp = function () {
  //console.debug("moveUp", this);
  var ret = false;

  //a row above must exist
  var row = this.getRow();

  //no row no party
  if (row <= 0)
    return false;

  //find new row
  var newRow;
  for (newRow = row - 1; newRow >= 0; newRow--) {
    if (this.master.tasks[newRow].level <= this.level)
      break;
  }

  //is a parent or a brother
  if (this.master.tasks[newRow].level == this.level) {
    ret = true;
    //compute descendant
    var descNumber = 0;
    for (var i = row + 1; i < this.master.tasks.length; i++) {
      var desc = this.master.tasks[i];
      if (desc.level > this.level) {
        descNumber++;
      } else {
        break;
      }
    }
    //move in memory
    var blockToMove = this.master.tasks.splice(row, descNumber + 1);
    var top = this.master.tasks.splice(0, newRow);
    this.master.tasks = [].concat(top, blockToMove, this.master.tasks);
    //move on dom
    var rows = this.master.editor.element.find("tr[taskid]");
    var domBlockToMove = rows.slice(row, row + descNumber + 1);
    rows.eq(newRow).before(domBlockToMove);

    //recompute depends string
    this.master.updateDependsStrings();
  } else {
    this.master.setErrorOnTransaction(GanttMaster.messages.TASK_MOVE_INCONSISTENT_LEVEL, this);
    ret = false;
  }
  return ret;
};


Task.prototype.moveDown = function () {
  //console.debug("moveDown", this);

  //a row below must exist, and cannot move root task
  var row = this.getRow();
  if (row >= this.master.tasks.length - 1 || row == 0)
    return false;

  var ret = false;

  //find nearest brother
  var newRow;
  for (newRow = row + 1; newRow < this.master.tasks.length; newRow++) {
    if (this.master.tasks[newRow].level <= this.level)
      break;
  }

  //is brother
  if (this.master.tasks[newRow] && this.master.tasks[newRow].level == this.level) {
    ret = true;
    //find last desc
    for (newRow = newRow + 1; newRow < this.master.tasks.length; newRow++) {
      if (this.master.tasks[newRow].level <= this.level)
        break;
    }

    //compute descendant
    var descNumber = 0;
    for (var i = row + 1; i < this.master.tasks.length; i++) {
      var desc = this.master.tasks[i];
      if (desc.level > this.level) {
        descNumber++;
      } else {
        break;
      }
    }

    //move in memory
    var blockToMove = this.master.tasks.splice(row, descNumber + 1);
    var top = this.master.tasks.splice(0, newRow - descNumber - 1);
    this.master.tasks = [].concat(top, blockToMove, this.master.tasks);


    //move on dom
    var rows = this.master.editor.element.find("tr[taskid]");
    var aft = rows.eq(newRow - 1);
    var domBlockToMove = rows.slice(row, row + descNumber + 1);
    aft.after(domBlockToMove);

    //recompute depends string
    this.master.updateDependsStrings();
  }

  return ret;
};


//<%------------------------------------------------------------------------  LINKS OBJECT ---------------------------------------------------------------%>
function Link(taskFrom, taskTo, lagInWorkingDays) {
  this.from = taskFrom;
  this.to = taskTo;
  this.lag = lagInWorkingDays;
}




