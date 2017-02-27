﻿angular
    .module('bit.settings')

    .controller('settingsFeaturesController', function ($scope, i18nService, $analytics, constantsService, utilsService) {
        $scope.i18n = i18nService;
        $scope.disableGa = false;
        $scope.disableAddLoginNotification = false;

        chrome.storage.local.get(constantsService.disableGaKey, function (obj) {
            // Default for Firefox is disabled.
            if ((utilsService.isFirefox() && obj[constantsService.disableGaKey] === undefined) ||
                obj[constantsService.disableGaKey]) {
                $scope.disableGa = true;
            }
            else {
                $scope.disableGa = false;
            }

            $scope.$apply();
        });

        chrome.storage.local.get(constantsService.disableAddLoginNotificationKey, function (obj) {
            if (obj && obj[constantsService.disableAddLoginNotificationKey]) {
                $scope.disableAddLoginNotification = true;
            }
            else {
                $scope.disableAddLoginNotification = false;
            }

            $scope.$apply();
        });

        $scope.updateGa = function () {
            chrome.storage.local.get(constantsService.disableGaKey, function (obj) {
                // Default for Firefox is disabled.
                if ((utilsService.isFirefox() && obj[constantsService.disableGaKey] === undefined) ||
                    obj[constantsService.disableGaKey]) {
                    // enable
                    obj[constantsService.disableGaKey] = false;
                }
                else {
                    // disable
                    $analytics.eventTrack('Disabled Google Analytics');
                    obj[constantsService.disableGaKey] = true;
                }

                chrome.storage.local.set(obj, function () {
                    $scope.disableGa = obj[constantsService.disableGaKey];
                    $scope.$apply();
                    if (!obj[constantsService.disableGaKey]) {
                        $analytics.eventTrack('Enabled Google Analytics');
                    }
                });
            });
        };

        $scope.updateAddLoginNotification = function () {
            chrome.storage.local.get(constantsService.disableAddLoginNotificationKey, function (obj) {
                if (obj[constantsService.disableAddLoginNotificationKey]) {
                    // enable
                    obj[constantsService.disableAddLoginNotificationKey] = false;
                }
                else {
                    // disable
                    $analytics.eventTrack('Disabled Add Login Notification');
                    obj[constantsService.disableAddLoginNotificationKey] = true;
                }

                chrome.storage.local.set(obj, function () {
                    $scope.disableAddLoginNotification = obj[constantsService.disableAddLoginNotificationKey];
                    $scope.$apply();
                    if (!obj[constantsService.disableAddLoginNotificationKey]) {
                        $analytics.eventTrack('Enabled Add Login Notification');
                    }
                });
            });
        };
    });
