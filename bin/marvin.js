var config = require('marvin-js').config;
var session = require('marvin-js').session;

(function checkConfiguration() {

  var MANDATORY_CONFIGURATION_FIELDS = ['browser', 'baseUrl', 'featuresDir', 'stepsDir'];

  function ConfigError(opt) {
    this.name = 'ConfigError';
    this.message = "'" + opt + "' missing from Marvin config.";
  }

  ConfigError.prototype = new Error();

  MANDATORY_CONFIGURATION_FIELDS.forEach(function(opt) {
    if (!config[opt]){
      throw new ConfigError(opt);
    }
  });

}());


var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');




var wrench = require('wrench');



var baseResultsDir = config.resultsDir || 'results';

(function prepareResultDirectory() {

  if (config.clean && fs.existsSync(baseResultsDir)) {
    wrench.rmdirSyncRecursive(baseResultsDir);
  }

  var now = new Date();
  session.launchDate = now.toUTCString().slice(5, -4).toLowerCase().replace(/[:\s]/g, "-");
  
  wrench.mkdirSyncRecursive(path.join(baseResultsDir, 'screenshots'));
  wrench.mkdirSyncRecursive(path.join(baseResultsDir, session.launchDate, 'screenshots'));

}());


var builder = require('../lib/reporter/builder');
var parser = require('../lib/utils/feature-parser');



var features = parser.parseFeatures(config.featuresDir, config.tags, config.language);
session.queues = createQueues(features, config.threads || 1);
var failed = false;

session.queues.forEach(function(queue, index) {
  var mochaDir = path.join('node_modules', 'marvin-js', 'lib', 'test-runner', 'mocha');
  var thread = childProcess.fork(mochaDir, process.argv);

  thread.send({ mocha: true, thread: index + 1, queue: queue, launchDate: session.launchDate });
  thread.on("exit", function(code) {
    if (code > 0) {
      failed = true;
    }
  });
});

process.on('exit', function() {
  if (config.reporter === 'marvin') {
    builder.prepareResults(path.join(baseResultsDir, session.launchDate));
  }
  if (failed) process.exit(2);
});



function createQueues(features, threads) {
  var len = features.length, queues = [], i = 0;
  while (i < len) {
    var size = Math.ceil((len - i) / threads--);
    queues.push(features.slice(i, i + size));
    i += size;
  }
  return queues;
}


