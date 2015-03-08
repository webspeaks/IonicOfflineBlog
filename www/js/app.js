var app = angular.module('webspeaksApp', ['ionic', 'ngSanitize']);

// Create the PouchDB database instance
var localDB = new PouchDB("webspeaksdb");

app.run(function($ionicPlatform) {
    $ionicPlatform.ready(function() {
        // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
        // for form inputs)
        if (window.cordova && window.cordova.plugins.Keyboard) {
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
        }
        if (window.StatusBar) {
            StatusBar.styleDefault();
        }
    });
});

// Define module constants
app.constant("config", {
    'FEED_URL': 'http://www.webspeaks.in/feed/atom',
    'PAGE_SIZE': 30
});

app.controller("AppController", ['$scope', 'config', 'DAO', 'FeedService', '$ionicLoading', '$ionicPopup',
    function($scope, config, DAO, FeedService, $ionicLoading, $ionicPopup) {

    $scope.feeds = [];  // Feeds to be shown on UI
    $scope.localFeeds = []; // Feeds from local DB

    // Watch the feeds property
    // If new feed is found, add it to DB
    $scope.$watch("feeds", function(newPosts, oldPosts) {
        if (newPosts.length) {
            _.each(newPosts, function(newPost) {

                // If the new post is not present in local DB
                // add it to the DB
                var exists = _.findWhere($scope.localFeeds, {link: newPost.link});
                if (_.isUndefined(exists)) {
                    var feed = {
                        // We use the URL of post as document ID
                        _id: newPost.link,
                        post: newPost
                    };

                    // Add the new post to local DB
                    localDB.post(feed, function callback(err, result) {
                        if (!err) {
                          console.log('Successfully posted a feed!');
                        }
                    });
                }
            });
        }
    });

    /**
     * Get the feeds from local DB using DAO service
     */
    $scope.getLocalFeed = function() {
        var localFeed = DAO.getFeed();
        localFeed.then(function(response) {
            if (response && response.length) {
                $scope.feeds = response;
                $scope.localFeeds = response;

                // Hide the loader
                $ionicLoading.hide();
            } else {
                // If no feeds are found in local DB
                // call the feeds API
                $scope.getRemoteFeed();
            }
        }, function() {
            // In case of error, call feeds API
            $scope.getRemoteFeed();
        });
    };

    /**
     * Get the feeds from remote feeds API using FeedService
     */
    $scope.getRemoteFeed = function() {
        if (!$scope.isOnline()) {
            $ionicPopup.alert({
                title: 'Oops!',
                template: 'You seem to be offline?'
            }).then(function() {
                $ionicLoading.hide();
                $scope.$broadcast('scroll.refreshComplete');
            });
        } else {
            FeedService
                .getFeed({url: config.FEED_URL, count: config.PAGE_SIZE})
                .then(function(response) {
                    $scope.feeds = response;
                    $ionicLoading.hide();
                    $scope.$broadcast('scroll.refreshComplete');
                }, function() {
                }, function() {
                    $ionicLoading.hide();
                    $scope.$broadcast('scroll.refreshComplete');
                });
        }
    };

    /**
     * Called on application load and loads the feeds
     */
    $scope.initFeed = function() {
        $ionicLoading.show({
            template: 'Loading...'
        });
        $scope.getLocalFeed();
    };

    /**
     * Called on "pull to refresh" action
     */
    $scope.refreshFeed = function() {
        $scope.getRemoteFeed();
    };

    $scope.isOnline = function() {
        var networkState = null;

        if (navigator.connection) {
            networkState = navigator.connection.type;
        }

        if (networkState && networkState === Connection.NONE) {
            return false;
        }
        if (navigator.onLine) {
            return true;
        } else {
            return false;
        }
    };

    // Initialize the feeds
    $scope.initFeed();
}]);

/**
 * This service calls the remote feeds API
 * and returns the feeds response
 */
app.service("FeedService", function($http, $q) {

    // Return public API.
    return ({
        getFeed: getFeed
    });

    function getFeed(paramData) {
        paramData = paramData || {};
        var url = document.location.protocol + '//ajax.googleapis.com/ajax/services/feed/load?v=1.0&num='+ paramData.count +'&callback=JSON_CALLBACK&q=' + encodeURIComponent(paramData.url),
            request = $http.jsonp(url);

        return (request.then(handleSuccess, handleError));
    }

    // Transform the error response, unwrapping the application data from
    // the API response payload.
    function handleError(response) {
        // The API response from the server should be returned in a
        // nomralized format. However, if the request was not handled by the
        // server (or what not handles properly - ex. server error), then we
        // may have to normalize it on our end, as best we can.
        if (!angular.isObject(response.data) || !response.data.message) {
            return ($q.reject("An unknown error occurred."));
        }
        // Otherwise, use expected error message.
        return ($q.reject(response.data.message));
    }

    // I transform the successful response, unwrapping the application data
    // from the API response payload.
    function handleSuccess(response) {
        if (response.data && response.data.responseData && response.data.responseData.feed) {
            if (response.data.responseData.feed.entries) {
                if (response.data.responseData.feed.entries.length) {
                    return (response.data.responseData.feed.entries);
                }
            }
        }
    }
});

/**
 * The "Data Access Object" service
 * This service gets the feeds from local database
 * using PouchDB database object
 */
app.service("DAO", function($q) {

    // Return public API.
    return ({
        getFeed: getFeed
    });

    function getFeed() {
        var deferred = $q.defer();
        localDB.allDocs({include_docs: true, descending: true}, function(err, doc) {
            if (err) {
                deferred.reject(err);
            } else {
                var rows = [];
                for (var x in doc.rows) {
                    rows.push(doc.rows[x].doc.post);
                }
                deferred.resolve(rows);
            }
        });
        return deferred.promise;
    }

});