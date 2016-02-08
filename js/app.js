var module = angular.module('cordovaApp', ['ionic']);

module.config(['$urlRouterProvider', '$stateProvider', '$compileProvider', '$sceProvider',
  function($urlRouterProvider, $stateProvider, $compileProvider, $sceProvider) {

  var pages = Object.keys(window.profile.ui.pages);

  angular.forEach(pages, function(page) {
    $stateProvider.state(page, {
      url: '/' + (page === 'main' ? '' : page),
      resolve: {
        pageName: function() {
          return page;
        }
      },
      views: {
          'main': {
                templateUrl: 'partials/page.html',
                controller: 'PageController'
              }
          }
      });
  });

  var regexp = /^\s*(https?|ftp|mailto|zip|asset|tel|geo|smsto|whatsapp):/;
  $compileProvider.urlSanitizationWhitelist && $compileProvider.urlSanitizationWhitelist(regexp);
  $compileProvider.aHrefSanitizationWhitelist && $compileProvider.aHrefSanitizationWhitelist(regexp);
  $compileProvider.imgSrcSanitizationWhitelist && $compileProvider.imgSrcSanitizationWhitelist(regexp);
  $sceProvider.enabled(false);
  $urlRouterProvider.otherwise('/');
}]);

module.simpleDirective = function (name, template, extra) {
    return this.directive(name, ['$parse',function ($parse) {
        return angular.extend({
            restrict: 'A',
            scope: true,
            templateUrl: template,
            link: function(scope,element,attr) {
                var ctrl = scope.thisCtrl = $parse(attr[name])(scope);
                ctrl.css && element.css(ctrl.css);

                scope.controlClasses = function(c) {
                    var classes = [];
                    classes.push(c.id);
                    return classes.join(" ");
                }
            }
        }, extra || {});
    }]);
};

module.directive('lucyControl', ['$compile','$parse',function($compile, $parse) {
    return  {
        scope: true,
        link: function(scope, element, attr) {
            scope.$watch(attr.lucyControl, function (def) {
                element.replaceWith(element = $compile('<div ' + def.type + '="' + attr.lucyControl + '">' + '</div>')(scope));
            }, true);
        }
    }
}]);

module.directive('htmlBlock', ['$compile',function($compile) {
    return  {
        link: function(scope, element, attr) {
            scope.$watch(attr.htmlBlock, function (def) {
                element.html($compile(def.html)(scope));

                if (def.javascript) {
                    eval(def.javascript);
                }

                if (def.conf) {
                    for (var item in  def.conf) {
                        scope[item] = def.conf[item].value;
                    }
                }

                var args = [];
                args.push(scope);

                if(this['inject']) {
                    var injector = angular.element(document).injector();

                    angular.forEach(this['inject'], function(name) {
                        if (name === 'pageScope' && scope.$parent) {
                            args.push(scope.$parent.$parent.$parent.$parent);
                        } if (name === 'app') {
                          args.push(module);
                        } else {
                            args.push(injector.get(name));
                        }
                    });
                }

                if (this['extend']) {
                    this['extend'].apply(this, args);
                }

            }, true);
        }
    }
}]);

module.simpleDirective('lucyVPanel', 'templates/ctrl/vpanel.html');

module.controller('PageController', ['pageName', '$scope', function(pageName, $scope) {
  $scope.pageName = pageName;
  $scope.data = {
    pageTitle: pageName
  };
  $scope.setPageTitle = function(title) {
    $scope.data.pageTitle = title;
  };
}]);

module.controller('AppController', ['$scope', '$timeout', '$parse', function($scope, $timeout, $parse) {
  $scope.profile = window.profile;

  window.addEventListener('message', function (event) {
      event.data.updateProfile = function (exclude) {
        for (var key in event.data.profile) {
            if (exclude.indexOf(key) == -1) {
                $scope.profile[key] = event.data.profile[key];
            }
        }
        $scope.profile.groupItemsCache = {};
        $scope.profile.controlsCache = {};
        parent.postMessage({message: "cancel_interval"}, "*");
        $scope.$apply();
      };
      if (event.data.message == "update_profile") {
          event.data.updateProfile(event.data.exclude);
      }
  }, false);

  $scope.part = function(name) {
    return $parse(name)($scope);
  };

  $scope.ep = function(p) {
      return encodeURI('tel:'+p);
  };

  $scope.bodyStyle = function(type) {
    var _this = this;
    if (this.profile) {
      if (!this.headStyles || window != window.parent) {
          if (!this.headStyles) {
            this.headStyles = $("<style />").appendTo($("head"));
          }
          var styles = "";
          var addControlStyle = function (page) {
            if (page && page.controls) {
              $.each(page.controls, function (i, control) {
                if (control.css && control.css.trim() !== "") {
                    styles = "\n" + styles + control.css;
                }
              });
            }
          };

          angular.forEach(this.profile.ui.pages, function(page, name) {
            addControlStyle(page);
          });
          angular.forEach([this.profile.ui.header, this.profile.ui.footer], function(e, i) {
            addControlStyle(e);
          });

          this.headStyles.text(styles);
      }

      var result = {
        "background-color": this.profile['background-color'] ? this.profile['background-color'] : "transparent",
        "background-image": this.profile['background-image'] ? "url(" + this.profile['background-image'] + ")" : "none",
        "background-repeat": this.profile['background-repeat'] ? this.profile['background-repeat'] : "no-repeat",
        "background-position": "0 0",
        "background-attachment": "scroll"
      };
      return result;
    }
  };

}]);

module.run([function() {
  if (navigator.splashscreen) {
    navigator.splashscreen.hide();
  }
}]);

$("body").on("click", "a", function(e) {
  var href = $(this).attr("href");
  if (href) {
    var hrefParts = href.split(":");
    var scheme = hrefParts.shift();
    var path = hrefParts.pop();

    if (scheme === 'tel') {
      window.plugins.CallNumber.callNumber(function() {}, function() {}, path, true);
    } else {
      cordova.InAppBrowser.open(href, "_system", 'location=yes');
    }
  }
  e.preventDefault();
});

document.addEventListener("deviceready", onDeviceReady, false);
function onDeviceReady() {

  var url = "https://raw.githubusercontent.com/nsakovich/phonegap-build-demo/master/profile.js?" + (new Date()).getTime();
  window.$.get(url, function(data) {
    localStorage.setItem('profile', data);
  });

  document.addEventListener("offline", function() {
    //window.alert("Offline!");
  }, false);
  document.addEventListener("online", function() {
    //window.alert("Online!");
  }, false);
}
