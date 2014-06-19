'use strict';

var mongoose = require('mongoose'),
	utils = require('../utils'),
	User = mongoose.model('Visualization'),
	middleware = require('../../../middleware');

module.exports = function(app, cacher) {

	var myApp = utils.crudModel("Visualization", {
		idField: "_id",
		auth: {
			list: { noAuth: true, roles: [ ]},
			get: { noAuth: true, roles: [ ]},
			create: { allowSession: true, roles: [ "admin" ]},
			update: { allowSession: true, roles: [ "admin" ]},
			delete: { allowSession: true, roles: [ "admin" ]},
		}
	}, middleware, app);
};