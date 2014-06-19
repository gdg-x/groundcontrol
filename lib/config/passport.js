'use strict';

var mongoose = require('mongoose'),
    passport = require('passport'),
    User = mongoose.model('User'),
	request = require('superagent');

/**
 * Passport configuration
 */
module.exports = function() {
	passport.serializeUser(function(user, done) {
		done(null, user._id);
	});

	passport.deserializeUser(function(id, done) {
		User.findOne({_id: id}, function(err, user) {
			done(err, user);
		});
	});
};