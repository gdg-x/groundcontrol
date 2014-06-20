'use strict';

angular.module('vizServerApp')
  .controller('CastSetupCtrl', function ($scope, $http, $location) {

    if(!$scope.cast_receiver)
      $location.url("/");

    $scope.cast = function() {
      chrome.cast.requestSession(new function(e) {
      }, new function(e) {
      });
    }
  })
  .controller('CastStageCtrl', function ($scope, $http) {

  	$scope.loadReceiverScript = function (cb) {
        var d=document,
        h=d.getElementsByTagName('head')[0],
        s=d.createElement('script');
        s.type='text/javascript';
        s.async=true;
        s.onload = function(){
          //once the script is loaded, run the callback
          if (cb){cb()};
        };

        s.src='https://www.gstatic.com/cast/sdk/libs/receiver/2.0.0/cast_receiver.js';
        h.appendChild(s);
    }

    $scope.loadReceiverScript(function() {
      $scope.$apply(function() {
        $scope.castReceiverManager = cast.receiver.CastReceiverManager.getInstance();

        $scope.castReceiverManager.onSenderDisconnected = function(event) {
          if(window.castReceiverManager.getSenders().length == 0 &&
            event.reason == cast.receiver.system.DisconnectReason.REQUESTED_BY_SENDER) {
              window.close();
          }
        };

        $scope.castReceiverManager.start();
      })
    });


  });
