'use strict';

angular.module('vizServerApp')
	.factory('Utilities', function ($resource) {
		return {
			decodeJwt: function(jwt, callback) {
				var contents = jwt.split(".");
				if(callback) callback(JSON.parse(atob(contents[1])));
			}
		};
	});
