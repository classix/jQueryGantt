$.fn.loadTemplates = function() {
  $.JST.loadTemplates($(this));
  return this;
};

$.JST = {
  _templates: {},
  _decorators: {},

  loadTemplates: function() {

      for (var type in morphItGrantt.templates) {
        if (morphItGrantt.templates.hasOwnProperty(type)) {
            var templateBody = morphItGrantt.templates[type];

            if (!templateBody.match(/##\w+##/)) { // is Resig' style? e.g. (#=id#) or (# ...some javascript code 'obj' is the alias for the object #)
              var strFunc = "var p=[],print=function(){p.push.apply(p,arguments);};" +
                "with(obj){p.push('" +
                templateBody.replace(/[\r\t\n]/g, " ")
                            .replace(/'(?=[^#]*#\))/g, "\t")
                            .split("'").join("\\'")
                            .split("\t").join("'")
                            .replace(/\(#=(.+?)#\)/g, "',$1,'")
                            .split("(#").join("');")
                            .split("#)").join("p.push('") + "');}return p.join('');";
              try {
                $.JST._templates[type] = new Function("obj", strFunc);
              } catch (e) {
                console.error("JST error: "+type, e,strFunc);
              }
            } else { //plain template   e.g. ##id##
              try {
                $.JST._templates[type] = templateBody;
              } catch (e) {
                console.error("JST error: "+type, e,templateBody);
              }
            }
        }
      }
  },

  updateTexts: function (element) {
    var childrenToEdit = element.find('*[data-ml-text]');
    childrenToEdit.each(function () {
      var elem = $(this);
      if (!elem.attr('data-ml-text')) return true;
      var attrValue = eval(elem.attr('data-ml-text'));
      var attrs = elem.attr('data-ml-attribute').split(",");
      for (var i = 0; i < attrs.length; i++) {
        var attrName = attrs[i];
        if ($.trim(attrName.toLowerCase()) === "innerhtml") {
          elem.html(attrValue);
        } else {
          elem.attr(attrName, attrValue);
        }
      }
    });
  },

  createFromTemplate: function(jsonData, template, transformToPrintable) {
    var templates = $.JST._templates;

    var jsData= {};
    if (transformToPrintable){
      for (var prop in jsonData){
        var value = jsonData[prop];
        if (typeof(value) == "string")
          value = (value + "").replace(/\n/g, "<br>");
        jsData[prop]=value;
      }
    } else {
      jsData=jsonData;
    }

    function fillStripData(strip, data) {
      for (var prop in data) {
        var value = data[prop];

        strip = strip.replace(new RegExp("##" + prop + "##", "gi"), value);
      }
      // then clean the remaining ##xxx##
      strip = strip.replace(new RegExp("##\\w+##", "gi"), "");
      return strip;
    }

    var stripString = "";
    if (typeof(template) == "undefined") {
      showErrorMsg("Template is required");
      stripString = "<div>Template is required</div>";

    } else if (typeof(templates[template]) == "function") { // resig template
      try {
        stripString = templates[template](jsData);// create a jquery object in memory
      } catch (e) {
        console.error("JST error: "+template,e.message);
        stripString = "<div> ERROR: "+template+"<br>" + e.message + "</div>";
      }

    } else {
      stripString = templates[template]; // recover strip template
      if (!stripString || stripString.trim() == "") {
        console.error("No template found for type '" + template + "'");
        return $("<div>");

      } else {
        stripString = fillStripData(stripString, jsData); //replace placeholders with data
      }
    }

    var ret = $(stripString);// create a jquery object in memory
    ret.attr("__template", template); // set __template attribute

    //decorate the strip
    var dec = $.JST._decorators[template];
    if (typeof (dec) == "function")
      dec(ret, jsData);

    $.JST.updateTexts(ret);

    return ret;
  },


  existsTemplate: function(template) {
    return $.JST._templates[template];
  },

  //decorate function is like function(domElement,jsonData){...}
  loadDecorator:function(template, decorator) {
    $.JST._decorators[template] = decorator;
  },

  getDecorator:function(template) {
    return $.JST._decorators[template];
  },

  decorateTemplate:function(element) {
    var dec = $.JST._decorators[element.attr("__template")];
    if (typeof (dec) == "function")
      dec(editor);
  },

  // asynchronous
  ajaxLoadAsynchTemplates: function(templateUrl, callback) {

    $.get(templateUrl, function(data) {

      var div = $("<div>");
      div.html(data);

      $.JST.loadTemplates(div);

      if (typeof(callback == "function"))
        callback();
    },"html");
  },

  ajaxLoadTemplates: function(templateUrl) {
    $.ajax({
      async:false,
      url: templateUrl,
      dataType: "html",
      success: function(data) {
        var div = $("<div>");
        div.html(data);
        $.JST.loadTemplates(div);
      }
    });

  }


};
