'use strict';

angular.module('vizServerApp')
  .controller('NavbarCtrl', function ($scope, $location) {
    $scope.menu = [
    	{
			'title': 'Home',
			'link': '/'
    	}
    ];
    $scope.authed_menu = [
	    {
			'title': 'Campaigns',
			'link': '/campaigns',
	    },
	    {
			'title': 'Visualizations',
			'link': '/visualizations',
	    }
    ];
    $scope.isActive = function(route) {
      return route === $location.path();
    };
  });
