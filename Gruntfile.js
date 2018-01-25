'use strict';

var Compiler  = require('./grunt/compiler');
var Appender  = require('./grunt/appender');

module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
      // lints all .js files in the scripts folder
      customTemplates: {
        build: {
            cwd: 'templates',
            src: '*.html',
            dest: 'dist/templates.js',
            options: {
                htmlmin: {
                    collapseWhitespace: true,
                    removeComments: true
                }
            }
        }
      },
      jshint: {
        all: {
            options: {
                '-W069':true, //disable dot notation warning as it gets deprecated anyway (see: http://jshint.com/docs/options/#sub)
                '-W083':true // functions within loops may lead to misunderstood semantic. 
            },
            expand: true,
            src: ['ganttUtilities.js', 'ganttTask.js', 'ganttDrawerSVG.js', 'ganttGridEditor.js', 'ganttMaster.js']
        }
      },
      clean: {
        build: [
            'dist'
        ],
        after: ['dist/*.css', '!dist/JQueryGantt.css', 'dist/*.css.map','dist/templates.js']
      },
      concat: {
        js: {
            options: {
                separator: '\n\n;\n\n',
            },
            src: ['dist/templates.js', 
                'libs/jquery-3.3.1.min.js',
                'libs/jquery-ui.min.js',
                'ganttUtilities.js', 
                'ganttTask.js', 
                'ganttDrawerSVG.js', 
                'ganttGridEditor.js', 
                'ganttMaster.js', 
                'libs/jquery/jquery.livequery.1.1.1.min.js',
                'libs/jquery/jquery.timers.js',
                'libs/utilities.js',
                'libs/forms.js',
                'libs/date.js',
                'libs/dialogs.js',
                'libs/layout.js',
                'libs/i18nJs.js',
                'libs/jquery/dateField/jquery.dateField.js',
                'libs/jquery/JST/jquery.JST.js',
                'libs/jquery/svg/jquery.svg.min.js',
                'libs/jquery/svg/jquery.svgdom.1.8.js'],
            dest: 'dist/JQueryGantt.js'
        },
        css: {
            options: {
                separator: '\n\n',
            },
            src: ['dist/*.css', 'libs/jquery/dateField/jquery.dateField.css'],
            dest: 'dist/JQueryGantt.css'
        }
      },
      uglify: {
        options: {
          banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
        },
        build: {
          src: 'dist/JQueryGantt.js',
          dest: 'dist/JQueryGantt.min.js'
        }
      },
      sass: {
        options: {
            sourceMap: true,
            outputStyle: 'compressed' //comment out for code coverage tests/debugging
        },
        build: {
            files: [{
                expand: true,
                cwd: '',
                src: ['*.scss'],
                dest: 'dist',
                ext: '.css'
            }]
        }
      },
      copy: {
        build: {
          files:[
                    {expand: true, cwd: 'res/', src: '**', dest: 'dist/res/'}, 
                    {expand: true, cwd: '', src: 'gantt.html', dest: 'dist/'},
                    {expand: true, cwd: 'libs/jquery/dateField/img/', src: '*', dest: 'dist/img/'}
                ]
        },
        deploy: {
          files: [{
              expand: true, 
              cwd: 'dist/',
              src: '**/*',
              dest: 'Y:/classix/Main/WebWidgets/standalone/gantt'  
          }]
        }
    },
    });
  
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-sass');
    grunt.loadNpmTasks('grunt-contrib-htmlmin');
    

    var bootstrapper = function(module, script, options) {
        return "var morphItGrantt = { templates: {" + script.substring(0, script.length - 1) +"\n}};\n";
    };
    
    var customTemplatesTask = function() {
        var options = this.options({
          angular:    'angular',
          bootstrap:  bootstrapper,
          concat:     null,
          htmlmin:    {},
          module:     this.target,
          prefix:     '',
          source:     function(source) { return source; },
          standalone: false,
          url:        function(path) { return path; },
          usemin:     null,
          append:     false,
          quotes:     'double',
          merge:      true
        });
    
        grunt.verbose.writeflags(options, 'Options');
    
        this.files.forEach(function(file) {
          if (!file.src.length) {
            grunt.log.warn('No templates found');
          }
    
          var expanded = file.orig.expand;
          var cwd = file.orig.expand ? file.orig.cwd : file.cwd;
    
          var compiler  = new Compiler(grunt, options, cwd, expanded);
          var appender  = new Appender(grunt);
          var modules   = compiler.modules(file.src);
          var compiled  = [];
    
          for (var module in modules) {
            if (options.merge) {
              compiled.push(compiler.compile(module, modules[module]));
            } else {
              //Compiling each file to the same module
              for (var j = 0; j < file.src.length; j++) {
                compiled.push(compiler.compile(module, [file.src[j]]));
              }
            }
          }
    
          if (options.append){
            fs.appendFileSync(file.dest, compiled.join('\n'));
            grunt.log.writeln('File ' + file.dest.cyan + ' updated.');
          }
          else{
            if (options.merge) {
              grunt.file.write(file.dest, compiled.join('\n'));
              grunt.log.writeln('File ' + file.dest.cyan + ' created.');
            } else {
              //Writing compiled file to the same relative location as source, without merging them together 
              for (var i = 0; i < compiled.length; i++) {
                var dest = file.dest + file.src[i];
                //Change extension to js from html/htm
                dest = dest.replace(/(html|htm)$/i, "js");
                grunt.file.write(dest, compiled[i]);
                grunt.log.writeln('File ' + dest.cyan + ' created.');
              }
            }
          }
    
    
          if (options.usemin) {
            if (appender.save('generated', appender.concatUseminFiles(options.usemin, file))) {
              grunt.log.writeln('Added ' + file.dest.cyan + ' to ' + ('<!-- build:js ' + options.usemin + ' -->').yellow);
            }
          }
    
          if (options.concat) {
            if (appender.save(options.concat, appender.concatFiles(options.concat, file))) {
              grunt.log.writeln('Added ' + file.dest.cyan + ' to ' + ('concat:' + options.concat).yellow);
            }
          }
        });
    };
    
    grunt.registerMultiTask('customTemplates', '', customTemplatesTask);

    // Default task(s).
    grunt.registerTask('default', ['clean:build', 'customTemplates:build', 'jshint', 'concat:js', 'sass', 'concat:css', 'clean:after', 'uglify', 'copy:build']);
  
  };