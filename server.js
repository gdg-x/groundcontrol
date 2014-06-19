'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var express = require('express'),
    path = require('path'),
    fs = require('fs'),
    mongoose = require('mongoose'),
    cluster = require('cluster'),
    http = require('http'),
    config = require('./lib/config/config'),
    numCPUs = require('os').cpus().length,
    mongoose = require('mongoose');

/**
 * Main application file
 */
console.log2 = console.log;
console.log = function(){
	var args = Array.prototype.slice.call(arguments);

	if(args.length > 1) {
		args[0] = "["+process.pid+"] "+args[0];
		this.log2.apply(this, args);
	} else {
		this.log2("["+process.pid+"] "+args[0]);
	}
};

if (cluster.isMaster) {

  var forks = numCPUs;
  if(!config.redis) {
  	forks = 1;
  }

  // Fork workers.
  for (var i = 0; i < forks; i++) {
  	setTimeout(function() {
	    var worker = cluster.fork();
	    console.log('worker started, PID '+ worker.process.pid);
  	}, (i+1)*5000); 
  }

  cluster.on('exit', function(deadWorker, code, signal) {
    // Restart the worker
    var worker = cluster.fork();

    // Note the process IDs
    var newPID = worker.process.pid;
    var oldPID = deadWorker.process.pid;

    // Log the event
    console.log('worker '+oldPID+' died. Code: '+ code + ", Signal: "+ signal);
    console.log('worker '+newPID+' born.');
  });

} else {

	var config = require('./lib/config/config');
	var db = mongoose.connect(config.mongo.uri, config.mongo.options);

	// Bootstrap models
	var modelsPath = path.join(__dirname, 'lib/models');
	fs.readdirSync(modelsPath).forEach(function (file) {
	  if (/(.*)\.(js$|coffee$)/.test(file)) {
	    require(modelsPath + '/' + file);
	  }
	});

	require('./lib/config/passport')();

	// Setup Express
	var app = express();
	var server = server = http.createServer(app);

	var io = require('./lib/config/socketio')(server);

	require('./lib/controllers/screenswitch')(io, app);

	require('./lib/config/express')(app);
	require('./lib/routes')(app, io);

	// Start server
	server.listen(config.port, config.ip, function () {
	  console.log('Express server listening on %s:%d, in %s mode', config.ip, config.port, app.get('env'));
	});

	// Expose app
	exports = module.exports = app;
}