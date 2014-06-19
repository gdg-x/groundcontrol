'use strict';

var passport = require('passport'),
	express = require('express');

/**
 * Custom middleware used by the application
 */
module.exports = {
	auth: function(options) {

		options = options || {};
		var allowSession = options.allowSession != undefined ? options.allowSession : true;
		var allowIdToken = options.allowIdToken != undefined ? options.allowIdToken : true;

		var requireCsrf = options.requireCsrf != undefined ? options.requireCsrf : false;
		var noauth = options.noAuth != undefined ? options.noAuth : false;
		var roles = options.roles != undefined ? options.roles : [];

		return function(req, res, next) {

			var checkRoles = function(req, res, next) {
				if(roles.length == 0) {
					next();
				} else {
					for(var i = 0; i < roles.length; i++) {
						if(req.user.roles.indexOf(roles[i]) == -1)
							return res.send(400, "Unauthorized (missing role)");
					}
					next();
				}
			};

			var auth = function(req, res, next) {
				if((!allowSession && !allowIdToken) || noauth) {
					next();
				} else {
					if(allowSession && req.user && req.session) {
						checkRoles(req, res, next);
					} else if(allowIdToken) {
						passport.authenticate('bearer', { session: false })(req,res, next);
					} else res.send(400, "Unauthorized");
				}
			};

			if(requireCsrf) {
				var csrfValue = function(req) {
					var token = (req.body && req.body._csrf)
					|| (req.query && req.query._csrf)
					|| (req.headers['x-csrf-token'])
					|| (req.headers['x-xsrf-token']);
					return token;
				};

				express.csrf({value: csrfValue})(req, res, function() {
					res.cookie('XSRF-TOKEN', req.csrfToken());
					auth(req, res, next);
				});

			} else {
				auth(req, res, next);
			}
		};
	}
};