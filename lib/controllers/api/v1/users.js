'use strict';

var mongoose = require('mongoose'),
	utils = require('../utils'),
	User = mongoose.model('User'),
	middleware = require('../../../middleware');

module.exports = function(app, cacher) {

	app.route("get", "/users/me", { 
		summary: "-"
	}, middleware.auth({ allowIdToken: true, allowSession: true }), function(req, res) {
		User.findOne({
			_id: req.user._id
		}, function(err, user) {
			if(!user)
				return res.send(404, "Not found");

			return res.jsonp({
				_id: user._id,
				email: user.email,
				firstname: user.firstname,
				lastname: user.lastname,
				picture: user.picture,
				roles: user.roles
			});
		})
	});
};