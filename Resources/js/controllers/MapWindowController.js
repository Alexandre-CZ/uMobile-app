/*
 * Licensed to Jasig under one or more contributor license
 * agreements. See the NOTICE file distributed with this work
 * for additional information regarding copyright ownership.
 * Jasig licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a
 * copy of the License at:
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/* map_window.js contains setup information for the
 * map tab.
 */

var MapWindowController = function(facade) {
    var _self = this;
    
    // Pseudo private variables
    this._app = facade;
    this._initialized;
    this._locationDetailViewOptions;
    this._rawAnnotations = [];
    this._activeCategory;
    this._categoryPage;
    this._categoryResultsPerPage = 10;
    this._firstOpen = true;
    
    this._win;


    init = function() {
        _self.key = 'map';
        
        if (typeof MapProxy === "undefined")        Titanium.include('/js/models/MapProxy.js');
        if (typeof MapDetailView === "undefined")   Titanium.include('/js/views/MapDetailView.js');
        if (typeof MapWindowView === "undefined")   Titanium.include('/js/views/MapWindowView.js');
        
        _self._app.registerModel('mapProxy', new MapProxy(app)); //Manages retrieval, storage, and search of map points. Gets all data from map portlet on uPortal, but stores locally.
        _self._app.registerView('mapDetailView', new MapDetailView(app)); // Subcontext in MapWindowController to show details of a location on the map
        _self._app.registerView('mapWindowView', new MapWindowView(app));
        
        Ti.App.addEventListener(MapProxy.events['SEARCHING'], _self._onProxySearching);
        Ti.App.addEventListener(MapProxy.events['SEARCH_COMPLETE'], _self._onProxySearchComplete);
        Ti.App.addEventListener(MapProxy.events['EMPTY_SEARCH'], _self._onProxyEmptySearch);
        Ti.App.addEventListener(MapProxy.events['LOAD_ERROR'], _self._onProxyLoadError);
        Ti.App.addEventListener(MapProxy.events['LOADING'], _self._onProxyLoading);
        Ti.App.addEventListener(MapProxy.events['POINTS_LOADED'], _self._onProxyLoaded);
        Ti.App.addEventListener(MapWindowView.events['SEARCH_SUBMIT'], _self._onMapSearch);
        Ti.App.addEventListener(MapWindowView.events['MAPVIEW_CLICK'], _self._onMapViewClick);
        Ti.App.addEventListener(MapWindowView.events['DETAIL_CLICK'], _self._loadDetail);
        Ti.App.addEventListener(MapWindowView.events['NAV_BUTTON_CLICK'], _self._onNavButtonClick);
        Ti.App.addEventListener(MapWindowView.events['CATEGORY_ROW_CLICK'], _self._onCategoryRowClick);
        Ti.App.addEventListener(MapWindowView.events['CATEGORY_RIGHT_BTN_CLICK'], _self._onCategoryRightBtnClick);
    };
    
    this.open = function () {
        Ti.App.addEventListener(ApplicationFacade.events['DIMENSION_CHANGES'], _self._onOrientationChange);

        _self._win = Titanium.UI.createWindow({
            url: 'js/views/WindowContext.js',
            backgroundColor: _self._app.styles.backgroundColor,
            exitOnClose: false,
            navBarHidden: true,
            orientationModes: [
            	Titanium.UI.PORTRAIT,
            	Titanium.UI.UPSIDE_PORTRAIT,
            	Titanium.UI.LANDSCAPE_LEFT,
            	Titanium.UI.LANDSCAPE_RIGHT
            ]
        });
        _self._win.open();
        
        _self._win.add(_self._app.views.mapWindowView.createView());
        
        if (_self._app.models.deviceProxy.isAndroid()) {
        	 _self._win.addEventListener('android:search', _self._onAndroidSearch);
        }
        
        if (! _self._initialized) {
            _self._app.models.mapProxy.init();
        }
        
        _self._initialized = true;
    };
    
    this.close = function (options) {
        Ti.API.debug("close() in MapWindowController");
        _self._app.views.mapWindowView.searchBlur();
        Ti.App.removeEventListener(ApplicationFacade.events['DIMENSION_CHANGES'], _self._onOrientationChange);
        if (_self._app.models.deviceProxy.isAndroid()) {
        	try {
        		 _self._win.removeEventListener('android:search', _self._onAndroidSearch);
        	}
        	catch (e) {
        		Ti.API.error("Couldn't remove search event from Map Window");
        	}
        }
        if (_self._win) {
            _self._win.close();
        }
    };

    this._loadDetail = function(_annotation) {
        //Create and open the view for the map detail
        Ti.API.debug('loadDetail() in MapWindowController');
        _self._app.views.mapWindowView._activityIndicator.setLoadingMessage(_self._app.localDictionary.loading);
        _self._app.views.mapWindowView._activityIndicator.show();
        _self._app.views.mapWindowView.searchBlur();

        
        if (!_self._locationDetailView || _self._app.models.deviceProxy.isIOS()) {
            _self._locationDetailViewOptions = _self._app.styles.view.clone();
            _self._locationDetailViewOptions.data = _annotation;
            _self._locationDetailView = _self._app.views.mapDetailView.getDetailView();
            _self._win.add(_self._locationDetailView);
        }
        _self._app.views.mapDetailView.render(_annotation);
        
        _self._locationDetailView.show();

        _self._app.views.mapWindowView._activityIndicator.hide();
    };
    
    // Mapview events
    this._onMapSearch = function (e) {
        _self._app.models.mapProxy.search(e.value);
    };
    
    this._onMapViewClick = function (e) {
        var _annotation;
        Ti.API.info("_onMapViewClick() in MapWindowController");
        if (e.clicksource === 'title' && e.title) {
            // _self._app.views.mapWindowView.searchBlur(); //Search should already be blurred...
            _annotation = _self._app.models.mapProxy.getAnnotationByTitle(e.title);
            _self._loadDetail(_annotation);
        }
        else {
            Ti.API.info("Clicksource: " + e.clicksource);
            Ti.API.info("Title: " + e.title);
            Ti.API.info("Result of search: " + _self._app.models.mapProxy.getAnnotationByTitle(e.title));
        }
    };
    
    this._onNavButtonClick = function (e) {
        switch (e.buttonName) {
            case MapWindowView.navButtonValues[0]:
                _self._app.views.mapWindowView.setView(MapWindowView.views['SEARCH']);
                break;
            case MapWindowView.navButtonValues[1]:
                _self._app.views.mapWindowView.setView(MapWindowView.views['CATEGORY_BROWSING'], _self._app.models.mapProxy.getCategoryList());
                break;
            case MapWindowView.navButtonValues[2]:
                _self._app.views.mapWindowView.setView(MapWindowView.views['FAVORITES_BROWSING']);
                break;
            default:
                Ti.API.error("No case matched in _handleNavButtonClick");
        }
    };
    
    this._onCategoryRowClick = function (e) {
        // Will receive an event, with "category" string property
        // Tell the map window view to open the locations list, and pass 
        // collection of locations for that category
        Ti.API.info("_onCategoryRowClick() in MapWindowController. Category:" + e.category);
        _self._activeCategory = e.category;
        _self._app.views.mapWindowView.setView(MapWindowView.views['CATEGORY_LOCATIONS_LIST'], _self._app.models.mapProxy.getLocationsByCategory(e.category, _self._categoryResultsPerPage));
    };
    
    this._onCategoryRightBtnClick = function (e) {
        // Will respond when user presses the right-side button in 
        // map category view navigation
        
        // Will get the current active view, and determine what view
        // Should be shown.
        switch (_self._app.views.mapWindowView.getView()) {
            case MapWindowView.views['CATEGORY_BROWSING']:
                _self._app.views.mapWindowView.setView(MapWindowView.views['CATEGORY_LOCATIONS_MAP'], _self._app.models.mapProxy.getLocationsByCategory(_self._activeCategory || '', _self._categoryResultsPerPage));
                break;
            case MapWindowView.views['CATEGORY_LOCATIONS_LIST']:
                _self._app.views.mapWindowView.setView(MapWindowView.views['CATEGORY_LOCATIONS_MAP'], _self._app.models.mapProxy.getLocationsByCategory(_self._activeCategory || '', _self._categoryResultsPerPage));
                break;
            case MapWindowView.views['CATEGORY_LOCATIONS_MAP']:
                _self._app.views.mapWindowView.setView(MapWindowView.views['CATEGORY_LOCATIONS_LIST'], _self._app.models.mapProxy.getLocationsByCategory(_self._activeCategory, _self._categoryResultsPerPage));
                break;
            default:
                return;
        }
        
    };

    //Proxy Events
    this._onProxySearching = function (e) {
        Ti.API.debug('onProxySearching' + e.query);
        _self._app.views.mapWindowView._activityIndicator.setLoadingMessage(_self._app.localDictionary.searching);
        _self._app.views.mapWindowView._activityIndicator.show();
    };
    
    this._onProxyLoading = function (e) {
        Ti.API.debug("onProxyLoading() in MapWindowController.");
        _self._app.views.mapWindowView._activityIndicator.setLoadingMessage(_self._app.localDictionary.mapLoadingLocations);
        _self._app.views.mapWindowView._activityIndicator.show();
    };
    
    this._onProxyLoaded = function (e) {
        Ti.API.info("onProxyLoaded in MapWindowController. Center: " + JSON.stringify(_self._app.models.mapProxy.getMapCenter()));
        _self._app.views.mapWindowView._resetMapLocation();
        _self._app.views.mapWindowView._activityIndicator.hide();
    };
    
    this._onProxySearchComplete = function (e) {
        Ti.API.debug('onProxySearchComplete');
        var alertDialog;
        
        _self._app.views.mapWindowView._activityIndicator.hide();
        
        if(e.points.length < 1) {
            if (_self._win.visible || _self._app.models.deviceProxy.isIOS()) {
                try {
                    alertDialog = Titanium.UI.createAlertDialog({
                        title: _self._app.localDictionary.noResults,
                        message: _self._app.localDictionary.mapNoSearchResults,
                        buttonNames: [_self._app.localDictionary.OK]
                    });
                    alertDialog.show();
                }
                catch (e) {
                    Ti.API.error("Couldn't show alert in MapWindowController: " + e);
                }
            }
            else {
                Ti.API.debug("Window not visible to show alert");
            }
        }
        else {
            _self._app.views.mapWindowView._plotPoints(e.points);
        }
    };
    
    this._onProxyEmptySearch = function (e) {
        Ti.API.debug("Hiding activity indicator in onProxyEmptySearch()");
        _self._app.views.mapWindowView._activityIndicator.hide();
    };
    
    this._onAndroidSearch = function (e) {
    	Ti.API.debug("onAndroidSearch() in MapWindowController");
    	if (_self._app.views.mapWindowView._searchBar && _self._app.views.mapWindowView._searchBar.input) {
    		_self._app.views.mapWindowView._searchBar.input.focus();
    	}
    	if (_self._app.views.mapWindowView._locationDetailView) {
    		_self._app.views.mapWindowView._locationDetailView.hide();
    	}
    };
    
    this._onProxyLoadError = function (e) {
        Ti.API.debug("Hiding activity indicator in onProxyLoadError()");
        var alertDialog;
        
        _self._app.views.mapWindowView._activityIndicator.hide();
        
        if (_self._win.visible || _self._app.models.deviceProxy.isIOS()) {
            try {
                switch (e.errorCode) {
                    case MapProxy.requestErrors.NETWORK_UNAVAILABLE:
                        alertDialog = Titanium.UI.createAlertDialog({
                            title: _self._app.localDictionary.error,
                            message: _self._app.localDictionary.map_NETWORK_UNAVAILABLE,
                            buttonNames: [_self._app.localDictionary.OK]
                        });
                        alertDialog.show();
                        break;
                    case MapProxy.requestErrors.REQUEST_TIMEOUT:
                        alertDialog = Titanium.UI.createAlertDialog({
                            title: _self._app.localDictionary.error,
                            message: _self._app.localDictionary.map_REQUEST_TIMEOUT,
                            buttonNames: [_self._app.localDictionary.OK]
                        });
                        alertDialog.show();
                        break;
                    case MapProxy.requestErrors.SERVER_ERROR:
                        alertDialog = Titanium.UI.createAlertDialog({
                            title: _self._app.localDictionary.error,
                            message: _self._app.localDictionary.map_SERVER_ERROR,
                            buttonNames: [_self._app.localDictionary.OK]
                        });
                        alertDialog.show();
                        break;
                    case MapProxy.requestErrors.NO_DATA_RETURNED:
                        alertDialog = Titanium.UI.createAlertDialog({
                            title: _self._app.localDictionary.error,
                            message: _self._app.localDictionary.map_NO_DATA_RETURNED,
                            buttonNames: [_self._app.localDictionary.OK]
                        });
                        alertDialog.show();
                        break;
                    case MapProxy.requestErrors.INVALID_DATA_RETURNED: 
                        alertDialog = Titanium.UI.createAlertDialog({
                            title: _self._app.localDictionary.error,
                            message: _self._app.localDictionary.map_INVALID_DATA_RETURNED,
                            buttonNames: [_self._app.localDictionary.OK]
                        });
                        alertDialog.show();
                        break;
                    default:
                        alertDialog = Titanium.UI.createAlertDialog({
                            title: _self._app.localDictionary.error,
                            message: _self._app.localDictionary.map_GENERAL_ERROR,
                            buttonNames: [_self._app.localDictionary.OK]
                        });
                        alertDialog.show();
                }
            }
            catch (e) {
                Ti.API.error("Couldn't show alert in MapWindowController: " + e);
            }
        }
    };
    
    this._onOrientationChange = function (e) {
        if (_self._app.models.deviceProxy.isIOS() || _self._win && _self._win.visible) {
            _self._app.views.mapWindowView.resetDimensions();
        }
    };

    if (!_self._initialized) {
        init();
    }
};
MapWindowController.events = {
    LOAD_DETAIL : 'loaddetail'
};