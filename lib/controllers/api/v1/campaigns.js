'use strict';

var mongoose = require('mongoose'),
	utils = require('../utils'),
	User = mongoose.model('Campaign'),
	middleware = require('../../../middleware');

module.exports = function(app, cacher) {

	var myApp = utils.crudModel("Campaign", {
		idField: "_id",
		baseQuery: { $or: [ {is_public: true}, {created_by: "user_id"}] },
		auth: {
			list: { noAuth: true, roles: [ ]},
			get: { noAuth: true, roles: [ ]},
			create: { allowSession: true, roles: [ "admin" ]},
			update: { allowSession: true, roles: [ "admin" ]},
			delete: { allowSession: true, roles: [ "admin" ]},
		}
	}, middleware, app);
};