'use strict';

angular.module('vizServerApp', [
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'directive.g+signin',
  'ngRoute'
])
  .config(function ($routeProvider, $locationProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'partials/main',
        controller: 'MainCtrl'
      })
      .otherwise({
        redirectTo: '/'
      });
      
    $locationProvider.html5Mode(true);
  })
  .run(function ($rootScope, $location, $http, $window, Utilities) {
    $rootScope.user = {
          authResult: undefined,
          auth: false,
        };

    $rootScope.toggleMenu = function() {
      if($rootScope.menu_toggle) {
        $rootScope.menu_toggle = "";
      } else {
        $rootScope.menu_toggle = "navbar_open";
      }
    }

    $rootScope.supportsGeo = $window.navigator.geolocation != undefined;

    if($rootScope.supportsGeo) {
      $window.navigator.geolocation.getCurrentPosition(function(position) {
          $rootScope.$apply(function() {
              $rootScope.position = position;
          });
      }, function(error) {
          console.log(error);
      });
    }

    $rootScope.$on('$routeChangeSuccess', function(event) {
      ga('send', 'pageview', {'page': $location.path()});
    });

    $rootScope.$on('event:google-plus-signin-success', function (event,authResult) {
      // Send login to server or save into cookie   $rootScope.$apply(function() {
      Utilities.decodeJwt(authResult['id_token'], function(claims) {
        if(authResult['status']['signed_in']) {
          $http.post('/signin', { code: authResult['code'] }).success(function(data) {

            if(data.user == claims.sub) {
              $http.get('https://www.googleapis.com/plus/v1/people/me?fields=image&key=AIzaSyAtuJY6dab373mdonWsuel73XNL6KqgkQ0', { headers: { 'Authorization': "Bearer "+ authResult['access_token']} }).success(function(additional) {
                $rootScope.user = {
                  auth: authResult['status']['signed_in'],
                  authResult: authResult,
                  image: additional.image.url.replace("sz=50","sz=32"),
                  email: claims['email'],
                  userId: claims['sub'],
                  roles: data.roles
                };

                if($location.host().indexOf("localhost") != -1) {
                  $rootScope.socket = io.connect('http://localhost:9000');
                } else {
                  $rootScope.socket = io.connect('http://groundcontrol.gdgx.io:8000');
                }

                $rootScope.$broadcast("authenticated");
              });
            } else {
              alert("ID Missmatch");
            }
          });
        }
      });
    });

    $rootScope.$on('event:google-plus-signin-failure', function (event,authResult) {
      // Auth failure or signout detected
      console.log("Auth failed");
      console.log(authResult["error"]);
      $rootScope.$apply(function() {
        $rootScope.user = {
          authResult: authResult,
          auth: false,
        };
      });
    });
  });