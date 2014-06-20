'use strict';

angular.module('vizServerApp')
  .controller('AboutCtrl', function ($scope, $http) {
		$http.get("https://api.github.com/repos/gdg-x/groundcontrol/contributors").success(function(data, status, headers, config) {
			$scope.contributors = data;
		});
  });
