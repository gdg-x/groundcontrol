'use strict';

var express = require('express'),
	rate = require('express-rate'),
	config = require('../../config/config'),
	mongoose = require('mongoose'),
	Cacher = require("cacher"),
	uuid = require('node-uuid'),
	utils = require('./utils'),
	request = require('superagent');

module.exports = function(app) {
	var versions = [];
	var rateHandler;
	var cacher;

	utils.fixCacher(Cacher);

	console.log("Using in-memory");

	// Fallback to In-Memory handler if Redis is not available
	rateHandler = new rate.Memory.MemoryRateHandler();

	// In-Memory Cache
	cacher = new Cacher();

  	var rateMiddleware = function(req, res, next) {

  		var limit = 10000;

  		if(req.apikey)
  			limit = 50000;

  		var rm = rate.middleware({
  			handler: rateHandler,
  			limit: limit,
  			interval: 86400,
  			setHeadersHandler: function (req, res, rate, limit, resetTime) {
  				var remaining = limit - rate;

	            if (remaining < 0) {
	                remaining = 0;
	            }
  				res.setHeader('X-RateLimit-Limit', limit);
            	res.setHeader('X-RateLimit-Remaining', remaining);
            	res.setHeader('X-RateLimit-Reset', resetTime);
  			},
  			onLimitReached: function (req, res, rate, limit, resetTime, next) {
  				res.json(403, {error: 'Rate limit exceeded. Check headers for limit information.'});
  			},
  			getRouteKey: function(req) {
  				return "api";
  			},
  			getRemoteKey: function (req) {
  				var key = req.headers['x-client-ip'] || req.ip;
  				return key;
			}
  		});


  		rm(req, res, next);
  	};

	require("fs").readdirSync(__dirname + '/').forEach(function(file) {
		if (file.match(/.+\.js/g) == null) {
			var version = file;
	 		versions.push(version);

			var impl = express();
			/*impl.use(apiKeyMiddleware);
			impl.use(rateMiddleware);
			impl.use(analyticsMiddleware(version));*/

			impl.route = function(method, path, metadata) {
				var args = Array.prototype.slice.call(arguments);
				
				impl[method](path, args.slice(3));
			};

			impl.get('/', function(req, res) {
	    		res.redirect('/');
			});

	 		require("./"+file)(impl, cacher);
	 		
			app.get('/api/', function(req, res) {
				res.redirect('/');
			});

	 		app.use("/api/"+ version, impl);
		}
	});	

	app.get('/api/versions', function(req, res) {
 		res.json(versions);
	});
}