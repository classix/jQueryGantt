module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
      // lints all .js files in the scripts folder
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
        ]
      },
      concat: {
        js: {
            options: {
                separator: '\n\n;\n\n',
            },
            src: ['ganttUtilities.js', 
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
            src: ['platform.css', 'ganttPrint.css', 'gantt.css', 'libs/jquery/dateField/jquery.dateField.css'],
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
      cssmin: {
        target: {
          files: [{
            expand: true,
            cwd: 'dist',
            src: ['*.css', '!*.min.css'],
            dest: 'dist',
            ext: '.min.css'
          }]
        }
      }
    });
  
    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
  
    // Default task(s).
    grunt.registerTask('default', ['jshint', 'clean:build', 'concat:js', 'concat:css', 'uglify', 'cssmin']);
  
  };