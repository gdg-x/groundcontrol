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
      .when('/cast/setup', {
        templateUrl: 'partials/cast_setup',
        controller: 'CastSetupCtrl'
      })
      .when('/cast/stage', {
        templateUrl: 'partials/cast_stage',
        controller: 'CastStageCtrl'
      })
      .when('/campaigns', {
        templateUrl: 'partials/campaign_list',
        controller: 'CampaignListCtrl'
      })
      .when('/visualizations', {
        templateUrl: 'partials/visualization_list',
        controller: 'VisualizationListCtrl'
      })
      .when('/about', {
        templateUrl: 'partials/about',
        controller: 'AboutCtrl'
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

    var initializeCastApi = function() {
      var sessionRequest = new chrome.cast.SessionRequest("8D68C436");
      var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
          function(e) {
            $rootScope.$broadcast("cast_sdk_session", e);
          },
          function(e) {
            $rootScope.$broadcast("cast_sdk_receiver", e);
            if( e === chrome.cast.ReceiverAvailability.AVAILABLE) {
              $rootScope.cast_receiver = true;
            } else {
              $rootScope.cast_receiver = false;
            }
          });
      
      chrome.cast.initialize(apiConfig, function() {
        console.log("Cast SDK initialized.");
        $rootScope.cast = true;
      }, function() {

      });
    };

    window['__onGCastApiAvailable'] = function(loaded, errorInfo) {
      if (loaded) {
        console.log("I got cast baby!");
        $rootScope.$broadcast("cast_sdk_available", { available: true });
        initializeCastApi();
      } else {
        $rootScope.$broadcast("cast_sdk_available", { available: false, err: errorInfo });
        console.log(errorInfo);
      }
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