'use strict';

angular.module('vizServerApp')
  .controller('MainCtrl', function ($scope, $http, $location) {
  	$scope.setupCast = function() {
  		$location.url("/cast/setup");
  	};
  });
