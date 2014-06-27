(function($, undefined) {

/**
 * Unobtrusive scripting adapter for jQuery
 * https://github.com/rails/jquery-ujs
 *
 * Requires jQuery 1.7.0 or later.
 *
 * Released under the MIT license
 *
 */

  // Cut down on the number of issues from people inadvertently including jquery_ujs twice
  // by detecting and raising an error when it happens.
  if ( $.rails !== undefined ) {
    $.error('jquery-ujs has already been loaded!');
  }

  // Shorthand to make it a little easier to call public rails functions from within rails.js
  var rails;
  var $document = $(document);

  $.rails = rails = {
    // Link elements bound by jquery-ujs
    linkClickSelector: 'a[data-confirm], a[data-method], a[data-remote], a[data-disable-with]',

    // Button elements bound by jquery-ujs
    buttonClickSelector: 'button[data-remote]',

    // Select elements bound by jquery-ujs
    inputChangeSelector: 'select[data-remote], input[data-remote], textarea[data-remote]',

    // Form elements bound by jquery-ujs
    formSubmitSelector: 'form',

    // Form input elements bound by jquery-ujs
    formInputClickSelector: 'form input[type=submit], form input[type=image], form button[type=submit], form button:not([type])',

    // Form input elements disabled during form submission
    disableSelector: 'input[data-disable-with], button[data-disable-with], textarea[data-disable-with]',

    // Form input elements re-enabled after form submission
    enableSelector: 'input[data-disable-with]:disabled, button[data-disable-with]:disabled, textarea[data-disable-with]:disabled',

    // Form required input elements
    requiredInputSelector: 'input[name][required]:not([disabled]),textarea[name][required]:not([disabled])',

    // Form file input elements
    fileInputSelector: 'input[type=file]',

    // Link onClick disable selector with possible reenable after remote submission
    linkDisableSelector: 'a[data-disable-with]',

    // Make sure that every Ajax request sends the CSRF token
    CSRFProtection: function(xhr) {
      var token = $('meta[name="csrf-token"]').attr('content');
      if (token) xhr.setRequestHeader('X-CSRF-Token', token);
    },

    // making sure that all forms have actual up-to-date token(cached forms contain old one)
    refreshCSRFTokens: function(){
      var csrfToken = $('meta[name=csrf-token]').attr('content');
      var csrfParam = $('meta[name=csrf-param]').attr('content');
      $('form input[name="' + csrfParam + '"]').val(csrfToken);
    },

    // Triggers an event on an element and returns false if the event result is false
    fire: function(obj, name, data) {
      var event = $.Event(name);
      obj.trigger(event, data);
      return event.result !== false;
    },

    // Default confirm dialog, may be overridden with custom confirm dialog in $.rails.confirm
    confirm: function(message) {
      return confirm(message);
    },

    // Default ajax function, may be overridden with custom function in $.rails.ajax
    ajax: function(options) {
      return $.ajax(options);
    },

    // Default way to get an element's href. May be overridden at $.rails.href.
    href: function(element) {
      return element.attr('href');
    },

    // Submits "remote" forms and links with ajax
    handleRemote: function(element) {
      var method, url, data, elCrossDomain, crossDomain, withCredentials, dataType, options;

      if (rails.fire(element, 'ajax:before')) {
        elCrossDomain = element.data('cross-domain');
        crossDomain = elCrossDomain === undefined ? null : elCrossDomain;
        withCredentials = element.data('with-credentials') || null;
        dataType = element.data('type') || ($.ajaxSettings && $.ajaxSettings.dataType);

        if (element.is('form')) {
          method = element.attr('method');
          url = element.attr('action');
          data = element.serializeArray();
          // memoized value from clicked submit button
          var button = element.data('ujs:submit-button');
          if (button) {
            data.push(button);
            element.data('ujs:submit-button', null);
          }
        } else if (element.is(rails.inputChangeSelector)) {
          method = element.data('method');
          url = element.data('url');
          data = element.serialize();
          if (element.data('params')) data = data + "&" + element.data('params');
        } else if (element.is(rails.buttonClickSelector)) {
          method = element.data('method') || 'get';
          url = element.data('url');
          data = element.serialize();
          if (element.data('params')) data = data + "&" + element.data('params');
        } else {
          method = element.data('method');
          url = rails.href(element);
          data = element.data('params') || null;
        }

        options = {
          type: method || 'GET', data: data, dataType: dataType,
          // stopping the "ajax:beforeSend" event will cancel the ajax request
          beforeSend: function(xhr, settings) {
            if (settings.dataType === undefined) {
              xhr.setRequestHeader('accept', '*/*;q=0.5, ' + settings.accepts.script);
            }
            return rails.fire(element, 'ajax:beforeSend', [xhr, settings]);
          },
          success: function(data, status, xhr) {
            element.trigger('ajax:success', [data, status, xhr]);
          },
          complete: function(xhr, status) {
            element.trigger('ajax:complete', [xhr, status]);
          },
          error: function(xhr, status, error) {
            element.trigger('ajax:error', [xhr, status, error]);
          },
          crossDomain: crossDomain
        };

        // There is no withCredentials for IE6-8 when
        // "Enable native XMLHTTP support" is disabled
        if (withCredentials) {
          options.xhrFields = {
            withCredentials: withCredentials
          };
        }

        // Only pass url to `ajax` options if not blank
        if (url) { options.url = url; }

        var jqxhr = rails.ajax(options);
        element.trigger('ajax:send', jqxhr);
        return jqxhr;
      } else {
        return false;
      }
    },

    // Handles "data-method" on links such as:
    // <a href="/users/5" data-method="delete" rel="nofollow" data-confirm="Are you sure?">Delete</a>
    handleMethod: function(link) {
      var href = rails.href(link),
        method = link.data('method'),
        target = link.attr('target'),
        csrfToken = $('meta[name=csrf-token]').attr('content'),
        csrfParam = $('meta[name=csrf-param]').attr('content'),
        form = $('<form method="post" action="' + href + '"></form>'),
        metadataInput = '<input name="_method" value="' + method + '" type="hidden" />';

      if (csrfParam !== undefined && csrfToken !== undefined) {
        metadataInput += '<input name="' + csrfParam + '" value="' + csrfToken + '" type="hidden" />';
      }

      if (target) { form.attr('target', target); }

      form.hide().append(metadataInput).appendTo('body');
      form.submit();
    },

    /* Disables form elements:
      - Caches element value in 'ujs:enable-with' data store
      - Replaces element text with value of 'data-disable-with' attribute
      - Sets disabled property to true
    */
    disableFormElements: function(form) {
      form.find(rails.disableSelector).each(function() {
        var element = $(this), method = element.is('button') ? 'html' : 'val';
        element.data('ujs:enable-with', element[method]());
        element[method](element.data('disable-with'));
        element.prop('disabled', true);
      });
    },

    /* Re-enables disabled form elements:
      - Replaces element text with cached value from 'ujs:enable-with' data store (created in `disableFormElements`)
      - Sets disabled property to false
    */
    enableFormElements: function(form) {
      form.find(rails.enableSelector).each(function() {
        var element = $(this), method = element.is('button') ? 'html' : 'val';
        if (element.data('ujs:enable-with')) element[method](element.data('ujs:enable-with'));
        element.prop('disabled', false);
      });
    },

   /* For 'data-confirm' attribute:
      - Fires `confirm` event
      - Shows the confirmation dialog
      - Fires the `confirm:complete` event

      Returns `true` if no function stops the chain and user chose yes; `false` otherwise.
      Attaching a handler to the element's `confirm` event that returns a `falsy` value cancels the confirmation dialog.
      Attaching a handler to the element's `confirm:complete` event that returns a `falsy` value makes this function
      return false. The `confirm:complete` event is fired whether or not the user answered true or false to the dialog.
   */
    allowAction: function(element) {
      var message = element.data('confirm'),
          answer = false, callback;
      if (!message) { return true; }

      if (rails.fire(element, 'confirm')) {
        answer = rails.confirm(message);
        callback = rails.fire(element, 'confirm:complete', [answer]);
      }
      return answer && callback;
    },

    // Helper function which checks for blank inputs in a form that match the specified CSS selector
    blankInputs: function(form, specifiedSelector, nonBlank) {
      var inputs = $(), input, valueToCheck,
          selector = specifiedSelector || 'input,textarea',
          allInputs = form.find(selector);

      allInputs.each(function() {
        input = $(this);
        valueToCheck = input.is('input[type=checkbox],input[type=radio]') ? input.is(':checked') : input.val();
        // If nonBlank and valueToCheck are both truthy, or nonBlank and valueToCheck are both falsey
        if (!valueToCheck === !nonBlank) {

          // Don't count unchecked required radio if other radio with same name is checked
          if (input.is('input[type=radio]') && allInputs.filter('input[type=radio]:checked[name="' + input.attr('name') + '"]').length) {
            return true; // Skip to next input
          }

          inputs = inputs.add(input);
        }
      });
      return inputs.length ? inputs : false;
    },

    // Helper function which checks for non-blank inputs in a form that match the specified CSS selector
    nonBlankInputs: function(form, specifiedSelector) {
      return rails.blankInputs(form, specifiedSelector, true); // true specifies nonBlank
    },

    // Helper function, needed to provide consistent behavior in IE
    stopEverything: function(e) {
      $(e.target).trigger('ujs:everythingStopped');
      e.stopImmediatePropagation();
      return false;
    },

    //  replace element's html with the 'data-disable-with' after storing original html
    //  and prevent clicking on it
    disableElement: function(element) {
      element.data('ujs:enable-with', element.html()); // store enabled state
      element.html(element.data('disable-with')); // set to disabled state
      element.bind('click.railsDisable', function(e) { // prevent further clicking
        return rails.stopEverything(e);
      });
    },

    // restore element to its original state which was disabled by 'disableElement' above
    enableElement: function(element) {
      if (element.data('ujs:enable-with') !== undefined) {
        element.html(element.data('ujs:enable-with')); // set to old enabled state
        element.removeData('ujs:enable-with'); // clean up cache
      }
      element.unbind('click.railsDisable'); // enable element
    }

  };

  if (rails.fire($document, 'rails:attachBindings')) {

    $.ajaxPrefilter(function(options, originalOptions, xhr){ if ( !options.crossDomain ) { rails.CSRFProtection(xhr); }});

    $document.delegate(rails.linkDisableSelector, 'ajax:complete', function() {
        rails.enableElement($(this));
    });

    $document.delegate(rails.linkClickSelector, 'click.rails', function(e) {
      var link = $(this), method = link.data('method'), data = link.data('params'), metaClick = e.metaKey || e.ctrlKey;
      if (!rails.allowAction(link)) return rails.stopEverything(e);

      if (!metaClick && link.is(rails.linkDisableSelector)) rails.disableElement(link);

      if (link.data('remote') !== undefined) {
        if (metaClick && (!method || method === 'GET') && !data) { return true; }

        var handleRemote = rails.handleRemote(link);
        // response from rails.handleRemote() will either be false or a deferred object promise.
        if (handleRemote === false) {
          rails.enableElement(link);
        } else {
          handleRemote.error( function() { rails.enableElement(link); } );
        }
        return false;

      } else if (link.data('method')) {
        rails.handleMethod(link);
        return false;
      }
    });

    $document.delegate(rails.buttonClickSelector, 'click.rails', function(e) {
      var button = $(this);
      if (!rails.allowAction(button)) return rails.stopEverything(e);

      rails.handleRemote(button);
      return false;
    });

    $document.delegate(rails.inputChangeSelector, 'change.rails', function(e) {
      var link = $(this);
      if (!rails.allowAction(link)) return rails.stopEverything(e);

      rails.handleRemote(link);
      return false;
    });

    $document.delegate(rails.formSubmitSelector, 'submit.rails', function(e) {
      var form = $(this),
        remote = form.data('remote') !== undefined,
        blankRequiredInputs = rails.blankInputs(form, rails.requiredInputSelector),
        nonBlankFileInputs = rails.nonBlankInputs(form, rails.fileInputSelector);

      if (!rails.allowAction(form)) return rails.stopEverything(e);

      // skip other logic when required values are missing or file upload is present
      if (blankRequiredInputs && form.attr("novalidate") == undefined && rails.fire(form, 'ajax:aborted:required', [blankRequiredInputs])) {
        return rails.stopEverything(e);
      }

      if (remote) {
        if (nonBlankFileInputs) {
          // slight timeout so that the submit button gets properly serialized
          // (make it easy for event handler to serialize form without disabled values)
          setTimeout(function(){ rails.disableFormElements(form); }, 13);
          var aborted = rails.fire(form, 'ajax:aborted:file', [nonBlankFileInputs]);

          // re-enable form elements if event bindings return false (canceling normal form submission)
          if (!aborted) { setTimeout(function(){ rails.enableFormElements(form); }, 13); }

          return aborted;
        }

        rails.handleRemote(form);
        return false;

      } else {
        // slight timeout so that the submit button gets properly serialized
        setTimeout(function(){ rails.disableFormElements(form); }, 13);
      }
    });

    $document.delegate(rails.formInputClickSelector, 'click.rails', function(event) {
      var button = $(this);

      if (!rails.allowAction(button)) return rails.stopEverything(event);

      // register the pressed submit button
      var name = button.attr('name'),
        data = name ? {name:name, value:button.val()} : null;

      button.closest('form').data('ujs:submit-button', data);
    });

    $document.delegate(rails.formSubmitSelector, 'ajax:beforeSend.rails', function(event) {
      if (this == event.target) rails.disableFormElements($(this));
    });

    $document.delegate(rails.formSubmitSelector, 'ajax:complete.rails', function(event) {
      if (this == event.target) rails.enableFormElements($(this));
    });

    $(function(){
      rails.refreshCSRFTokens();
    });
  }

})( jQuery );
(function() {
  var CSRFToken, Click, ComponentUrl, Link, browserCompatibleDocumentParser, browserIsntBuggy, browserSupportsCustomEvents, browserSupportsPushState, browserSupportsTurbolinks, bypassOnLoadPopstate, cacheCurrentPage, cacheSize, changePage, constrainPageCacheTo, createDocument, currentState, enableTransitionCache, executeScriptTags, extractTitleAndBody, fetch, fetchHistory, fetchReplacement, historyStateIsDefined, initializeTurbolinks, installDocumentReadyPageEventTriggers, installHistoryChangeHandler, installJqueryAjaxSuccessPageUpdateTrigger, loadedAssets, pageCache, pageChangePrevented, pagesCached, popCookie, processResponse, recallScrollPosition, referer, reflectNewUrl, reflectRedirectedUrl, rememberCurrentState, rememberCurrentUrl, rememberReferer, removeNoscriptTags, requestMethodIsSafe, resetScrollPosition, transitionCacheEnabled, transitionCacheFor, triggerEvent, visit, xhr, _ref,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  pageCache = {};

  cacheSize = 10;

  transitionCacheEnabled = false;

  currentState = null;

  loadedAssets = null;

  referer = null;

  createDocument = null;

  xhr = null;

  fetch = function(url) {
    var cachedPage;
    url = new ComponentUrl(url);
    rememberReferer();
    cacheCurrentPage();
    reflectNewUrl(url);
    if (transitionCacheEnabled && (cachedPage = transitionCacheFor(url.absolute))) {
      fetchHistory(cachedPage);
      return fetchReplacement(url);
    } else {
      return fetchReplacement(url, resetScrollPosition);
    }
  };

  transitionCacheFor = function(url) {
    var cachedPage;
    cachedPage = pageCache[url];
    if (cachedPage && !cachedPage.transitionCacheDisabled) {
      return cachedPage;
    }
  };

  enableTransitionCache = function(enable) {
    if (enable == null) {
      enable = true;
    }
    return transitionCacheEnabled = enable;
  };

  fetchReplacement = function(url, onLoadFunction) {
    if (onLoadFunction == null) {
      onLoadFunction = (function(_this) {
        return function() {};
      })(this);
    }
    triggerEvent('page:fetch', {
      url: url.absolute
    });
    if (xhr != null) {
      xhr.abort();
    }
    xhr = new XMLHttpRequest;
    xhr.open('GET', url.withoutHashForIE10compatibility(), true);
    xhr.setRequestHeader('Accept', 'text/html, application/xhtml+xml, application/xml');
    xhr.setRequestHeader('X-XHR-Referer', referer);
    xhr.onload = function() {
      var doc;
      triggerEvent('page:receive');
      if (doc = processResponse()) {
        changePage.apply(null, extractTitleAndBody(doc));
        reflectRedirectedUrl();
        onLoadFunction();
        return triggerEvent('page:load');
      } else {
        return document.location.href = url.absolute;
      }
    };
    xhr.onloadend = function() {
      return xhr = null;
    };
    xhr.onerror = function() {
      return document.location.href = url.absolute;
    };
    return xhr.send();
  };

  fetchHistory = function(cachedPage) {
    if (xhr != null) {
      xhr.abort();
    }
    changePage(cachedPage.title, cachedPage.body);
    recallScrollPosition(cachedPage);
    return triggerEvent('page:restore');
  };

  cacheCurrentPage = function() {
    var currentStateUrl;
    currentStateUrl = new ComponentUrl(currentState.url);
    pageCache[currentStateUrl.absolute] = {
      url: currentStateUrl.relative,
      body: document.body,
      title: document.title,
      positionY: window.pageYOffset,
      positionX: window.pageXOffset,
      cachedAt: new Date().getTime(),
      transitionCacheDisabled: document.querySelector('[data-no-transition-cache]') != null
    };
    return constrainPageCacheTo(cacheSize);
  };

  pagesCached = function(size) {
    if (size == null) {
      size = cacheSize;
    }
    if (/^[\d]+$/.test(size)) {
      return cacheSize = parseInt(size);
    }
  };

  constrainPageCacheTo = function(limit) {
    var cacheTimesRecentFirst, key, pageCacheKeys, _i, _len, _results;
    pageCacheKeys = Object.keys(pageCache);
    cacheTimesRecentFirst = pageCacheKeys.map(function(url) {
      return pageCache[url].cachedAt;
    }).sort(function(a, b) {
      return b - a;
    });
    _results = [];
    for (_i = 0, _len = pageCacheKeys.length; _i < _len; _i++) {
      key = pageCacheKeys[_i];
      if (!(pageCache[key].cachedAt <= cacheTimesRecentFirst[limit])) {
        continue;
      }
      triggerEvent('page:expire', pageCache[key]);
      _results.push(delete pageCache[key]);
    }
    return _results;
  };

  changePage = function(title, body, csrfToken, runScripts) {
    document.title = title;
    document.documentElement.replaceChild(body, document.body);
    if (csrfToken != null) {
      CSRFToken.update(csrfToken);
    }
    if (runScripts) {
      executeScriptTags();
    }
    currentState = window.history.state;
    triggerEvent('page:change');
    return triggerEvent('page:update');
  };

  executeScriptTags = function() {
    var attr, copy, nextSibling, parentNode, script, scripts, _i, _j, _len, _len1, _ref, _ref1;
    scripts = Array.prototype.slice.call(document.body.querySelectorAll('script:not([data-turbolinks-eval="false"])'));
    for (_i = 0, _len = scripts.length; _i < _len; _i++) {
      script = scripts[_i];
      if (!((_ref = script.type) === '' || _ref === 'text/javascript')) {
        continue;
      }
      copy = document.createElement('script');
      _ref1 = script.attributes;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        attr = _ref1[_j];
        copy.setAttribute(attr.name, attr.value);
      }
      copy.appendChild(document.createTextNode(script.innerHTML));
      parentNode = script.parentNode, nextSibling = script.nextSibling;
      parentNode.removeChild(script);
      parentNode.insertBefore(copy, nextSibling);
    }
  };

  removeNoscriptTags = function(node) {
    node.innerHTML = node.innerHTML.replace(/<noscript[\S\s]*?<\/noscript>/ig, '');
    return node;
  };

  reflectNewUrl = function(url) {
    if ((url = new ComponentUrl(url)).absolute !== referer) {
      return window.history.pushState({
        turbolinks: true,
        url: url.absolute
      }, '', url.absolute);
    }
  };

  reflectRedirectedUrl = function() {
    var location, preservedHash;
    if (location = xhr.getResponseHeader('X-XHR-Redirected-To')) {
      location = new ComponentUrl(location);
      preservedHash = location.hasNoHash() ? document.location.hash : '';
      return window.history.replaceState(currentState, '', location.href + preservedHash);
    }
  };

  rememberReferer = function() {
    return referer = document.location.href;
  };

  rememberCurrentUrl = function() {
    return window.history.replaceState({
      turbolinks: true,
      url: document.location.href
    }, '', document.location.href);
  };

  rememberCurrentState = function() {
    return currentState = window.history.state;
  };

  recallScrollPosition = function(page) {
    return window.scrollTo(page.positionX, page.positionY);
  };

  resetScrollPosition = function() {
    var element;
    if (element = document.location.hash && document.getElementById(document.location.hash.replace('#', ''))) {
      return element.scrollIntoView();
    } else {
      return window.scrollTo(0, 0);
    }
  };

  popCookie = function(name) {
    var value, _ref;
    value = ((_ref = document.cookie.match(new RegExp(name + "=(\\w+)"))) != null ? _ref[1].toUpperCase() : void 0) || '';
    document.cookie = name + '=; expires=Thu, 01-Jan-70 00:00:01 GMT; path=/';
    return value;
  };

  triggerEvent = function(name, data) {
    var event;
    event = document.createEvent('Events');
    if (data) {
      event.data = data;
    }
    event.initEvent(name, true, true);
    return document.dispatchEvent(event);
  };

  pageChangePrevented = function() {
    return !triggerEvent('page:before-change');
  };

  processResponse = function() {
    var assetsChanged, clientOrServerError, doc, extractTrackAssets, intersection, validContent;
    clientOrServerError = function() {
      var _ref;
      return (400 <= (_ref = xhr.status) && _ref < 600);
    };
    validContent = function() {
      return xhr.getResponseHeader('Content-Type').match(/^(?:text\/html|application\/xhtml\+xml|application\/xml)(?:;|$)/);
    };
    extractTrackAssets = function(doc) {
      var node, _i, _len, _ref, _results;
      _ref = doc.head.childNodes;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        node = _ref[_i];
        if ((typeof node.getAttribute === "function" ? node.getAttribute('data-turbolinks-track') : void 0) != null) {
          _results.push(node.getAttribute('src') || node.getAttribute('href'));
        }
      }
      return _results;
    };
    assetsChanged = function(doc) {
      var fetchedAssets;
      loadedAssets || (loadedAssets = extractTrackAssets(document));
      fetchedAssets = extractTrackAssets(doc);
      return fetchedAssets.length !== loadedAssets.length || intersection(fetchedAssets, loadedAssets).length !== loadedAssets.length;
    };
    intersection = function(a, b) {
      var value, _i, _len, _ref, _results;
      if (a.length > b.length) {
        _ref = [b, a], a = _ref[0], b = _ref[1];
      }
      _results = [];
      for (_i = 0, _len = a.length; _i < _len; _i++) {
        value = a[_i];
        if (__indexOf.call(b, value) >= 0) {
          _results.push(value);
        }
      }
      return _results;
    };
    if (!clientOrServerError() && validContent()) {
      doc = createDocument(xhr.responseText);
      if (doc && !assetsChanged(doc)) {
        return doc;
      }
    }
  };

  extractTitleAndBody = function(doc) {
    var title;
    title = doc.querySelector('title');
    return [title != null ? title.textContent : void 0, removeNoscriptTags(doc.body), CSRFToken.get(doc).token, 'runScripts'];
  };

  CSRFToken = {
    get: function(doc) {
      var tag;
      if (doc == null) {
        doc = document;
      }
      return {
        node: tag = doc.querySelector('meta[name="csrf-token"]'),
        token: tag != null ? typeof tag.getAttribute === "function" ? tag.getAttribute('content') : void 0 : void 0
      };
    },
    update: function(latest) {
      var current;
      current = this.get();
      if ((current.token != null) && (latest != null) && current.token !== latest) {
        return current.node.setAttribute('content', latest);
      }
    }
  };

  browserCompatibleDocumentParser = function() {
    var createDocumentUsingDOM, createDocumentUsingParser, createDocumentUsingWrite, e, testDoc, _ref;
    createDocumentUsingParser = function(html) {
      return (new DOMParser).parseFromString(html, 'text/html');
    };
    createDocumentUsingDOM = function(html) {
      var doc;
      doc = document.implementation.createHTMLDocument('');
      doc.documentElement.innerHTML = html;
      return doc;
    };
    createDocumentUsingWrite = function(html) {
      var doc;
      doc = document.implementation.createHTMLDocument('');
      doc.open('replace');
      doc.write(html);
      doc.close();
      return doc;
    };
    try {
      if (window.DOMParser) {
        testDoc = createDocumentUsingParser('<html><body><p>test');
        return createDocumentUsingParser;
      }
    } catch (_error) {
      e = _error;
      testDoc = createDocumentUsingDOM('<html><body><p>test');
      return createDocumentUsingDOM;
    } finally {
      if ((testDoc != null ? (_ref = testDoc.body) != null ? _ref.childNodes.length : void 0 : void 0) !== 1) {
        return createDocumentUsingWrite;
      }
    }
  };

  ComponentUrl = (function() {
    function ComponentUrl(original) {
      this.original = original != null ? original : document.location.href;
      if (this.original.constructor === ComponentUrl) {
        return this.original;
      }
      this._parse();
    }

    ComponentUrl.prototype.withoutHash = function() {
      return this.href.replace(this.hash, '');
    };

    ComponentUrl.prototype.withoutHashForIE10compatibility = function() {
      return this.withoutHash();
    };

    ComponentUrl.prototype.hasNoHash = function() {
      return this.hash.length === 0;
    };

    ComponentUrl.prototype._parse = function() {
      var _ref;
      (this.link != null ? this.link : this.link = document.createElement('a')).href = this.original;
      _ref = this.link, this.href = _ref.href, this.protocol = _ref.protocol, this.host = _ref.host, this.hostname = _ref.hostname, this.port = _ref.port, this.pathname = _ref.pathname, this.search = _ref.search, this.hash = _ref.hash;
      this.origin = [this.protocol, '//', this.hostname].join('');
      if (this.port.length !== 0) {
        this.origin += ":" + this.port;
      }
      this.relative = [this.pathname, this.search, this.hash].join('');
      return this.absolute = this.href;
    };

    return ComponentUrl;

  })();

  Link = (function(_super) {
    __extends(Link, _super);

    Link.HTML_EXTENSIONS = ['html'];

    Link.allowExtensions = function() {
      var extension, extensions, _i, _len;
      extensions = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      for (_i = 0, _len = extensions.length; _i < _len; _i++) {
        extension = extensions[_i];
        Link.HTML_EXTENSIONS.push(extension);
      }
      return Link.HTML_EXTENSIONS;
    };

    function Link(link) {
      this.link = link;
      if (this.link.constructor === Link) {
        return this.link;
      }
      this.original = this.link.href;
      Link.__super__.constructor.apply(this, arguments);
    }

    Link.prototype.shouldIgnore = function() {
      return this._crossOrigin() || this._anchored() || this._nonHtml() || this._optOut() || this._target();
    };

    Link.prototype._crossOrigin = function() {
      return this.origin !== (new ComponentUrl).origin;
    };

    Link.prototype._anchored = function() {
      var current;
      return ((this.hash && this.withoutHash()) === (current = new ComponentUrl).withoutHash()) || (this.href === current.href + '#');
    };

    Link.prototype._nonHtml = function() {
      return this.pathname.match(/\.[a-z]+$/g) && !this.pathname.match(new RegExp("\\.(?:" + (Link.HTML_EXTENSIONS.join('|')) + ")?$", 'g'));
    };

    Link.prototype._optOut = function() {
      var ignore, link;
      link = this.link;
      while (!(ignore || link === document)) {
        ignore = link.getAttribute('data-no-turbolink') != null;
        link = link.parentNode;
      }
      return ignore;
    };

    Link.prototype._target = function() {
      return this.link.target.length !== 0;
    };

    return Link;

  })(ComponentUrl);

  Click = (function() {
    Click.installHandlerLast = function(event) {
      if (!event.defaultPrevented) {
        document.removeEventListener('click', Click.handle, false);
        return document.addEventListener('click', Click.handle, false);
      }
    };

    Click.handle = function(event) {
      return new Click(event);
    };

    function Click(event) {
      this.event = event;
      if (this.event.defaultPrevented) {
        return;
      }
      this._extractLink();
      if (this._validForTurbolinks()) {
        if (!pageChangePrevented()) {
          visit(this.link.href);
        }
        this.event.preventDefault();
      }
    }

    Click.prototype._extractLink = function() {
      var link;
      link = this.event.target;
      while (!(!link.parentNode || link.nodeName === 'A')) {
        link = link.parentNode;
      }
      if (link.nodeName === 'A' && link.href.length !== 0) {
        return this.link = new Link(link);
      }
    };

    Click.prototype._validForTurbolinks = function() {
      return (this.link != null) && !(this.link.shouldIgnore() || this._nonStandardClick());
    };

    Click.prototype._nonStandardClick = function() {
      return this.event.which > 1 || this.event.metaKey || this.event.ctrlKey || this.event.shiftKey || this.event.altKey;
    };

    return Click;

  })();

  bypassOnLoadPopstate = function(fn) {
    return setTimeout(fn, 500);
  };

  installDocumentReadyPageEventTriggers = function() {
    return document.addEventListener('DOMContentLoaded', (function() {
      triggerEvent('page:change');
      return triggerEvent('page:update');
    }), true);
  };

  installJqueryAjaxSuccessPageUpdateTrigger = function() {
    if (typeof jQuery !== 'undefined') {
      return jQuery(document).on('ajaxSuccess', function(event, xhr, settings) {
        if (!jQuery.trim(xhr.responseText)) {
          return;
        }
        return triggerEvent('page:update');
      });
    }
  };

  installHistoryChangeHandler = function(event) {
    var cachedPage, _ref;
    if ((_ref = event.state) != null ? _ref.turbolinks : void 0) {
      if (cachedPage = pageCache[(new ComponentUrl(event.state.url)).absolute]) {
        cacheCurrentPage();
        return fetchHistory(cachedPage);
      } else {
        return visit(event.target.location.href);
      }
    }
  };

  initializeTurbolinks = function() {
    rememberCurrentUrl();
    rememberCurrentState();
    createDocument = browserCompatibleDocumentParser();
    document.addEventListener('click', Click.installHandlerLast, true);
    return bypassOnLoadPopstate(function() {
      return window.addEventListener('popstate', installHistoryChangeHandler, false);
    });
  };

  historyStateIsDefined = window.history.state !== void 0 || navigator.userAgent.match(/Firefox\/2[6|7]/);

  browserSupportsPushState = window.history && window.history.pushState && window.history.replaceState && historyStateIsDefined;

  browserIsntBuggy = !navigator.userAgent.match(/CriOS\//);

  requestMethodIsSafe = (_ref = popCookie('request_method')) === 'GET' || _ref === '';

  browserSupportsTurbolinks = browserSupportsPushState && browserIsntBuggy && requestMethodIsSafe;

  browserSupportsCustomEvents = document.addEventListener && document.createEvent;

  if (browserSupportsCustomEvents) {
    installDocumentReadyPageEventTriggers();
    installJqueryAjaxSuccessPageUpdateTrigger();
  }

  if (browserSupportsTurbolinks) {
    visit = fetch;
    initializeTurbolinks();
  } else {
    visit = function(url) {
      return document.location.href = url;
    };
  }

  this.Turbolinks = {
    visit: visit,
    pagesCached: pagesCached,
    enableTransitionCache: enableTransitionCache,
    allowLinkExtensions: Link.allowExtensions,
    supported: browserSupportsTurbolinks
  };

}).call(this);
/* ========================================================================
 * Bootstrap: affix.js v3.1.1
 * http://getbootstrap.com/javascript/#affix
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */



+function ($) {
  'use strict';

  // AFFIX CLASS DEFINITION
  // ======================

  var Affix = function (element, options) {
    this.options = $.extend({}, Affix.DEFAULTS, options)
    this.$window = $(window)
      .on('scroll.bs.affix.data-api', $.proxy(this.checkPosition, this))
      .on('click.bs.affix.data-api',  $.proxy(this.checkPositionWithEventLoop, this))

    this.$element     = $(element)
    this.affixed      =
    this.unpin        =
    this.pinnedOffset = null

    this.checkPosition()
  }

  Affix.RESET = 'affix affix-top affix-bottom'

  Affix.DEFAULTS = {
    offset: 0
  }

  Affix.prototype.getPinnedOffset = function () {
    if (this.pinnedOffset) return this.pinnedOffset
    this.$element.removeClass(Affix.RESET).addClass('affix')
    var scrollTop = this.$window.scrollTop()
    var position  = this.$element.offset()
    return (this.pinnedOffset = position.top - scrollTop)
  }

  Affix.prototype.checkPositionWithEventLoop = function () {
    setTimeout($.proxy(this.checkPosition, this), 1)
  }

  Affix.prototype.checkPosition = function () {
    if (!this.$element.is(':visible')) return

    var scrollHeight = $(document).height()
    var scrollTop    = this.$window.scrollTop()
    var position     = this.$element.offset()
    var offset       = this.options.offset
    var offsetTop    = offset.top
    var offsetBottom = offset.bottom

    if (typeof offset != 'object')         offsetBottom = offsetTop = offset
    if (typeof offsetTop == 'function')    offsetTop    = offset.top(this.$element)
    if (typeof offsetBottom == 'function') offsetBottom = offset.bottom(this.$element)

    var affix = this.unpin   != null && (scrollTop + this.unpin <= position.top) ? false :
                offsetBottom != null && (position.top + this.$element.height() >= scrollHeight - offsetBottom) ? 'bottom' :
                offsetTop    != null && (scrollTop <= offsetTop) ? 'top' : false

    if (this.affixed === affix) return
    if (this.unpin != null) this.$element.css('top', '')

    var affixType = 'affix' + (affix ? '-' + affix : '')
    var e         = $.Event(affixType + '.bs.affix')

    this.$element.trigger(e)

    if (e.isDefaultPrevented()) return

    this.affixed = affix
    this.unpin = affix == 'bottom' ? this.getPinnedOffset() : null

    this.$element
      .removeClass(Affix.RESET)
      .addClass(affixType)
      .trigger($.Event(affixType.replace('affix', 'affixed')))

    if (affix == 'bottom') {
      this.$element.offset({ top: position.top })
    }
  }


  // AFFIX PLUGIN DEFINITION
  // =======================

  var old = $.fn.affix

  $.fn.affix = function (option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.affix')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.affix', (data = new Affix(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  $.fn.affix.Constructor = Affix


  // AFFIX NO CONFLICT
  // =================

  $.fn.affix.noConflict = function () {
    $.fn.affix = old
    return this
  }


  // AFFIX DATA-API
  // ==============

  $(window).on('load', function () {
    $('[data-spy="affix"]').each(function () {
      var $spy = $(this)
      var data = $spy.data()

      data.offset = data.offset || {}

      if (data.offsetBottom) data.offset.bottom = data.offsetBottom
      if (data.offsetTop)    data.offset.top    = data.offsetTop

      $spy.affix(data)
    })
  })

}(jQuery);
/* ========================================================================
 * Bootstrap: alert.js v3.1.1
 * http://getbootstrap.com/javascript/#alerts
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */



+function ($) {
  'use strict';

  // ALERT CLASS DEFINITION
  // ======================

  var dismiss = '[data-dismiss="alert"]'
  var Alert   = function (el) {
    $(el).on('click', dismiss, this.close)
  }

  Alert.prototype.close = function (e) {
    var $this    = $(this)
    var selector = $this.attr('data-target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    var $parent = $(selector)

    if (e) e.preventDefault()

    if (!$parent.length) {
      $parent = $this.hasClass('alert') ? $this : $this.parent()
    }

    $parent.trigger(e = $.Event('close.bs.alert'))

    if (e.isDefaultPrevented()) return

    $parent.removeClass('in')

    function removeElement() {
      $parent.trigger('closed.bs.alert').remove()
    }

    $.support.transition && $parent.hasClass('fade') ?
      $parent
        .one($.support.transition.end, removeElement)
        .emulateTransitionEnd(150) :
      removeElement()
  }


  // ALERT PLUGIN DEFINITION
  // =======================

  var old = $.fn.alert

  $.fn.alert = function (option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.alert')

      if (!data) $this.data('bs.alert', (data = new Alert(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  $.fn.alert.Constructor = Alert


  // ALERT NO CONFLICT
  // =================

  $.fn.alert.noConflict = function () {
    $.fn.alert = old
    return this
  }


  // ALERT DATA-API
  // ==============

  $(document).on('click.bs.alert.data-api', dismiss, Alert.prototype.close)

}(jQuery);
/* ========================================================================
 * Bootstrap: button.js v3.1.1
 * http://getbootstrap.com/javascript/#buttons
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */



+function ($) {
  'use strict';

  // BUTTON PUBLIC CLASS DEFINITION
  // ==============================

  var Button = function (element, options) {
    this.$element  = $(element)
    this.options   = $.extend({}, Button.DEFAULTS, options)
    this.isLoading = false
  }

  Button.DEFAULTS = {
    loadingText: 'loading...'
  }

  Button.prototype.setState = function (state) {
    var d    = 'disabled'
    var $el  = this.$element
    var val  = $el.is('input') ? 'val' : 'html'
    var data = $el.data()

    state = state + 'Text'

    if (!data.resetText) $el.data('resetText', $el[val]())

    $el[val](data[state] || this.options[state])

    // push to event loop to allow forms to submit
    setTimeout($.proxy(function () {
      if (state == 'loadingText') {
        this.isLoading = true
        $el.addClass(d).attr(d, d)
      } else if (this.isLoading) {
        this.isLoading = false
        $el.removeClass(d).removeAttr(d)
      }
    }, this), 0)
  }

  Button.prototype.toggle = function () {
    var changed = true
    var $parent = this.$element.closest('[data-toggle="buttons"]')

    if ($parent.length) {
      var $input = this.$element.find('input')
      if ($input.prop('type') == 'radio') {
        if ($input.prop('checked') && this.$element.hasClass('active')) changed = false
        else $parent.find('.active').removeClass('active')
      }
      if (changed) $input.prop('checked', !this.$element.hasClass('active')).trigger('change')
    }

    if (changed) this.$element.toggleClass('active')
  }


  // BUTTON PLUGIN DEFINITION
  // ========================

  var old = $.fn.button

  $.fn.button = function (option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.button')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.button', (data = new Button(this, options)))

      if (option == 'toggle') data.toggle()
      else if (option) data.setState(option)
    })
  }

  $.fn.button.Constructor = Button


  // BUTTON NO CONFLICT
  // ==================

  $.fn.button.noConflict = function () {
    $.fn.button = old
    return this
  }


  // BUTTON DATA-API
  // ===============

  $(document).on('click.bs.button.data-api', '[data-toggle^=button]', function (e) {
    var $btn = $(e.target)
    if (!$btn.hasClass('btn')) $btn = $btn.closest('.btn')
    $btn.button('toggle')
    e.preventDefault()
  })

}(jQuery);
/* ========================================================================
 * Bootstrap: carousel.js v3.1.1
 * http://getbootstrap.com/javascript/#carousel
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */



+function ($) {
  'use strict';

  // CAROUSEL CLASS DEFINITION
  // =========================

  var Carousel = function (element, options) {
    this.$element    = $(element)
    this.$indicators = this.$element.find('.carousel-indicators')
    this.options     = options
    this.paused      =
    this.sliding     =
    this.interval    =
    this.$active     =
    this.$items      = null

    this.options.pause == 'hover' && this.$element
      .on('mouseenter', $.proxy(this.pause, this))
      .on('mouseleave', $.proxy(this.cycle, this))
  }

  Carousel.DEFAULTS = {
    interval: 5000,
    pause: 'hover',
    wrap: true
  }

  Carousel.prototype.cycle =  function (e) {
    e || (this.paused = false)

    this.interval && clearInterval(this.interval)

    this.options.interval
      && !this.paused
      && (this.interval = setInterval($.proxy(this.next, this), this.options.interval))

    return this
  }

  Carousel.prototype.getActiveIndex = function () {
    this.$active = this.$element.find('.item.active')
    this.$items  = this.$active.parent().children('.item')

    return this.$items.index(this.$active)
  }

  Carousel.prototype.to = function (pos) {
    var that        = this
    var activeIndex = this.getActiveIndex()

    if (pos > (this.$items.length - 1) || pos < 0) return

    if (this.sliding)       return this.$element.one('slid.bs.carousel', function () { that.to(pos) }) // yes, "slid". not a typo. past tense of "to slide".
    if (activeIndex == pos) return this.pause().cycle()

    return this.slide(pos > activeIndex ? 'next' : 'prev', $(this.$items[pos]))
  }

  Carousel.prototype.pause = function (e) {
    e || (this.paused = true)

    if (this.$element.find('.next, .prev').length && $.support.transition) {
      this.$element.trigger($.support.transition.end)
      this.cycle(true)
    }

    this.interval = clearInterval(this.interval)

    return this
  }

  Carousel.prototype.next = function () {
    if (this.sliding) return
    return this.slide('next')
  }

  Carousel.prototype.prev = function () {
    if (this.sliding) return
    return this.slide('prev')
  }

  Carousel.prototype.slide = function (type, next) {
    var $active   = this.$element.find('.item.active')
    var $next     = next || $active[type]()
    var isCycling = this.interval
    var direction = type == 'next' ? 'left' : 'right'
    var fallback  = type == 'next' ? 'first' : 'last'
    var that      = this

    if (!$next.length) {
      if (!this.options.wrap) return
      $next = this.$element.find('.item')[fallback]()
    }

    if ($next.hasClass('active')) return this.sliding = false

    var e = $.Event('slide.bs.carousel', { relatedTarget: $next[0], direction: direction })
    this.$element.trigger(e)
    if (e.isDefaultPrevented()) return

    this.sliding = true

    isCycling && this.pause()

    if (this.$indicators.length) {
      this.$indicators.find('.active').removeClass('active')
      this.$element.one('slid.bs.carousel', function () { // yes, "slid". not a typo. past tense of "to slide".
        var $nextIndicator = $(that.$indicators.children()[that.getActiveIndex()])
        $nextIndicator && $nextIndicator.addClass('active')
      })
    }

    if ($.support.transition && this.$element.hasClass('slide')) {
      $next.addClass(type)
      $next[0].offsetWidth // force reflow
      $active.addClass(direction)
      $next.addClass(direction)
      $active
        .one($.support.transition.end, function () {
          $next.removeClass([type, direction].join(' ')).addClass('active')
          $active.removeClass(['active', direction].join(' '))
          that.sliding = false
          setTimeout(function () { that.$element.trigger('slid.bs.carousel') }, 0) // yes, "slid". not a typo. past tense of "to slide".
        })
        .emulateTransitionEnd($active.css('transition-duration').slice(0, -1) * 1000)
    } else {
      $active.removeClass('active')
      $next.addClass('active')
      this.sliding = false
      this.$element.trigger('slid.bs.carousel') // yes, "slid". not a typo. past tense of "to slide".
    }

    isCycling && this.cycle()

    return this
  }


  // CAROUSEL PLUGIN DEFINITION
  // ==========================

  var old = $.fn.carousel

  $.fn.carousel = function (option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.carousel')
      var options = $.extend({}, Carousel.DEFAULTS, $this.data(), typeof option == 'object' && option)
      var action  = typeof option == 'string' ? option : options.slide

      if (!data) $this.data('bs.carousel', (data = new Carousel(this, options)))
      if (typeof option == 'number') data.to(option)
      else if (action) data[action]()
      else if (options.interval) data.pause().cycle()
    })
  }

  $.fn.carousel.Constructor = Carousel


  // CAROUSEL NO CONFLICT
  // ====================

  $.fn.carousel.noConflict = function () {
    $.fn.carousel = old
    return this
  }


  // CAROUSEL DATA-API
  // =================

  $(document).on('click.bs.carousel.data-api', '[data-slide], [data-slide-to]', function (e) {
    var $this   = $(this), href
    var $target = $($this.attr('data-target') || (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '')) //strip for ie7
    var options = $.extend({}, $target.data(), $this.data())
    var slideIndex = $this.attr('data-slide-to')
    if (slideIndex) options.interval = false

    $target.carousel(options)

    if (slideIndex = $this.attr('data-slide-to')) {
      $target.data('bs.carousel').to(slideIndex)
    }

    e.preventDefault()
  })

  $(window).on('load', function () {
    $('[data-ride="carousel"]').each(function () {
      var $carousel = $(this)
      $carousel.carousel($carousel.data())
    })
  })

}(jQuery);
/* ========================================================================
 * Bootstrap: collapse.js v3.1.1
 * http://getbootstrap.com/javascript/#collapse
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */



+function ($) {
  'use strict';

  // COLLAPSE PUBLIC CLASS DEFINITION
  // ================================

  var Collapse = function (element, options) {
    this.$element      = $(element)
    this.options       = $.extend({}, Collapse.DEFAULTS, options)
    this.transitioning = null

    if (this.options.parent) this.$parent = $(this.options.parent)
    if (this.options.toggle) this.toggle()
  }

  Collapse.DEFAULTS = {
    toggle: true
  }

  Collapse.prototype.dimension = function () {
    var hasWidth = this.$element.hasClass('width')
    return hasWidth ? 'width' : 'height'
  }

  Collapse.prototype.show = function () {
    if (this.transitioning || this.$element.hasClass('in')) return

    var startEvent = $.Event('show.bs.collapse')
    this.$element.trigger(startEvent)
    if (startEvent.isDefaultPrevented()) return

    var actives = this.$parent && this.$parent.find('> .panel > .in')

    if (actives && actives.length) {
      var hasData = actives.data('bs.collapse')
      if (hasData && hasData.transitioning) return
      actives.collapse('hide')
      hasData || actives.data('bs.collapse', null)
    }

    var dimension = this.dimension()

    this.$element
      .removeClass('collapse')
      .addClass('collapsing')[dimension](0)

    this.transitioning = 1

    var complete = function (e) {
      if (e && e.target != this.$element[0]) {
        this.$element
          .one($.support.transition.end, $.proxy(complete, this))
        return
      }
      this.$element
        .removeClass('collapsing')
        .addClass('collapse in')[dimension]('auto')
      this.transitioning = 0
      this.$element.trigger('shown.bs.collapse')
    }

    if (!$.support.transition) return complete.call(this)

    var scrollSize = $.camelCase(['scroll', dimension].join('-'))

    this.$element
      .one($.support.transition.end, $.proxy(complete, this))
      .emulateTransitionEnd(350)[dimension](this.$element[0][scrollSize])
  }

  Collapse.prototype.hide = function () {
    if (this.transitioning || !this.$element.hasClass('in')) return

    var startEvent = $.Event('hide.bs.collapse')
    this.$element.trigger(startEvent)
    if (startEvent.isDefaultPrevented()) return

    var dimension = this.dimension()

    this.$element[dimension](this.$element[dimension]())[0].offsetHeight

    this.$element
      .addClass('collapsing')
      .removeClass('collapse')
      .removeClass('in')

    this.transitioning = 1

    var complete = function (e) {
      if (e && e.target != this.$element[0]) {
        this.$element
          .one($.support.transition.end, $.proxy(complete, this))
        return
      }
      this.transitioning = 0
      this.$element
        .trigger('hidden.bs.collapse')
        .removeClass('collapsing')
        .addClass('collapse')
    }

    if (!$.support.transition) return complete.call(this)

    this.$element
      [dimension](0)
      .one($.support.transition.end, $.proxy(complete, this))
      .emulateTransitionEnd(350)
  }

  Collapse.prototype.toggle = function () {
    this[this.$element.hasClass('in') ? 'hide' : 'show']()
  }


  // COLLAPSE PLUGIN DEFINITION
  // ==========================

  var old = $.fn.collapse

  $.fn.collapse = function (option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.collapse')
      var options = $.extend({}, Collapse.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data && options.toggle && option == 'show') option = !option
      if (!data) $this.data('bs.collapse', (data = new Collapse(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  $.fn.collapse.Constructor = Collapse


  // COLLAPSE NO CONFLICT
  // ====================

  $.fn.collapse.noConflict = function () {
    $.fn.collapse = old
    return this
  }


  // COLLAPSE DATA-API
  // =================

  $(document).on('click.bs.collapse.data-api', '[data-toggle="collapse"]', function (e) {
    var $this   = $(this), href
    var target  = $this.attr('data-target')
        || e.preventDefault()
        || (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '') //strip for ie7
    var $target = $(target)
    var data    = $target.data('bs.collapse')
    var option  = data ? 'toggle' : $this.data()
    var parent  = $this.attr('data-parent')
    var $parent = parent && $(parent)

    if (!data || !data.transitioning) {
      if ($parent) $parent.find('[data-toggle="collapse"][data-parent="' + parent + '"]').not($this).addClass('collapsed')
      $this[$target.hasClass('in') ? 'addClass' : 'removeClass']('collapsed')
    }

    $target.collapse(option)
  })

}(jQuery);
/* ========================================================================
 * Bootstrap: dropdown.js v3.1.1
 * http://getbootstrap.com/javascript/#dropdowns
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */



+function ($) {
  'use strict';

  // DROPDOWN CLASS DEFINITION
  // =========================

  var backdrop = '.dropdown-backdrop'
  var toggle   = '[data-toggle="dropdown"]'
  var Dropdown = function (element) {
    $(element).on('click.bs.dropdown', this.toggle)
  }

  Dropdown.prototype.toggle = function (e) {
    var $this = $(this)

    if ($this.is('.disabled, :disabled')) return

    var $parent  = getParent($this)
    var isActive = $parent.hasClass('open')

    clearMenus()

    if (!isActive) {
      if ('ontouchstart' in document.documentElement && !$parent.closest('.navbar-nav').length) {
        // if mobile we use a backdrop because click events don't delegate
        $('<div class="dropdown-backdrop"/>').insertAfter($(this)).on('click', clearMenus)
      }

      var relatedTarget = { relatedTarget: this }
      $parent.trigger(e = $.Event('show.bs.dropdown', relatedTarget))

      if (e.isDefaultPrevented()) return

      $this.trigger('focus')

      $parent
        .toggleClass('open')
        .trigger('shown.bs.dropdown', relatedTarget)
    }

    return false
  }

  Dropdown.prototype.keydown = function (e) {
    if (!/(38|40|27)/.test(e.keyCode)) return

    var $this = $(this)

    e.preventDefault()
    e.stopPropagation()

    if ($this.is('.disabled, :disabled')) return

    var $parent  = getParent($this)
    var isActive = $parent.hasClass('open')

    if (!isActive || (isActive && e.keyCode == 27)) {
      if (e.which == 27) $parent.find(toggle).trigger('focus')
      return $this.trigger('click')
    }

    var desc = ' li:not(.divider):visible a'
    var $items = $parent.find('[role="menu"]' + desc + ', [role="listbox"]' + desc)

    if (!$items.length) return

    var index = $items.index($items.filter(':focus'))

    if (e.keyCode == 38 && index > 0)                 index--                        // up
    if (e.keyCode == 40 && index < $items.length - 1) index++                        // down
    if (!~index)                                      index = 0

    $items.eq(index).trigger('focus')
  }

  function clearMenus(e) {
    $(backdrop).remove()
    $(toggle).each(function () {
      var $parent = getParent($(this))
      var relatedTarget = { relatedTarget: this }
      if (!$parent.hasClass('open')) return
      $parent.trigger(e = $.Event('hide.bs.dropdown', relatedTarget))
      if (e.isDefaultPrevented()) return
      $parent.removeClass('open').trigger('hidden.bs.dropdown', relatedTarget)
    })
  }

  function getParent($this) {
    var selector = $this.attr('data-target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && /#[A-Za-z]/.test(selector) && selector.replace(/.*(?=#[^\s]*$)/, '') //strip for ie7
    }

    var $parent = selector && $(selector)

    return $parent && $parent.length ? $parent : $this.parent()
  }


  // DROPDOWN PLUGIN DEFINITION
  // ==========================

  var old = $.fn.dropdown

  $.fn.dropdown = function (option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.dropdown')

      if (!data) $this.data('bs.dropdown', (data = new Dropdown(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  $.fn.dropdown.Constructor = Dropdown


  // DROPDOWN NO CONFLICT
  // ====================

  $.fn.dropdown.noConflict = function () {
    $.fn.dropdown = old
    return this
  }


  // APPLY TO STANDARD DROPDOWN ELEMENTS
  // ===================================

  $(document)
    .on('click.bs.dropdown.data-api', clearMenus)
    .on('click.bs.dropdown.data-api', '.dropdown form', function (e) { e.stopPropagation() })
    .on('click.bs.dropdown.data-api', toggle, Dropdown.prototype.toggle)
    .on('keydown.bs.dropdown.data-api', toggle + ', [role="menu"], [role="listbox"]', Dropdown.prototype.keydown)

}(jQuery);
/* ========================================================================
 * Bootstrap: tab.js v3.1.1
 * http://getbootstrap.com/javascript/#tabs
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */



+function ($) {
  'use strict';

  // TAB CLASS DEFINITION
  // ====================

  var Tab = function (element) {
    this.element = $(element)
  }

  Tab.prototype.show = function () {
    var $this    = this.element
    var $ul      = $this.closest('ul:not(.dropdown-menu)')
    var selector = $this.data('target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') //strip for ie7
    }

    if ($this.parent('li').hasClass('active')) return

    var previous = $ul.find('.active:last a')[0]
    var e        = $.Event('show.bs.tab', {
      relatedTarget: previous
    })

    $this.trigger(e)

    if (e.isDefaultPrevented()) return

    var $target = $(selector)

    this.activate($this.parent('li'), $ul)
    this.activate($target, $target.parent(), function () {
      $this.trigger({
        type: 'shown.bs.tab',
        relatedTarget: previous
      })
    })
  }

  Tab.prototype.activate = function (element, container, callback) {
    var $active    = container.find('> .active')
    var transition = callback
      && $.support.transition
      && $active.hasClass('fade')

    function next() {
      $active
        .removeClass('active')
        .find('> .dropdown-menu > .active')
        .removeClass('active')

      element.addClass('active')

      if (transition) {
        element[0].offsetWidth // reflow for transition
        element.addClass('in')
      } else {
        element.removeClass('fade')
      }

      if (element.parent('.dropdown-menu')) {
        element.closest('li.dropdown').addClass('active')
      }

      callback && callback()
    }

    transition ?
      $active
        .one($.support.transition.end, next)
        .emulateTransitionEnd(150) :
      next()

    $active.removeClass('in')
  }


  // TAB PLUGIN DEFINITION
  // =====================

  var old = $.fn.tab

  $.fn.tab = function ( option ) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.tab')

      if (!data) $this.data('bs.tab', (data = new Tab(this)))
      if (typeof option == 'string') data[option]()
    })
  }

  $.fn.tab.Constructor = Tab


  // TAB NO CONFLICT
  // ===============

  $.fn.tab.noConflict = function () {
    $.fn.tab = old
    return this
  }


  // TAB DATA-API
  // ============

  $(document).on('click.bs.tab.data-api', '[data-toggle="tab"], [data-toggle="pill"]', function (e) {
    e.preventDefault()
    $(this).tab('show')
  })

}(jQuery);
/* ========================================================================
 * Bootstrap: transition.js v3.1.1
 * http://getbootstrap.com/javascript/#transitions
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */



+function ($) {
  'use strict';

  // CSS TRANSITION SUPPORT (Shoutout: http://www.modernizr.com/)
  // ============================================================

  function transitionEnd() {
    var el = document.createElement('bootstrap')

    var transEndEventNames = {
      WebkitTransition : 'webkitTransitionEnd',
      MozTransition    : 'transitionend',
      OTransition      : 'oTransitionEnd otransitionend',
      transition       : 'transitionend'
    }

    for (var name in transEndEventNames) {
      if (el.style[name] !== undefined) {
        return { end: transEndEventNames[name] }
      }
    }

    return false // explicit for ie8 (  ._.)
  }

  // http://blog.alexmaccaw.com/css-transitions
  $.fn.emulateTransitionEnd = function (duration) {
    var called = false, $el = this
    $(this).one($.support.transition.end, function () { called = true })
    var callback = function () { if (!called) $($el).trigger($.support.transition.end) }
    setTimeout(callback, duration)
    return this
  }

  $(function () {
    $.support.transition = transitionEnd()
  })

}(jQuery);
/* ========================================================================
 * Bootstrap: scrollspy.js v3.1.1
 * http://getbootstrap.com/javascript/#scrollspy
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */



+function ($) {
  'use strict';

  // SCROLLSPY CLASS DEFINITION
  // ==========================

  function ScrollSpy(element, options) {
    var href
    var process  = $.proxy(this.process, this)

    this.$element       = $(element).is('body') ? $(window) : $(element)
    this.$body          = $('body')
    this.$scrollElement = this.$element.on('scroll.bs.scrollspy', process)
    this.options        = $.extend({}, ScrollSpy.DEFAULTS, options)
    this.selector       = (this.options.target
      || ((href = $(element).attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '')) //strip for ie7
      || '') + ' .nav li > a'
    this.offsets        = $([])
    this.targets        = $([])
    this.activeTarget   = null

    this.refresh()
    this.process()
  }

  ScrollSpy.DEFAULTS = {
    offset: 10
  }

  ScrollSpy.prototype.refresh = function () {
    var offsetMethod = this.$element[0] == window ? 'offset' : 'position'

    this.offsets = $([])
    this.targets = $([])

    var self     = this

    this.$body
      .find(this.selector)
      .map(function () {
        var $el   = $(this)
        var href  = $el.data('target') || $el.attr('href')
        var $href = /^#./.test(href) && $(href)

        return ($href
          && $href.length
          && $href.is(':visible')
          && [[ $href[offsetMethod]().top + (!$.isWindow(self.$scrollElement.get(0)) && self.$scrollElement.scrollTop()), href ]]) || null
      })
      .sort(function (a, b) { return a[0] - b[0] })
      .each(function () {
        self.offsets.push(this[0])
        self.targets.push(this[1])
      })
  }

  ScrollSpy.prototype.process = function () {
    var scrollTop    = this.$scrollElement.scrollTop() + this.options.offset
    var scrollHeight = this.$scrollElement[0].scrollHeight || Math.max(this.$body[0].scrollHeight, document.documentElement.scrollHeight)
    var maxScroll    = scrollHeight - this.$scrollElement.height()
    var offsets      = this.offsets
    var targets      = this.targets
    var activeTarget = this.activeTarget
    var i

    if (scrollTop >= maxScroll) {
      return activeTarget != (i = targets.last()[0]) && this.activate(i)
    }

    if (activeTarget && scrollTop <= offsets[0]) {
      return activeTarget != (i = targets[0]) && this.activate(i)
    }

    for (i = offsets.length; i--;) {
      activeTarget != targets[i]
        && scrollTop >= offsets[i]
        && (!offsets[i + 1] || scrollTop <= offsets[i + 1])
        && this.activate( targets[i] )
    }
  }

  ScrollSpy.prototype.activate = function (target) {
    this.activeTarget = target

    $(this.selector)
      .parentsUntil(this.options.target, '.active')
      .removeClass('active')

    var selector = this.selector +
        '[data-target="' + target + '"],' +
        this.selector + '[href="' + target + '"]'

    var active = $(selector)
      .parents('li')
      .addClass('active')

    if (active.parent('.dropdown-menu').length) {
      active = active
        .closest('li.dropdown')
        .addClass('active')
    }

    active.trigger('activate.bs.scrollspy')
  }


  // SCROLLSPY PLUGIN DEFINITION
  // ===========================

  var old = $.fn.scrollspy

  $.fn.scrollspy = function (option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.scrollspy')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.scrollspy', (data = new ScrollSpy(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  $.fn.scrollspy.Constructor = ScrollSpy


  // SCROLLSPY NO CONFLICT
  // =====================

  $.fn.scrollspy.noConflict = function () {
    $.fn.scrollspy = old
    return this
  }


  // SCROLLSPY DATA-API
  // ==================

  $(window).on('load.bs.scrollspy.data-api', function () {
    $('[data-spy="scroll"]').each(function () {
      var $spy = $(this)
      $spy.scrollspy($spy.data())
    })
  })

}(jQuery);
/* ========================================================================
 * Bootstrap: modal.js v3.1.1
 * http://getbootstrap.com/javascript/#modals
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */



+function ($) {
  'use strict';

  // MODAL CLASS DEFINITION
  // ======================

  var Modal = function (element, options) {
    this.options        = options
    this.$body          = $(document.body)
    this.$element       = $(element)
    this.$backdrop      =
    this.isShown        = null
    this.scrollbarWidth = 0

    if (this.options.remote) {
      this.$element
        .find('.modal-content')
        .load(this.options.remote, $.proxy(function () {
          this.$element.trigger('loaded.bs.modal')
        }, this))
    }
  }

  Modal.DEFAULTS = {
    backdrop: true,
    keyboard: true,
    show: true
  }

  Modal.prototype.toggle = function (_relatedTarget) {
    return this.isShown ? this.hide() : this.show(_relatedTarget)
  }

  Modal.prototype.show = function (_relatedTarget) {
    var that = this
    var e    = $.Event('show.bs.modal', { relatedTarget: _relatedTarget })

    this.$element.trigger(e)

    if (this.isShown || e.isDefaultPrevented()) return

    this.isShown = true

    this.checkScrollbar()
    this.$body.addClass('modal-open')

    this.setScrollbar()
    this.escape()

    this.$element.on('click.dismiss.bs.modal', '[data-dismiss="modal"]', $.proxy(this.hide, this))

    this.backdrop(function () {
      var transition = $.support.transition && that.$element.hasClass('fade')

      if (!that.$element.parent().length) {
        that.$element.appendTo(that.$body) // don't move modals dom position
      }

      that.$element
        .show()
        .scrollTop(0)

      if (transition) {
        that.$element[0].offsetWidth // force reflow
      }

      that.$element
        .addClass('in')
        .attr('aria-hidden', false)

      that.enforceFocus()

      var e = $.Event('shown.bs.modal', { relatedTarget: _relatedTarget })

      transition ?
        that.$element.find('.modal-dialog') // wait for modal to slide in
          .one($.support.transition.end, function () {
            that.$element.trigger('focus').trigger(e)
          })
          .emulateTransitionEnd(300) :
        that.$element.trigger('focus').trigger(e)
    })
  }

  Modal.prototype.hide = function (e) {
    if (e) e.preventDefault()

    e = $.Event('hide.bs.modal')

    this.$element.trigger(e)

    if (!this.isShown || e.isDefaultPrevented()) return

    this.isShown = false

    this.$body.removeClass('modal-open')

    this.resetScrollbar()
    this.escape()

    $(document).off('focusin.bs.modal')

    this.$element
      .removeClass('in')
      .attr('aria-hidden', true)
      .off('click.dismiss.bs.modal')

    $.support.transition && this.$element.hasClass('fade') ?
      this.$element
        .one($.support.transition.end, $.proxy(this.hideModal, this))
        .emulateTransitionEnd(300) :
      this.hideModal()
  }

  Modal.prototype.enforceFocus = function () {
    $(document)
      .off('focusin.bs.modal') // guard against infinite focus loop
      .on('focusin.bs.modal', $.proxy(function (e) {
        if (this.$element[0] !== e.target && !this.$element.has(e.target).length) {
          this.$element.trigger('focus')
        }
      }, this))
  }

  Modal.prototype.escape = function () {
    if (this.isShown && this.options.keyboard) {
      this.$element.on('keyup.dismiss.bs.modal', $.proxy(function (e) {
        e.which == 27 && this.hide()
      }, this))
    } else if (!this.isShown) {
      this.$element.off('keyup.dismiss.bs.modal')
    }
  }

  Modal.prototype.hideModal = function () {
    var that = this
    this.$element.hide()
    this.backdrop(function () {
      that.removeBackdrop()
      that.$element.trigger('hidden.bs.modal')
    })
  }

  Modal.prototype.removeBackdrop = function () {
    this.$backdrop && this.$backdrop.remove()
    this.$backdrop = null
  }

  Modal.prototype.backdrop = function (callback) {
    var animate = this.$element.hasClass('fade') ? 'fade' : ''

    if (this.isShown && this.options.backdrop) {
      var doAnimate = $.support.transition && animate

      this.$backdrop = $('<div class="modal-backdrop ' + animate + '" />')
        .appendTo(this.$body)

      this.$element.on('click.dismiss.bs.modal', $.proxy(function (e) {
        if (e.target !== e.currentTarget) return
        this.options.backdrop == 'static'
          ? this.$element[0].focus.call(this.$element[0])
          : this.hide.call(this)
      }, this))

      if (doAnimate) this.$backdrop[0].offsetWidth // force reflow

      this.$backdrop.addClass('in')

      if (!callback) return

      doAnimate ?
        this.$backdrop
          .one($.support.transition.end, callback)
          .emulateTransitionEnd(150) :
        callback()

    } else if (!this.isShown && this.$backdrop) {
      this.$backdrop.removeClass('in')

      $.support.transition && this.$element.hasClass('fade') ?
        this.$backdrop
          .one($.support.transition.end, callback)
          .emulateTransitionEnd(150) :
        callback()

    } else if (callback) {
      callback()
    }
  }

  Modal.prototype.checkScrollbar = function () {
    if (document.body.clientWidth >= window.innerWidth) return
    this.scrollbarWidth = this.scrollbarWidth || this.measureScrollbar()
  }

  Modal.prototype.setScrollbar =  function () {
    var bodyPad = parseInt(this.$body.css('padding-right') || 0)
    if (this.scrollbarWidth) this.$body.css('padding-right', bodyPad + this.scrollbarWidth)
  }

  Modal.prototype.resetScrollbar = function () {
    this.$body.css('padding-right', '')
  }

  Modal.prototype.measureScrollbar = function () { // thx walsh
    var scrollDiv = document.createElement('div')
    scrollDiv.className = 'modal-scrollbar-measure'
    this.$body.append(scrollDiv)
    var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth
    this.$body[0].removeChild(scrollDiv)
    return scrollbarWidth
  }


  // MODAL PLUGIN DEFINITION
  // =======================

  var old = $.fn.modal

  $.fn.modal = function (option, _relatedTarget) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.modal')
      var options = $.extend({}, Modal.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data) $this.data('bs.modal', (data = new Modal(this, options)))
      if (typeof option == 'string') data[option](_relatedTarget)
      else if (options.show) data.show(_relatedTarget)
    })
  }

  $.fn.modal.Constructor = Modal


  // MODAL NO CONFLICT
  // =================

  $.fn.modal.noConflict = function () {
    $.fn.modal = old
    return this
  }


  // MODAL DATA-API
  // ==============

  $(document).on('click.bs.modal.data-api', '[data-toggle="modal"]', function (e) {
    var $this   = $(this)
    var href    = $this.attr('href')
    var $target = $($this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, ''))) //strip for ie7
    var option  = $target.data('bs.modal') ? 'toggle' : $.extend({ remote: !/#/.test(href) && href }, $target.data(), $this.data())

    if ($this.is('a')) e.preventDefault()

    $target
      .modal(option, this)
      .one('hide', function () {
        $this.is(':visible') && $this.trigger('focus')
      })
  })

}(jQuery);
/* ========================================================================
 * Bootstrap: tooltip.js v3.1.1
 * http://getbootstrap.com/javascript/#tooltip
 * Inspired by the original jQuery.tipsy by Jason Frame
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */



+function ($) {
  'use strict';

  // TOOLTIP PUBLIC CLASS DEFINITION
  // ===============================

  var Tooltip = function (element, options) {
    this.type       =
    this.options    =
    this.enabled    =
    this.timeout    =
    this.hoverState =
    this.$element   = null

    this.init('tooltip', element, options)
  }

  Tooltip.DEFAULTS = {
    animation: true,
    placement: 'top',
    selector: false,
    template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
    trigger: 'hover focus',
    title: '',
    delay: 0,
    html: false,
    container: false,
    viewport: {
      selector: 'body',
      padding: 0
    }
  }

  Tooltip.prototype.init = function (type, element, options) {
    this.enabled   = true
    this.type      = type
    this.$element  = $(element)
    this.options   = this.getOptions(options)
    this.$viewport = this.options.viewport && $(this.options.viewport.selector || this.options.viewport)

    var triggers = this.options.trigger.split(' ')

    for (var i = triggers.length; i--;) {
      var trigger = triggers[i]

      if (trigger == 'click') {
        this.$element.on('click.' + this.type, this.options.selector, $.proxy(this.toggle, this))
      } else if (trigger != 'manual') {
        var eventIn  = trigger == 'hover' ? 'mouseenter' : 'focusin'
        var eventOut = trigger == 'hover' ? 'mouseleave' : 'focusout'

        this.$element.on(eventIn  + '.' + this.type, this.options.selector, $.proxy(this.enter, this))
        this.$element.on(eventOut + '.' + this.type, this.options.selector, $.proxy(this.leave, this))
      }
    }

    this.options.selector ?
      (this._options = $.extend({}, this.options, { trigger: 'manual', selector: '' })) :
      this.fixTitle()
  }

  Tooltip.prototype.getDefaults = function () {
    return Tooltip.DEFAULTS
  }

  Tooltip.prototype.getOptions = function (options) {
    options = $.extend({}, this.getDefaults(), this.$element.data(), options)

    if (options.delay && typeof options.delay == 'number') {
      options.delay = {
        show: options.delay,
        hide: options.delay
      }
    }

    return options
  }

  Tooltip.prototype.getDelegateOptions = function () {
    var options  = {}
    var defaults = this.getDefaults()

    this._options && $.each(this._options, function (key, value) {
      if (defaults[key] != value) options[key] = value
    })

    return options
  }

  Tooltip.prototype.enter = function (obj) {
    var self = obj instanceof this.constructor ?
      obj : $(obj.currentTarget)[this.type](this.getDelegateOptions()).data('bs.' + this.type)

    clearTimeout(self.timeout)

    self.hoverState = 'in'

    if (!self.options.delay || !self.options.delay.show) return self.show()

    self.timeout = setTimeout(function () {
      if (self.hoverState == 'in') self.show()
    }, self.options.delay.show)
  }

  Tooltip.prototype.leave = function (obj) {
    var self = obj instanceof this.constructor ?
      obj : $(obj.currentTarget)[this.type](this.getDelegateOptions()).data('bs.' + this.type)

    clearTimeout(self.timeout)

    self.hoverState = 'out'

    if (!self.options.delay || !self.options.delay.hide) return self.hide()

    self.timeout = setTimeout(function () {
      if (self.hoverState == 'out') self.hide()
    }, self.options.delay.hide)
  }

  Tooltip.prototype.show = function () {
    var e = $.Event('show.bs.' + this.type)

    if (this.hasContent() && this.enabled) {
      this.$element.trigger(e)

      if (e.isDefaultPrevented()) return
      var that = this;

      var $tip = this.tip()

      this.setContent()

      if (this.options.animation) $tip.addClass('fade')

      var placement = typeof this.options.placement == 'function' ?
        this.options.placement.call(this, $tip[0], this.$element[0]) :
        this.options.placement

      var autoToken = /\s?auto?\s?/i
      var autoPlace = autoToken.test(placement)
      if (autoPlace) placement = placement.replace(autoToken, '') || 'top'

      $tip
        .detach()
        .css({ top: 0, left: 0, display: 'block' })
        .addClass(placement)

      this.options.container ? $tip.appendTo(this.options.container) : $tip.insertAfter(this.$element)

      var pos          = this.getPosition()
      var actualWidth  = $tip[0].offsetWidth
      var actualHeight = $tip[0].offsetHeight

      if (autoPlace) {
        var orgPlacement = placement
        var $parent      = this.$element.parent()
        var parentDim    = this.getPosition($parent)

        placement = placement == 'bottom' && pos.top   + pos.height       + actualHeight - parentDim.scroll > parentDim.height ? 'top'    :
                    placement == 'top'    && pos.top   - parentDim.scroll - actualHeight < 0                                   ? 'bottom' :
                    placement == 'right'  && pos.right + actualWidth      > parentDim.width                                    ? 'left'   :
                    placement == 'left'   && pos.left  - actualWidth      < parentDim.left                                     ? 'right'  :
                    placement

        $tip
          .removeClass(orgPlacement)
          .addClass(placement)
      }

      var calculatedOffset = this.getCalculatedOffset(placement, pos, actualWidth, actualHeight)

      this.applyPlacement(calculatedOffset, placement)
      this.hoverState = null

      var complete = function() {
        that.$element.trigger('shown.bs.' + that.type)
      }

      $.support.transition && this.$tip.hasClass('fade') ?
        $tip
          .one($.support.transition.end, complete)
          .emulateTransitionEnd(150) :
        complete()
    }
  }

  Tooltip.prototype.applyPlacement = function (offset, placement) {
    var $tip   = this.tip()
    var width  = $tip[0].offsetWidth
    var height = $tip[0].offsetHeight

    // manually read margins because getBoundingClientRect includes difference
    var marginTop = parseInt($tip.css('margin-top'), 10)
    var marginLeft = parseInt($tip.css('margin-left'), 10)

    // we must check for NaN for ie 8/9
    if (isNaN(marginTop))  marginTop  = 0
    if (isNaN(marginLeft)) marginLeft = 0

    offset.top  = offset.top  + marginTop
    offset.left = offset.left + marginLeft

    // $.fn.offset doesn't round pixel values
    // so we use setOffset directly with our own function B-0
    $.offset.setOffset($tip[0], $.extend({
      using: function (props) {
        $tip.css({
          top: Math.round(props.top),
          left: Math.round(props.left)
        })
      }
    }, offset), 0)

    $tip.addClass('in')

    // check to see if placing tip in new offset caused the tip to resize itself
    var actualWidth  = $tip[0].offsetWidth
    var actualHeight = $tip[0].offsetHeight

    if (placement == 'top' && actualHeight != height) {
      offset.top = offset.top + height - actualHeight
    }

    var delta = this.getViewportAdjustedDelta(placement, offset, actualWidth, actualHeight)

    if (delta.left) offset.left += delta.left
    else offset.top += delta.top

    var arrowDelta          = delta.left ? delta.left * 2 - width + actualWidth : delta.top * 2 - height + actualHeight
    var arrowPosition       = delta.left ? 'left'        : 'top'
    var arrowOffsetPosition = delta.left ? 'offsetWidth' : 'offsetHeight'

    $tip.offset(offset)
    this.replaceArrow(arrowDelta, $tip[0][arrowOffsetPosition], arrowPosition)
  }

  Tooltip.prototype.replaceArrow = function (delta, dimension, position) {
    this.arrow().css(position, delta ? (50 * (1 - delta / dimension) + '%') : '')
  }

  Tooltip.prototype.setContent = function () {
    var $tip  = this.tip()
    var title = this.getTitle()

    $tip.find('.tooltip-inner')[this.options.html ? 'html' : 'text'](title)
    $tip.removeClass('fade in top bottom left right')
  }

  Tooltip.prototype.hide = function () {
    var that = this
    var $tip = this.tip()
    var e    = $.Event('hide.bs.' + this.type)

    function complete() {
      if (that.hoverState != 'in') $tip.detach()
      that.$element.trigger('hidden.bs.' + that.type)
    }

    this.$element.trigger(e)

    if (e.isDefaultPrevented()) return

    $tip.removeClass('in')

    $.support.transition && this.$tip.hasClass('fade') ?
      $tip
        .one($.support.transition.end, complete)
        .emulateTransitionEnd(150) :
      complete()

    this.hoverState = null

    return this
  }

  Tooltip.prototype.fixTitle = function () {
    var $e = this.$element
    if ($e.attr('title') || typeof($e.attr('data-original-title')) != 'string') {
      $e.attr('data-original-title', $e.attr('title') || '').attr('title', '')
    }
  }

  Tooltip.prototype.hasContent = function () {
    return this.getTitle()
  }

  Tooltip.prototype.getPosition = function ($element) {
    $element   = $element || this.$element
    var el     = $element[0]
    var isBody = el.tagName == 'BODY'
    return $.extend({}, (typeof el.getBoundingClientRect == 'function') ? el.getBoundingClientRect() : null, {
      scroll: isBody ? document.documentElement.scrollTop || document.body.scrollTop : $element.scrollTop(),
      width:  isBody ? $(window).width()  : $element.outerWidth(),
      height: isBody ? $(window).height() : $element.outerHeight()
    }, isBody ? {top: 0, left: 0} : $element.offset())
  }

  Tooltip.prototype.getCalculatedOffset = function (placement, pos, actualWidth, actualHeight) {
    return placement == 'bottom' ? { top: pos.top + pos.height,   left: pos.left + pos.width / 2 - actualWidth / 2  } :
           placement == 'top'    ? { top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2  } :
           placement == 'left'   ? { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth } :
        /* placement == 'right' */ { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width   }

  }

  Tooltip.prototype.getViewportAdjustedDelta = function (placement, pos, actualWidth, actualHeight) {
    var delta = { top: 0, left: 0 }
    if (!this.$viewport) return delta

    var viewportPadding = this.options.viewport && this.options.viewport.padding || 0
    var viewportDimensions = this.getPosition(this.$viewport)

    if (/right|left/.test(placement)) {
      var topEdgeOffset    = pos.top - viewportPadding - viewportDimensions.scroll
      var bottomEdgeOffset = pos.top + viewportPadding - viewportDimensions.scroll + actualHeight
      if (topEdgeOffset < viewportDimensions.top) { // top overflow
        delta.top = viewportDimensions.top - topEdgeOffset
      } else if (bottomEdgeOffset > viewportDimensions.top + viewportDimensions.height) { // bottom overflow
        delta.top = viewportDimensions.top + viewportDimensions.height - bottomEdgeOffset
      }
    } else {
      var leftEdgeOffset  = pos.left - viewportPadding
      var rightEdgeOffset = pos.left + viewportPadding + actualWidth
      if (leftEdgeOffset < viewportDimensions.left) { // left overflow
        delta.left = viewportDimensions.left - leftEdgeOffset
      } else if (rightEdgeOffset > viewportDimensions.width) { // right overflow
        delta.left = viewportDimensions.left + viewportDimensions.width - rightEdgeOffset
      }
    }

    return delta
  }

  Tooltip.prototype.getTitle = function () {
    var title
    var $e = this.$element
    var o  = this.options

    title = $e.attr('data-original-title')
      || (typeof o.title == 'function' ? o.title.call($e[0]) :  o.title)

    return title
  }

  Tooltip.prototype.tip = function () {
    return this.$tip = this.$tip || $(this.options.template)
  }

  Tooltip.prototype.arrow = function () {
    return this.$arrow = this.$arrow || this.tip().find('.tooltip-arrow')
  }

  Tooltip.prototype.validate = function () {
    if (!this.$element[0].parentNode) {
      this.hide()
      this.$element = null
      this.options  = null
    }
  }

  Tooltip.prototype.enable = function () {
    this.enabled = true
  }

  Tooltip.prototype.disable = function () {
    this.enabled = false
  }

  Tooltip.prototype.toggleEnabled = function () {
    this.enabled = !this.enabled
  }

  Tooltip.prototype.toggle = function (e) {
    var self = e ? $(e.currentTarget)[this.type](this.getDelegateOptions()).data('bs.' + this.type) : this
    self.tip().hasClass('in') ? self.leave(self) : self.enter(self)
  }

  Tooltip.prototype.destroy = function () {
    clearTimeout(this.timeout)
    this.hide().$element.off('.' + this.type).removeData('bs.' + this.type)
  }


  // TOOLTIP PLUGIN DEFINITION
  // =========================

  var old = $.fn.tooltip

  $.fn.tooltip = function (option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.tooltip')
      var options = typeof option == 'object' && option

      if (!data && option == 'destroy') return
      if (!data) $this.data('bs.tooltip', (data = new Tooltip(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  $.fn.tooltip.Constructor = Tooltip


  // TOOLTIP NO CONFLICT
  // ===================

  $.fn.tooltip.noConflict = function () {
    $.fn.tooltip = old
    return this
  }

}(jQuery);
/* ========================================================================
 * Bootstrap: popover.js v3.1.1
 * http://getbootstrap.com/javascript/#popovers
 * ========================================================================
 * Copyright 2011-2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */



+function ($) {
  'use strict';

  // POPOVER PUBLIC CLASS DEFINITION
  // ===============================

  var Popover = function (element, options) {
    this.init('popover', element, options)
  }

  if (!$.fn.tooltip) throw new Error('Popover requires tooltip.js')

  Popover.DEFAULTS = $.extend({}, $.fn.tooltip.Constructor.DEFAULTS, {
    placement: 'right',
    trigger: 'click',
    content: '',
    template: '<div class="popover"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'
  })


  // NOTE: POPOVER EXTENDS tooltip.js
  // ================================

  Popover.prototype = $.extend({}, $.fn.tooltip.Constructor.prototype)

  Popover.prototype.constructor = Popover

  Popover.prototype.getDefaults = function () {
    return Popover.DEFAULTS
  }

  Popover.prototype.setContent = function () {
    var $tip    = this.tip()
    var title   = this.getTitle()
    var content = this.getContent()

    $tip.find('.popover-title')[this.options.html ? 'html' : 'text'](title)
    $tip.find('.popover-content').empty()[ // we use append for html objects to maintain js events
      this.options.html ? (typeof content == 'string' ? 'html' : 'append') : 'text'
    ](content)

    $tip.removeClass('fade top bottom left right in')

    // IE8 doesn't accept hiding via the `:empty` pseudo selector, we have to do
    // this manually by checking the contents.
    if (!$tip.find('.popover-title').html()) $tip.find('.popover-title').hide()
  }

  Popover.prototype.hasContent = function () {
    return this.getTitle() || this.getContent()
  }

  Popover.prototype.getContent = function () {
    var $e = this.$element
    var o  = this.options

    return $e.attr('data-content')
      || (typeof o.content == 'function' ?
            o.content.call($e[0]) :
            o.content)
  }

  Popover.prototype.arrow = function () {
    return this.$arrow = this.$arrow || this.tip().find('.arrow')
  }

  Popover.prototype.tip = function () {
    if (!this.$tip) this.$tip = $(this.options.template)
    return this.$tip
  }


  // POPOVER PLUGIN DEFINITION
  // =========================

  var old = $.fn.popover

  $.fn.popover = function (option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.popover')
      var options = typeof option == 'object' && option

      if (!data && option == 'destroy') return
      if (!data) $this.data('bs.popover', (data = new Popover(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  $.fn.popover.Constructor = Popover


  // POPOVER NO CONFLICT
  // ===================

  $.fn.popover.noConflict = function () {
    $.fn.popover = old
    return this
  }

}(jQuery);












/*!
	Autosize v1.18.2 - 2014-01-06
	Automatically adjust textarea height based on user input.
	(c) 2014 Jack Moore - http://www.jacklmoore.com/autosize
	license: http://www.opensource.org/licenses/mit-license.php
*/

(function ($) {
	var
	defaults = {
		className: 'autosizejs',
		append: '',
		callback: false,
		resizeDelay: 10
	},

	// border:0 is unnecessary, but avoids a bug in Firefox on OSX
	copy = '<textarea tabindex="-1" style="position:absolute; top:-999px; left:0; right:auto; bottom:auto; border:0; padding: 0; -moz-box-sizing:content-box; -webkit-box-sizing:content-box; box-sizing:content-box; word-wrap:break-word; height:0 !important; min-height:0 !important; overflow:hidden; transition:none; -webkit-transition:none; -moz-transition:none;"/>',

	// line-height is conditionally included because IE7/IE8/old Opera do not return the correct value.
	typographyStyles = [
		'fontFamily',
		'fontSize',
		'fontWeight',
		'fontStyle',
		'letterSpacing',
		'textTransform',
		'wordSpacing',
		'textIndent'
	],

	// to keep track which textarea is being mirrored when adjust() is called.
	mirrored,

	// the mirror element, which is used to calculate what size the mirrored element should be.
	mirror = $(copy).data('autosize', true)[0];

	// test that line-height can be accurately copied.
	mirror.style.lineHeight = '99px';
	if ($(mirror).css('lineHeight') === '99px') {
		typographyStyles.push('lineHeight');
	}
	mirror.style.lineHeight = '';

	$.fn.autosize = function (options) {
		if (!this.length) {
			return this;
		}

		options = $.extend({}, defaults, options || {});

		if (mirror.parentNode !== document.body) {
			$(document.body).append(mirror);
		}

		return this.each(function () {
			var
			ta = this,
			$ta = $(ta),
			maxHeight,
			minHeight,
			boxOffset = 0,
			callback = $.isFunction(options.callback),
			originalStyles = {
				height: ta.style.height,
				overflow: ta.style.overflow,
				overflowY: ta.style.overflowY,
				wordWrap: ta.style.wordWrap,
				resize: ta.style.resize
			},
			timeout,
			width = $ta.width();

			if ($ta.data('autosize')) {
				// exit if autosize has already been applied, or if the textarea is the mirror element.
				return;
			}
			$ta.data('autosize', true);

			if ($ta.css('box-sizing') === 'border-box' || $ta.css('-moz-box-sizing') === 'border-box' || $ta.css('-webkit-box-sizing') === 'border-box'){
				boxOffset = $ta.outerHeight() - $ta.height();
			}

			// IE8 and lower return 'auto', which parses to NaN, if no min-height is set.
			minHeight = Math.max(parseInt($ta.css('minHeight'), 10) - boxOffset || 0, $ta.height());

			$ta.css({
				overflow: 'hidden',
				overflowY: 'hidden',
				wordWrap: 'break-word', // horizontal overflow is hidden, so break-word is necessary for handling words longer than the textarea width
				resize: ($ta.css('resize') === 'none' || $ta.css('resize') === 'vertical') ? 'none' : 'horizontal'
			});

			// The mirror width must exactly match the textarea width, so using getBoundingClientRect because it doesn't round the sub-pixel value.
			function setWidth() {
				var width;
				var style = window.getComputedStyle ? window.getComputedStyle(ta, null) : false;
				
				if (style) {
					width = ta.getBoundingClientRect().width;

					$.each(['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'], function(i,val){
						width -= parseInt(style[val],10);
					});

					mirror.style.width = width + 'px';
				}
				else {
					// window.getComputedStyle, getBoundingClientRect returning a width are unsupported and unneeded in IE8 and lower.
					mirror.style.width = Math.max($ta.width(), 0) + 'px';
				}
			}

			function initMirror() {
				var styles = {};

				mirrored = ta;
				mirror.className = options.className;
				maxHeight = parseInt($ta.css('maxHeight'), 10);

				// mirror is a duplicate textarea located off-screen that
				// is automatically updated to contain the same text as the
				// original textarea.  mirror always has a height of 0.
				// This gives a cross-browser supported way getting the actual
				// height of the text, through the scrollTop property.
				$.each(typographyStyles, function(i,val){
					styles[val] = $ta.css(val);
				});
				$(mirror).css(styles);

				setWidth();

				// Chrome-specific fix:
				// When the textarea y-overflow is hidden, Chrome doesn't reflow the text to account for the space
				// made available by removing the scrollbar. This workaround triggers the reflow for Chrome.
				if (window.chrome) {
					var width = ta.style.width;
					ta.style.width = '0px';
					var ignore = ta.offsetWidth;
					ta.style.width = width;
				}
			}

			// Using mainly bare JS in this function because it is going
			// to fire very often while typing, and needs to very efficient.
			function adjust() {
				var height, original;

				if (mirrored !== ta) {
					initMirror();
				} else {
					setWidth();
				}

				mirror.value = ta.value + options.append;
				mirror.style.overflowY = ta.style.overflowY;
				original = parseInt(ta.style.height,10);

				// Setting scrollTop to zero is needed in IE8 and lower for the next step to be accurately applied
				mirror.scrollTop = 0;

				mirror.scrollTop = 9e4;

				// Using scrollTop rather than scrollHeight because scrollHeight is non-standard and includes padding.
				height = mirror.scrollTop;

				if (maxHeight && height > maxHeight) {
					ta.style.overflowY = 'scroll';
					height = maxHeight;
				} else {
					ta.style.overflowY = 'hidden';
					if (height < minHeight) {
						height = minHeight;
					}
				}

				height += boxOffset;

				if (original !== height) {
					ta.style.height = height + 'px';
					if (callback) {
						options.callback.call(ta,ta);
					}
				}
			}

			function resize () {
				clearTimeout(timeout);
				timeout = setTimeout(function(){
					var newWidth = $ta.width();

					if (newWidth !== width) {
						width = newWidth;
						adjust();
					}
				}, parseInt(options.resizeDelay,10));
			}

			if ('onpropertychange' in ta) {
				if ('oninput' in ta) {
					// Detects IE9.  IE9 does not fire onpropertychange or oninput for deletions,
					// so binding to onkeyup to catch most of those occasions.  There is no way that I
					// know of to detect something like 'cut' in IE9.
					$ta.on('input.autosize keyup.autosize', adjust);
				} else {
					// IE7 / IE8
					$ta.on('propertychange.autosize', function(){
						if(event.propertyName === 'value'){
							adjust();
						}
					});
				}
			} else {
				// Modern Browsers
				$ta.on('input.autosize', adjust);
			}

			// Set options.resizeDelay to false if using fixed-width textarea elements.
			// Uses a timeout and width check to reduce the amount of times adjust needs to be called after window resize.

			if (options.resizeDelay !== false) {
				$(window).on('resize.autosize', resize);
			}

			// Event for manual triggering if needed.
			// Should only be needed when the value of the textarea is changed through JavaScript rather than user input.
			$ta.on('autosize.resize', adjust);

			// Event for manual triggering that also forces the styles to update as well.
			// Should only be needed if one of typography styles of the textarea change, and the textarea is already the target of the adjust method.
			$ta.on('autosize.resizeIncludeStyle', function() {
				mirrored = null;
				adjust();
			});

			$ta.on('autosize.destroy', function(){
				mirrored = null;
				clearTimeout(timeout);
				$(window).off('resize', resize);
				$ta
					.off('autosize')
					.off('.autosize')
					.css(originalStyles)
					.removeData('autosize');
			});

			// Call adjust in case the textarea already contains text.
			adjust();
		});
	};
}(window.jQuery || window.$)); // jQuery or jQuery-like library, such as Zepto
;
/*!
 * jQuery Validation Plugin 1.11.1
 *
 * http://bassistance.de/jquery-plugins/jquery-plugin-validation/
 * http://docs.jquery.com/Plugins/Validation
 *
 * Copyright 2013 Jörn Zaefferer
 * Released under the MIT license:
 *   http://www.opensource.org/licenses/mit-license.php
 */


(function($) {

$.extend($.fn, {
	// http://docs.jquery.com/Plugins/Validation/validate
	validate: function( options ) {

		// if nothing is selected, return nothing; can't chain anyway
		if ( !this.length ) {
			if ( options && options.debug && window.console ) {
				console.warn( "Nothing selected, can't validate, returning nothing." );
			}
			return;
		}

		// check if a validator for this form was already created
		var validator = $.data( this[0], "validator" );
		if ( validator ) {
			return validator;
		}

		// Add novalidate tag if HTML5.
		this.attr( "novalidate", "novalidate" );

		validator = new $.validator( options, this[0] );
		$.data( this[0], "validator", validator );

		if ( validator.settings.onsubmit ) {

			this.validateDelegate( ":submit", "click", function( event ) {
				if ( validator.settings.submitHandler ) {
					validator.submitButton = event.target;
				}
				// allow suppressing validation by adding a cancel class to the submit button
				if ( $(event.target).hasClass("cancel") ) {
					validator.cancelSubmit = true;
				}

				// allow suppressing validation by adding the html5 formnovalidate attribute to the submit button
				if ( $(event.target).attr("formnovalidate") !== undefined ) {
					validator.cancelSubmit = true;
				}
			});

			// validate the form on submit
			this.submit( function( event ) {
				if ( validator.settings.debug ) {
					// prevent form submit to be able to see console output
					event.preventDefault();
				}
				function handle() {
					var hidden;
					if ( validator.settings.submitHandler ) {
						if ( validator.submitButton ) {
							// insert a hidden input as a replacement for the missing submit button
							hidden = $("<input type='hidden'/>").attr("name", validator.submitButton.name).val( $(validator.submitButton).val() ).appendTo(validator.currentForm);
						}
						validator.settings.submitHandler.call( validator, validator.currentForm, event );
						if ( validator.submitButton ) {
							// and clean up afterwards; thanks to no-block-scope, hidden can be referenced
							hidden.remove();
						}
						return false;
					}
					return true;
				}

				// prevent submit for invalid forms or custom submit handlers
				if ( validator.cancelSubmit ) {
					validator.cancelSubmit = false;
					return handle();
				}
				if ( validator.form() ) {
					if ( validator.pendingRequest ) {
						validator.formSubmitted = true;
						return false;
					}
					return handle();
				} else {
					validator.focusInvalid();
					return false;
				}
			});
		}

		return validator;
	},
	// http://docs.jquery.com/Plugins/Validation/valid
	valid: function() {
		if ( $(this[0]).is("form")) {
			return this.validate().form();
		} else {
			var valid = true;
			var validator = $(this[0].form).validate();
			this.each(function() {
				valid = valid && validator.element(this);
			});
			return valid;
		}
	},
	// attributes: space seperated list of attributes to retrieve and remove
	removeAttrs: function( attributes ) {
		var result = {},
			$element = this;
		$.each(attributes.split(/\s/), function( index, value ) {
			result[value] = $element.attr(value);
			$element.removeAttr(value);
		});
		return result;
	},
	// http://docs.jquery.com/Plugins/Validation/rules
	rules: function( command, argument ) {
		var element = this[0];

		if ( command ) {
			var settings = $.data(element.form, "validator").settings;
			var staticRules = settings.rules;
			var existingRules = $.validator.staticRules(element);
			switch(command) {
			case "add":
				$.extend(existingRules, $.validator.normalizeRule(argument));
				// remove messages from rules, but allow them to be set separetely
				delete existingRules.messages;
				staticRules[element.name] = existingRules;
				if ( argument.messages ) {
					settings.messages[element.name] = $.extend( settings.messages[element.name], argument.messages );
				}
				break;
			case "remove":
				if ( !argument ) {
					delete staticRules[element.name];
					return existingRules;
				}
				var filtered = {};
				$.each(argument.split(/\s/), function( index, method ) {
					filtered[method] = existingRules[method];
					delete existingRules[method];
				});
				return filtered;
			}
		}

		var data = $.validator.normalizeRules(
		$.extend(
			{},
			$.validator.classRules(element),
			$.validator.attributeRules(element),
			$.validator.dataRules(element),
			$.validator.staticRules(element)
		), element);

		// make sure required is at front
		if ( data.required ) {
			var param = data.required;
			delete data.required;
			data = $.extend({required: param}, data);
		}

		return data;
	}
});

// Custom selectors
$.extend($.expr[":"], {
	// http://docs.jquery.com/Plugins/Validation/blank
	blank: function( a ) { return !$.trim("" + $(a).val()); },
	// http://docs.jquery.com/Plugins/Validation/filled
	filled: function( a ) { return !!$.trim("" + $(a).val()); },
	// http://docs.jquery.com/Plugins/Validation/unchecked
	unchecked: function( a ) { return !$(a).prop("checked"); }
});

// constructor for validator
$.validator = function( options, form ) {
	this.settings = $.extend( true, {}, $.validator.defaults, options );
	this.currentForm = form;
	this.init();
};

$.validator.format = function( source, params ) {
	if ( arguments.length === 1 ) {
		return function() {
			var args = $.makeArray(arguments);
			args.unshift(source);
			return $.validator.format.apply( this, args );
		};
	}
	if ( arguments.length > 2 && params.constructor !== Array  ) {
		params = $.makeArray(arguments).slice(1);
	}
	if ( params.constructor !== Array ) {
		params = [ params ];
	}
	$.each(params, function( i, n ) {
		source = source.replace( new RegExp("\\{" + i + "\\}", "g"), function() {
			return n;
		});
	});
	return source;
};

$.extend($.validator, {

	defaults: {
		messages: {},
		groups: {},
		rules: {},
		errorClass: "error",
		validClass: "valid",
		errorElement: "label",
		focusInvalid: true,
		errorContainer: $([]),
		errorLabelContainer: $([]),
		onsubmit: true,
		ignore: ":hidden",
		ignoreTitle: false,
		onfocusin: function( element, event ) {
			this.lastActive = element;

			// hide error label and remove error class on focus if enabled
			if ( this.settings.focusCleanup && !this.blockFocusCleanup ) {
				if ( this.settings.unhighlight ) {
					this.settings.unhighlight.call( this, element, this.settings.errorClass, this.settings.validClass );
				}
				this.addWrapper(this.errorsFor(element)).hide();
			}
		},
		onfocusout: function( element, event ) {
			if ( !this.checkable(element) && (element.name in this.submitted || !this.optional(element)) ) {
				this.element(element);
			}
		},
		onkeyup: function( element, event ) {
			if ( event.which === 9 && this.elementValue(element) === "" ) {
				return;
			} else if ( element.name in this.submitted || element === this.lastElement ) {
				this.element(element);
			}
		},
		onclick: function( element, event ) {
			// click on selects, radiobuttons and checkboxes
			if ( element.name in this.submitted ) {
				this.element(element);
			}
			// or option elements, check parent select in that case
			else if ( element.parentNode.name in this.submitted ) {
				this.element(element.parentNode);
			}
		},
		highlight: function( element, errorClass, validClass ) {
			if ( element.type === "radio" ) {
				this.findByName(element.name).addClass(errorClass).removeClass(validClass);
			} else {
				$(element).addClass(errorClass).removeClass(validClass);
			}
		},
		unhighlight: function( element, errorClass, validClass ) {
			if ( element.type === "radio" ) {
				this.findByName(element.name).removeClass(errorClass).addClass(validClass);
			} else {
				$(element).removeClass(errorClass).addClass(validClass);
			}
		}
	},

	// http://docs.jquery.com/Plugins/Validation/Validator/setDefaults
	setDefaults: function( settings ) {
		$.extend( $.validator.defaults, settings );
	},

	messages: {
		required: "This field is required.",
		remote: "Please fix this field.",
		email: "Please enter a valid email address.",
		url: "Please enter a valid URL.",
		date: "Please enter a valid date.",
		dateISO: "Please enter a valid date (ISO).",
		number: "Please enter a valid number.",
		digits: "Please enter only digits.",
		creditcard: "Please enter a valid credit card number.",
		equalTo: "Please enter the same value again.",
		maxlength: $.validator.format("Please enter no more than {0} characters."),
		minlength: $.validator.format("Please enter at least {0} characters."),
		rangelength: $.validator.format("Please enter a value between {0} and {1} characters long."),
		range: $.validator.format("Please enter a value between {0} and {1}."),
		max: $.validator.format("Please enter a value less than or equal to {0}."),
		min: $.validator.format("Please enter a value greater than or equal to {0}.")
	},

	autoCreateRanges: false,

	prototype: {

		init: function() {
			this.labelContainer = $(this.settings.errorLabelContainer);
			this.errorContext = this.labelContainer.length && this.labelContainer || $(this.currentForm);
			this.containers = $(this.settings.errorContainer).add( this.settings.errorLabelContainer );
			this.submitted = {};
			this.valueCache = {};
			this.pendingRequest = 0;
			this.pending = {};
			this.invalid = {};
			this.reset();

			var groups = (this.groups = {});
			$.each(this.settings.groups, function( key, value ) {
				if ( typeof value === "string" ) {
					value = value.split(/\s/);
				}
				$.each(value, function( index, name ) {
					groups[name] = key;
				});
			});
			var rules = this.settings.rules;
			$.each(rules, function( key, value ) {
				rules[key] = $.validator.normalizeRule(value);
			});

			function delegate(event) {
				var validator = $.data(this[0].form, "validator"),
					eventType = "on" + event.type.replace(/^validate/, "");
				if ( validator.settings[eventType] ) {
					validator.settings[eventType].call(validator, this[0], event);
				}
			}
			$(this.currentForm)
				.validateDelegate(":text, [type='password'], [type='file'], select, textarea, " +
					"[type='number'], [type='search'] ,[type='tel'], [type='url'], " +
					"[type='email'], [type='datetime'], [type='date'], [type='month'], " +
					"[type='week'], [type='time'], [type='datetime-local'], " +
					"[type='range'], [type='color'] ",
					"focusin focusout keyup", delegate)
				.validateDelegate("[type='radio'], [type='checkbox'], select, option", "click", delegate);

			if ( this.settings.invalidHandler ) {
				$(this.currentForm).bind("invalid-form.validate", this.settings.invalidHandler);
			}
		},

		// http://docs.jquery.com/Plugins/Validation/Validator/form
		form: function() {
			this.checkForm();
			$.extend(this.submitted, this.errorMap);
			this.invalid = $.extend({}, this.errorMap);
			if ( !this.valid() ) {
				$(this.currentForm).triggerHandler("invalid-form", [this]);
			}
			this.showErrors();
			return this.valid();
		},

		checkForm: function() {
			this.prepareForm();
			for ( var i = 0, elements = (this.currentElements = this.elements()); elements[i]; i++ ) {
				this.check( elements[i] );
			}
			return this.valid();
		},

		// http://docs.jquery.com/Plugins/Validation/Validator/element
		element: function( element ) {
			element = this.validationTargetFor( this.clean( element ) );
			this.lastElement = element;
			this.prepareElement( element );
			this.currentElements = $(element);
			var result = this.check( element ) !== false;
			if ( result ) {
				delete this.invalid[element.name];
			} else {
				this.invalid[element.name] = true;
			}
			if ( !this.numberOfInvalids() ) {
				// Hide error containers on last error
				this.toHide = this.toHide.add( this.containers );
			}
			this.showErrors();
			return result;
		},

		// http://docs.jquery.com/Plugins/Validation/Validator/showErrors
		showErrors: function( errors ) {
			if ( errors ) {
				// add items to error list and map
				$.extend( this.errorMap, errors );
				this.errorList = [];
				for ( var name in errors ) {
					this.errorList.push({
						message: errors[name],
						element: this.findByName(name)[0]
					});
				}
				// remove items from success list
				this.successList = $.grep( this.successList, function( element ) {
					return !(element.name in errors);
				});
			}
			if ( this.settings.showErrors ) {
				this.settings.showErrors.call( this, this.errorMap, this.errorList );
			} else {
				this.defaultShowErrors();
			}
		},

		// http://docs.jquery.com/Plugins/Validation/Validator/resetForm
		resetForm: function() {
			if ( $.fn.resetForm ) {
				$(this.currentForm).resetForm();
			}
			this.submitted = {};
			this.lastElement = null;
			this.prepareForm();
			this.hideErrors();
			this.elements().removeClass( this.settings.errorClass ).removeData( "previousValue" );
		},

		numberOfInvalids: function() {
			return this.objectLength(this.invalid);
		},

		objectLength: function( obj ) {
			var count = 0;
			for ( var i in obj ) {
				count++;
			}
			return count;
		},

		hideErrors: function() {
			this.addWrapper( this.toHide ).hide();
		},

		valid: function() {
			return this.size() === 0;
		},

		size: function() {
			return this.errorList.length;
		},

		focusInvalid: function() {
			if ( this.settings.focusInvalid ) {
				try {
					$(this.findLastActive() || this.errorList.length && this.errorList[0].element || [])
					.filter(":visible")
					.focus()
					// manually trigger focusin event; without it, focusin handler isn't called, findLastActive won't have anything to find
					.trigger("focusin");
				} catch(e) {
					// ignore IE throwing errors when focusing hidden elements
				}
			}
		},

		findLastActive: function() {
			var lastActive = this.lastActive;
			return lastActive && $.grep(this.errorList, function( n ) {
				return n.element.name === lastActive.name;
			}).length === 1 && lastActive;
		},

		elements: function() {
			var validator = this,
				rulesCache = {};

			// select all valid inputs inside the form (no submit or reset buttons)
			return $(this.currentForm)
			.find("input, select, textarea")
			.not(":submit, :reset, :image, [disabled]")
			.not( this.settings.ignore )
			.filter(function() {
				if ( !this.name && validator.settings.debug && window.console ) {
					console.error( "%o has no name assigned", this);
				}

				// select only the first element for each name, and only those with rules specified
				if ( this.name in rulesCache || !validator.objectLength($(this).rules()) ) {
					return false;
				}

				rulesCache[this.name] = true;
				return true;
			});
		},

		clean: function( selector ) {
			return $(selector)[0];
		},

		errors: function() {
			var errorClass = this.settings.errorClass.replace(" ", ".");
			return $(this.settings.errorElement + "." + errorClass, this.errorContext);
		},

		reset: function() {
			this.successList = [];
			this.errorList = [];
			this.errorMap = {};
			this.toShow = $([]);
			this.toHide = $([]);
			this.currentElements = $([]);
		},

		prepareForm: function() {
			this.reset();
			this.toHide = this.errors().add( this.containers );
		},

		prepareElement: function( element ) {
			this.reset();
			this.toHide = this.errorsFor(element);
		},

		elementValue: function( element ) {
			var type = $(element).attr("type"),
				val = $(element).val();

			if ( type === "radio" || type === "checkbox" ) {
				return $("input[name='" + $(element).attr("name") + "']:checked").val();
			}

			if ( typeof val === "string" ) {
				return val.replace(/\r/g, "");
			}
			return val;
		},

		check: function( element ) {
			element = this.validationTargetFor( this.clean( element ) );

			var rules = $(element).rules();
			var dependencyMismatch = false;
			var val = this.elementValue(element);
			var result;

			for (var method in rules ) {
				var rule = { method: method, parameters: rules[method] };
				try {

					result = $.validator.methods[method].call( this, val, element, rule.parameters );

					// if a method indicates that the field is optional and therefore valid,
					// don't mark it as valid when there are no other rules
					if ( result === "dependency-mismatch" ) {
						dependencyMismatch = true;
						continue;
					}
					dependencyMismatch = false;

					if ( result === "pending" ) {
						this.toHide = this.toHide.not( this.errorsFor(element) );
						return;
					}

					if ( !result ) {
						this.formatAndAdd( element, rule );
						return false;
					}
				} catch(e) {
					if ( this.settings.debug && window.console ) {
						console.log( "Exception occurred when checking element " + element.id + ", check the '" + rule.method + "' method.", e );
					}
					throw e;
				}
			}
			if ( dependencyMismatch ) {
				return;
			}
			if ( this.objectLength(rules) ) {
				this.successList.push(element);
			}
			return true;
		},

		// return the custom message for the given element and validation method
		// specified in the element's HTML5 data attribute
		customDataMessage: function( element, method ) {
			return $(element).data("msg-" + method.toLowerCase()) || (element.attributes && $(element).attr("data-msg-" + method.toLowerCase()));
		},

		// return the custom message for the given element name and validation method
		customMessage: function( name, method ) {
			var m = this.settings.messages[name];
			return m && (m.constructor === String ? m : m[method]);
		},

		// return the first defined argument, allowing empty strings
		findDefined: function() {
			for(var i = 0; i < arguments.length; i++) {
				if ( arguments[i] !== undefined ) {
					return arguments[i];
				}
			}
			return undefined;
		},

		defaultMessage: function( element, method ) {
			return this.findDefined(
				this.customMessage( element.name, method ),
				this.customDataMessage( element, method ),
				// title is never undefined, so handle empty string as undefined
				!this.settings.ignoreTitle && element.title || undefined,
				$.validator.messages[method],
				"<strong>Warning: No message defined for " + element.name + "</strong>"
			);
		},

		formatAndAdd: function( element, rule ) {
			var message = this.defaultMessage( element, rule.method ),
				theregex = /\$?\{(\d+)\}/g;
			if ( typeof message === "function" ) {
				message = message.call(this, rule.parameters, element);
			} else if (theregex.test(message)) {
				message = $.validator.format(message.replace(theregex, "{$1}"), rule.parameters);
			}
			this.errorList.push({
				message: message,
				element: element
			});

			this.errorMap[element.name] = message;
			this.submitted[element.name] = message;
		},

		addWrapper: function( toToggle ) {
			if ( this.settings.wrapper ) {
				toToggle = toToggle.add( toToggle.parent( this.settings.wrapper ) );
			}
			return toToggle;
		},

		defaultShowErrors: function() {
			var i, elements;
			for ( i = 0; this.errorList[i]; i++ ) {
				var error = this.errorList[i];
				if ( this.settings.highlight ) {
					this.settings.highlight.call( this, error.element, this.settings.errorClass, this.settings.validClass );
				}
				this.showLabel( error.element, error.message );
			}
			if ( this.errorList.length ) {
				this.toShow = this.toShow.add( this.containers );
			}
			if ( this.settings.success ) {
				for ( i = 0; this.successList[i]; i++ ) {
					this.showLabel( this.successList[i] );
				}
			}
			if ( this.settings.unhighlight ) {
				for ( i = 0, elements = this.validElements(); elements[i]; i++ ) {
					this.settings.unhighlight.call( this, elements[i], this.settings.errorClass, this.settings.validClass );
				}
			}
			this.toHide = this.toHide.not( this.toShow );
			this.hideErrors();
			this.addWrapper( this.toShow ).show();
		},

		validElements: function() {
			return this.currentElements.not(this.invalidElements());
		},

		invalidElements: function() {
			return $(this.errorList).map(function() {
				return this.element;
			});
		},

		showLabel: function( element, message ) {
			var label = this.errorsFor( element );
			if ( label.length ) {
				// refresh error/success class
				label.removeClass( this.settings.validClass ).addClass( this.settings.errorClass );
				// replace message on existing label
				label.html(message);
			} else {
				// create label
				label = $("<" + this.settings.errorElement + ">")
					.attr("for", this.idOrName(element))
					.addClass(this.settings.errorClass)
					.html(message || "");
				if ( this.settings.wrapper ) {
					// make sure the element is visible, even in IE
					// actually showing the wrapped element is handled elsewhere
					label = label.hide().show().wrap("<" + this.settings.wrapper + "/>").parent();
				}
				if ( !this.labelContainer.append(label).length ) {
					if ( this.settings.errorPlacement ) {
						this.settings.errorPlacement(label, $(element) );
					} else {
						label.insertAfter(element);
					}
				}
			}
			if ( !message && this.settings.success ) {
				label.text("");
				if ( typeof this.settings.success === "string" ) {
					label.addClass( this.settings.success );
				} else {
					this.settings.success( label, element );
				}
			}
			this.toShow = this.toShow.add(label);
		},

		errorsFor: function( element ) {
			var name = this.idOrName(element);
			return this.errors().filter(function() {
				return $(this).attr("for") === name;
			});
		},

		idOrName: function( element ) {
			return this.groups[element.name] || (this.checkable(element) ? element.name : element.id || element.name);
		},

		validationTargetFor: function( element ) {
			// if radio/checkbox, validate first element in group instead
			if ( this.checkable(element) ) {
				element = this.findByName( element.name ).not(this.settings.ignore)[0];
			}
			return element;
		},

		checkable: function( element ) {
			return (/radio|checkbox/i).test(element.type);
		},

		findByName: function( name ) {
			return $(this.currentForm).find("[name='" + name + "']");
		},

		getLength: function( value, element ) {
			switch( element.nodeName.toLowerCase() ) {
			case "select":
				return $("option:selected", element).length;
			case "input":
				if ( this.checkable( element) ) {
					return this.findByName(element.name).filter(":checked").length;
				}
			}
			return value.length;
		},

		depend: function( param, element ) {
			return this.dependTypes[typeof param] ? this.dependTypes[typeof param](param, element) : true;
		},

		dependTypes: {
			"boolean": function( param, element ) {
				return param;
			},
			"string": function( param, element ) {
				return !!$(param, element.form).length;
			},
			"function": function( param, element ) {
				return param(element);
			}
		},

		optional: function( element ) {
			var val = this.elementValue(element);
			return !$.validator.methods.required.call(this, val, element) && "dependency-mismatch";
		},

		startRequest: function( element ) {
			if ( !this.pending[element.name] ) {
				this.pendingRequest++;
				this.pending[element.name] = true;
			}
		},

		stopRequest: function( element, valid ) {
			this.pendingRequest--;
			// sometimes synchronization fails, make sure pendingRequest is never < 0
			if ( this.pendingRequest < 0 ) {
				this.pendingRequest = 0;
			}
			delete this.pending[element.name];
			if ( valid && this.pendingRequest === 0 && this.formSubmitted && this.form() ) {
				$(this.currentForm).submit();
				this.formSubmitted = false;
			} else if (!valid && this.pendingRequest === 0 && this.formSubmitted) {
				$(this.currentForm).triggerHandler("invalid-form", [this]);
				this.formSubmitted = false;
			}
		},

		previousValue: function( element ) {
			return $.data(element, "previousValue") || $.data(element, "previousValue", {
				old: null,
				valid: true,
				message: this.defaultMessage( element, "remote" )
			});
		}

	},

	classRuleSettings: {
		required: {required: true},
		email: {email: true},
		url: {url: true},
		date: {date: true},
		dateISO: {dateISO: true},
		number: {number: true},
		digits: {digits: true},
		creditcard: {creditcard: true}
	},

	addClassRules: function( className, rules ) {
		if ( className.constructor === String ) {
			this.classRuleSettings[className] = rules;
		} else {
			$.extend(this.classRuleSettings, className);
		}
	},

	classRules: function( element ) {
		var rules = {};
		var classes = $(element).attr("class");
		if ( classes ) {
			$.each(classes.split(" "), function() {
				if ( this in $.validator.classRuleSettings ) {
					$.extend(rules, $.validator.classRuleSettings[this]);
				}
			});
		}
		return rules;
	},

	attributeRules: function( element ) {
		var rules = {};
		var $element = $(element);
		var type = $element[0].getAttribute("type");

		for (var method in $.validator.methods) {
			var value;

			// support for <input required> in both html5 and older browsers
			if ( method === "required" ) {
				value = $element.get(0).getAttribute(method);
				// Some browsers return an empty string for the required attribute
				// and non-HTML5 browsers might have required="" markup
				if ( value === "" ) {
					value = true;
				}
				// force non-HTML5 browsers to return bool
				value = !!value;
			} else {
				value = $element.attr(method);
			}

			// convert the value to a number for number inputs, and for text for backwards compability
			// allows type="date" and others to be compared as strings
			if ( /min|max/.test( method ) && ( type === null || /number|range|text/.test( type ) ) ) {
				value = Number(value);
			}

			if ( value ) {
				rules[method] = value;
			} else if ( type === method && type !== 'range' ) {
				// exception: the jquery validate 'range' method
				// does not test for the html5 'range' type
				rules[method] = true;
			}
		}

		// maxlength may be returned as -1, 2147483647 (IE) and 524288 (safari) for text inputs
		if ( rules.maxlength && /-1|2147483647|524288/.test(rules.maxlength) ) {
			delete rules.maxlength;
		}

		return rules;
	},

	dataRules: function( element ) {
		var method, value,
			rules = {}, $element = $(element);
		for (method in $.validator.methods) {
			value = $element.data("rule-" + method.toLowerCase());
			if ( value !== undefined ) {
				rules[method] = value;
			}
		}
		return rules;
	},

	staticRules: function( element ) {
		var rules = {};
		var validator = $.data(element.form, "validator");
		if ( validator.settings.rules ) {
			rules = $.validator.normalizeRule(validator.settings.rules[element.name]) || {};
		}
		return rules;
	},

	normalizeRules: function( rules, element ) {
		// handle dependency check
		$.each(rules, function( prop, val ) {
			// ignore rule when param is explicitly false, eg. required:false
			if ( val === false ) {
				delete rules[prop];
				return;
			}
			if ( val.param || val.depends ) {
				var keepRule = true;
				switch (typeof val.depends) {
				case "string":
					keepRule = !!$(val.depends, element.form).length;
					break;
				case "function":
					keepRule = val.depends.call(element, element);
					break;
				}
				if ( keepRule ) {
					rules[prop] = val.param !== undefined ? val.param : true;
				} else {
					delete rules[prop];
				}
			}
		});

		// evaluate parameters
		$.each(rules, function( rule, parameter ) {
			rules[rule] = $.isFunction(parameter) ? parameter(element) : parameter;
		});

		// clean number parameters
		$.each(['minlength', 'maxlength'], function() {
			if ( rules[this] ) {
				rules[this] = Number(rules[this]);
			}
		});
		$.each(['rangelength', 'range'], function() {
			var parts;
			if ( rules[this] ) {
				if ( $.isArray(rules[this]) ) {
					rules[this] = [Number(rules[this][0]), Number(rules[this][1])];
				} else if ( typeof rules[this] === "string" ) {
					parts = rules[this].split(/[\s,]+/);
					rules[this] = [Number(parts[0]), Number(parts[1])];
				}
			}
		});

		if ( $.validator.autoCreateRanges ) {
			// auto-create ranges
			if ( rules.min && rules.max ) {
				rules.range = [rules.min, rules.max];
				delete rules.min;
				delete rules.max;
			}
			if ( rules.minlength && rules.maxlength ) {
				rules.rangelength = [rules.minlength, rules.maxlength];
				delete rules.minlength;
				delete rules.maxlength;
			}
		}

		return rules;
	},

	// Converts a simple string to a {string: true} rule, e.g., "required" to {required:true}
	normalizeRule: function( data ) {
		if ( typeof data === "string" ) {
			var transformed = {};
			$.each(data.split(/\s/), function() {
				transformed[this] = true;
			});
			data = transformed;
		}
		return data;
	},

	// http://docs.jquery.com/Plugins/Validation/Validator/addMethod
	addMethod: function( name, method, message ) {
		$.validator.methods[name] = method;
		$.validator.messages[name] = message !== undefined ? message : $.validator.messages[name];
		if ( method.length < 3 ) {
			$.validator.addClassRules(name, $.validator.normalizeRule(name));
		}
	},

	methods: {

		// http://docs.jquery.com/Plugins/Validation/Methods/required
		required: function( value, element, param ) {
			// check if dependency is met
			if ( !this.depend(param, element) ) {
				return "dependency-mismatch";
			}
			if ( element.nodeName.toLowerCase() === "select" ) {
				// could be an array for select-multiple or a string, both are fine this way
				var val = $(element).val();
				return val && val.length > 0;
			}
			if ( this.checkable(element) ) {
				return this.getLength(value, element) > 0;
			}
			return $.trim(value).length > 0;
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/email
		email: function( value, element ) {
			// contributed by Scott Gonzalez: http://projects.scottsplayground.com/email_address_validation/
			return this.optional(element) || /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i.test(value);
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/url
		url: function( value, element ) {
			// contributed by Scott Gonzalez: http://projects.scottsplayground.com/iri/
			return this.optional(element) || /^(https?|s?ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(value);
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/date
		date: function( value, element ) {
			return this.optional(element) || !/Invalid|NaN/.test(new Date(value).toString());
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/dateISO
		dateISO: function( value, element ) {
			return this.optional(element) || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(value);
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/number
		number: function( value, element ) {
			return this.optional(element) || /^-?(?:\d+|\d{1,3}(?:,\d{3})+)?(?:\.\d+)?$/.test(value);
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/digits
		digits: function( value, element ) {
			return this.optional(element) || /^\d+$/.test(value);
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/creditcard
		// based on http://en.wikipedia.org/wiki/Luhn
		creditcard: function( value, element ) {
			if ( this.optional(element) ) {
				return "dependency-mismatch";
			}
			// accept only spaces, digits and dashes
			if ( /[^0-9 \-]+/.test(value) ) {
				return false;
			}
			var nCheck = 0,
				nDigit = 0,
				bEven = false;

			value = value.replace(/\D/g, "");

			for (var n = value.length - 1; n >= 0; n--) {
				var cDigit = value.charAt(n);
				nDigit = parseInt(cDigit, 10);
				if ( bEven ) {
					if ( (nDigit *= 2) > 9 ) {
						nDigit -= 9;
					}
				}
				nCheck += nDigit;
				bEven = !bEven;
			}

			return (nCheck % 10) === 0;
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/minlength
		minlength: function( value, element, param ) {
			var length = $.isArray( value ) ? value.length : this.getLength($.trim(value), element);
			return this.optional(element) || length >= param;
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/maxlength
		maxlength: function( value, element, param ) {
			var length = $.isArray( value ) ? value.length : this.getLength($.trim(value), element);
			return this.optional(element) || length <= param;
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/rangelength
		rangelength: function( value, element, param ) {
			var length = $.isArray( value ) ? value.length : this.getLength($.trim(value), element);
			return this.optional(element) || ( length >= param[0] && length <= param[1] );
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/min
		min: function( value, element, param ) {
			return this.optional(element) || value >= param;
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/max
		max: function( value, element, param ) {
			return this.optional(element) || value <= param;
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/range
		range: function( value, element, param ) {
			return this.optional(element) || ( value >= param[0] && value <= param[1] );
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/equalTo
		equalTo: function( value, element, param ) {
			// bind to the blur event of the target in order to revalidate whenever the target field is updated
			// TODO find a way to bind the event just once, avoiding the unbind-rebind overhead
			var target = $(param);
			if ( this.settings.onfocusout ) {
				target.unbind(".validate-equalTo").bind("blur.validate-equalTo", function() {
					$(element).valid();
				});
			}
			return value === target.val();
		},

		// http://docs.jquery.com/Plugins/Validation/Methods/remote
		remote: function( value, element, param ) {
			if ( this.optional(element) ) {
				return "dependency-mismatch";
			}

			var previous = this.previousValue(element);
			if (!this.settings.messages[element.name] ) {
				this.settings.messages[element.name] = {};
			}
			previous.originalMessage = this.settings.messages[element.name].remote;
			this.settings.messages[element.name].remote = previous.message;

			param = typeof param === "string" && {url:param} || param;

			if ( previous.old === value ) {
				return previous.valid;
			}

			previous.old = value;
			var validator = this;
			this.startRequest(element);
			var data = {};
			data[element.name] = value;
			$.ajax($.extend(true, {
				url: param,
				mode: "abort",
				port: "validate" + element.name,
				dataType: "json",
				data: data,
				success: function( response ) {
					validator.settings.messages[element.name].remote = previous.originalMessage;
					var valid = response === true || response === "true";
					if ( valid ) {
						var submitted = validator.formSubmitted;
						validator.prepareElement(element);
						validator.formSubmitted = submitted;
						validator.successList.push(element);
						delete validator.invalid[element.name];
						validator.showErrors();
					} else {
						var errors = {};
						var message = response || validator.defaultMessage( element, "remote" );
						errors[element.name] = previous.message = $.isFunction(message) ? message(value) : message;
						validator.invalid[element.name] = true;
						validator.showErrors(errors);
					}
					previous.valid = valid;
					validator.stopRequest(element, valid);
				}
			}, param));
			return "pending";
		}

	}

});

// deprecated, use $.validator.format instead
$.format = $.validator.format;

}(jQuery));

// ajax mode: abort
// usage: $.ajax({ mode: "abort"[, port: "uniqueport"]});
// if mode:"abort" is used, the previous request on that port (port can be undefined) is aborted via XMLHttpRequest.abort()
(function($) {
	var pendingRequests = {};
	// Use a prefilter if available (1.5+)
	if ( $.ajaxPrefilter ) {
		$.ajaxPrefilter(function( settings, _, xhr ) {
			var port = settings.port;
			if ( settings.mode === "abort" ) {
				if ( pendingRequests[port] ) {
					pendingRequests[port].abort();
				}
				pendingRequests[port] = xhr;
			}
		});
	} else {
		// Proxy ajax
		var ajax = $.ajax;
		$.ajax = function( settings ) {
			var mode = ( "mode" in settings ? settings : $.ajaxSettings ).mode,
				port = ( "port" in settings ? settings : $.ajaxSettings ).port;
			if ( mode === "abort" ) {
				if ( pendingRequests[port] ) {
					pendingRequests[port].abort();
				}
				pendingRequests[port] = ajax.apply(this, arguments);
				return pendingRequests[port];
			}
			return ajax.apply(this, arguments);
		};
	}
}(jQuery));

// provides delegate(type: String, delegate: Selector, handler: Callback) plugin for easier event delegation
// handler is only called when $(event.target).is(delegate), in the scope of the jquery-object for event.target
(function($) {
	$.extend($.fn, {
		validateDelegate: function( delegate, type, handler ) {
			return this.bind(type, function( event ) {
				var target = $(event.target);
				if ( target.is(delegate) ) {
					return handler.apply(target, arguments);
				}
			});
		}
	});
}(jQuery));
/**
 * Timeago is a jQuery plugin that makes it easy to support automatically
 * updating fuzzy timestamps (e.g. "4 minutes ago" or "about 1 day ago").
 *
 * @name timeago
 * @version 1.3.2
 * @requires jQuery v1.2.3+
 * @author Ryan McGeary
 * @license MIT License - http://www.opensource.org/licenses/mit-license.php
 *
 * For usage and examples, visit:
 * http://timeago.yarp.com/
 *
 * Copyright (c) 2008-2013, Ryan McGeary (ryan -[at]- mcgeary [*dot*] org)
 */


(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['jquery'], factory);
  } else {
    // Browser globals
    factory(jQuery);
  }
}(function ($) {
  $.timeago = function(timestamp) {
    if (timestamp instanceof Date) {
      return inWords(timestamp);
    } else if (typeof timestamp === "string") {
      return inWords($.timeago.parse(timestamp));
    } else if (typeof timestamp === "number") {
      return inWords(new Date(timestamp));
    } else {
      return inWords($.timeago.datetime(timestamp));
    }
  };
  var $t = $.timeago;

  $.extend($.timeago, {
    settings: {
      refreshMillis: 60000,
      allowFuture: false,
      localeTitle: false,
      cutoff: 0,
      strings: {
        prefixAgo: null,
        prefixFromNow: null,
        suffixAgo: "ago",
        suffixFromNow: "from now",
        seconds: "less than a minute",
        minute: "about a minute",
        minutes: "%d minutes",
        hour: "about an hour",
        hours: "about %d hours",
        day: "a day",
        days: "%d days",
        month: "about a month",
        months: "%d months",
        year: "about a year",
        years: "%d years",
        wordSeparator: " ",
        numbers: []
      }
    },
    inWords: function(distanceMillis) {
      var $l = this.settings.strings;
      var prefix = $l.prefixAgo;
      var suffix = $l.suffixAgo;
      if (this.settings.allowFuture) {
        if (distanceMillis < 0) {
          prefix = $l.prefixFromNow;
          suffix = $l.suffixFromNow;
        }
      }

      var seconds = Math.abs(distanceMillis) / 1000;
      var minutes = seconds / 60;
      var hours = minutes / 60;
      var days = hours / 24;
      var years = days / 365;

      function substitute(stringOrFunction, number) {
        var string = $.isFunction(stringOrFunction) ? stringOrFunction(number, distanceMillis) : stringOrFunction;
        var value = ($l.numbers && $l.numbers[number]) || number;
        return string.replace(/%d/i, value);
      }

      var words = seconds < 45 && substitute($l.seconds, Math.round(seconds)) ||
        seconds < 90 && substitute($l.minute, 1) ||
        minutes < 45 && substitute($l.minutes, Math.round(minutes)) ||
        minutes < 90 && substitute($l.hour, 1) ||
        hours < 24 && substitute($l.hours, Math.round(hours)) ||
        hours < 42 && substitute($l.day, 1) ||
        days < 30 && substitute($l.days, Math.round(days)) ||
        days < 45 && substitute($l.month, 1) ||
        days < 365 && substitute($l.months, Math.round(days / 30)) ||
        years < 1.5 && substitute($l.year, 1) ||
        substitute($l.years, Math.round(years));

      var separator = $l.wordSeparator || "";
      if ($l.wordSeparator === undefined) { separator = " "; }
      return $.trim([prefix, words, suffix].join(separator));
    },
    parse: function(iso8601) {
      var s = $.trim(iso8601);
      s = s.replace(/\.\d+/,""); // remove milliseconds
      s = s.replace(/-/,"/").replace(/-/,"/");
      s = s.replace(/T/," ").replace(/Z/," UTC");
      s = s.replace(/([\+\-]\d\d)\:?(\d\d)/," $1$2"); // -04:00 -> -0400
      s = s.replace(/([\+\-]\d\d)$/," $100"); // +09 -> +0900
      return new Date(s);
    },
    datetime: function(elem) {
      var iso8601 = $t.isTime(elem) ? $(elem).attr("datetime") : $(elem).attr("title");
      return $t.parse(iso8601);
    },
    isTime: function(elem) {
      // jQuery's `is()` doesn't play well with HTML5 in IE
      return $(elem).get(0).tagName.toLowerCase() === "time"; // $(elem).is("time");
    }
  });

  // functions that can be called via $(el).timeago('action')
  // init is default when no action is given
  // functions are called with context of a single element
  var functions = {
    init: function(){
      var refresh_el = $.proxy(refresh, this);
      refresh_el();
      var $s = $t.settings;
      if ($s.refreshMillis > 0) {
        this._timeagoInterval = setInterval(refresh_el, $s.refreshMillis);
      }
    },
    update: function(time){
      var parsedTime = $t.parse(time);
      $(this).data('timeago', { datetime: parsedTime });
      if($t.settings.localeTitle) $(this).attr("title", parsedTime.toLocaleString());
      refresh.apply(this);
    },
    updateFromDOM: function(){
      $(this).data('timeago', { datetime: $t.parse( $t.isTime(this) ? $(this).attr("datetime") : $(this).attr("title") ) });
      refresh.apply(this);
    },
    dispose: function () {
      if (this._timeagoInterval) {
        window.clearInterval(this._timeagoInterval);
        this._timeagoInterval = null;
      }
    }
  };

  $.fn.timeago = function(action, options) {
    var fn = action ? functions[action] : functions.init;
    if(!fn){
      throw new Error("Unknown function name '"+ action +"' for timeago");
    }
    // each over objects here and call the requested function
    this.each(function(){
      fn.call(this, options);
    });
    return this;
  };

  function refresh() {
    var data = prepareData(this);
    var $s = $t.settings;

    if (!isNaN(data.datetime)) {
      if ( $s.cutoff == 0 || distance(data.datetime) < $s.cutoff) {
        $(this).text(inWords(data.datetime));
      }
    }
    return this;
  }

  function prepareData(element) {
    element = $(element);
    if (!element.data("timeago")) {
      element.data("timeago", { datetime: $t.datetime(element) });
      var text = $.trim(element.text());
      if ($t.settings.localeTitle) {
        element.attr("title", element.data('timeago').datetime.toLocaleString());
      } else if (text.length > 0 && !($t.isTime(element) && element.attr("title"))) {
        element.attr("title", text);
      }
    }
    return element.data("timeago");
  }

  function inWords(date) {
    return $t.inWords(distance(date));
  }

  function distance(date) {
    return (new Date().getTime() - date.getTime());
  }

  // fix for IE6 suckage
  document.createElement("abbr");
  document.createElement("time");
}));
/*! NProgress (c) 2013, Rico Sta. Cruz
 *  http://ricostacruz.com/nprogress */


;(function(factory) {

  if (typeof module === 'function') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    this.NProgress = factory();
  }

})(function() {
  var NProgress = {};

  NProgress.version = '0.1.3';

  var Settings = NProgress.settings = {
    minimum: 0.08,
    easing: 'ease',
    positionUsing: '',
    speed: 200,
    trickle: true,
    trickleRate: 0.02,
    trickleSpeed: 800,
    showSpinner: true,
    barSelector: '[role="bar"]',
    spinnerSelector: '[role="spinner"]',
    template: '<div class="bar" role="bar"><div class="peg"></div></div><div class="spinner" role="spinner"><div class="spinner-icon"></div></div>'
  };

  /**
   * Updates configuration.
   *
   *     NProgress.configure({
   *       minimum: 0.1
   *     });
   */
  NProgress.configure = function(options) {
    var key, value;
    for (key in options) {
      value = options[key];
      if (value !== undefined && options.hasOwnProperty(key)) Settings[key] = value;
    }

    return this;
  };

  /**
   * Last number.
   */

  NProgress.status = null;

  /**
   * Sets the progress bar status, where `n` is a number from `0.0` to `1.0`.
   *
   *     NProgress.set(0.4);
   *     NProgress.set(1.0);
   */

  NProgress.set = function(n) {
    var started = NProgress.isStarted();

    n = clamp(n, Settings.minimum, 1);
    NProgress.status = (n === 1 ? null : n);

    var progress = NProgress.render(!started),
        bar      = progress.querySelector(Settings.barSelector),
        speed    = Settings.speed,
        ease     = Settings.easing;

    progress.offsetWidth; /* Repaint */

    queue(function(next) {
      // Set positionUsing if it hasn't already been set
      if (Settings.positionUsing === '') Settings.positionUsing = NProgress.getPositioningCSS();

      // Add transition
      css(bar, barPositionCSS(n, speed, ease));

      if (n === 1) {
        // Fade out
        css(progress, { 
          transition: 'none', 
          opacity: 1 
        });
        progress.offsetWidth; /* Repaint */

        setTimeout(function() {
          css(progress, { 
            transition: 'all ' + speed + 'ms linear', 
            opacity: 0 
          });
          setTimeout(function() {
            NProgress.remove();
            next();
          }, speed);
        }, speed);
      } else {
        setTimeout(next, speed);
      }
    });

    return this;
  };

  NProgress.isStarted = function() {
    return typeof NProgress.status === 'number';
  };

  /**
   * Shows the progress bar.
   * This is the same as setting the status to 0%, except that it doesn't go backwards.
   *
   *     NProgress.start();
   *
   */
  NProgress.start = function() {
    if (!NProgress.status) NProgress.set(0);

    var work = function() {
      setTimeout(function() {
        if (!NProgress.status) return;
        NProgress.trickle();
        work();
      }, Settings.trickleSpeed);
    };

    if (Settings.trickle) work();

    return this;
  };

  /**
   * Hides the progress bar.
   * This is the *sort of* the same as setting the status to 100%, with the
   * difference being `done()` makes some placebo effect of some realistic motion.
   *
   *     NProgress.done();
   *
   * If `true` is passed, it will show the progress bar even if its hidden.
   *
   *     NProgress.done(true);
   */

  NProgress.done = function(force) {
    if (!force && !NProgress.status) return this;

    return NProgress.inc(0.3 + 0.5 * Math.random()).set(1);
  };

  /**
   * Increments by a random amount.
   */

  NProgress.inc = function(amount) {
    var n = NProgress.status;

    if (!n) {
      return NProgress.start();
    } else {
      if (typeof amount !== 'number') {
        amount = (1 - n) * clamp(Math.random() * n, 0.1, 0.95);
      }

      n = clamp(n + amount, 0, 0.994);
      return NProgress.set(n);
    }
  };

  NProgress.trickle = function() {
    return NProgress.inc(Math.random() * Settings.trickleRate);
  };

  /**
   * Waits for all supplied jQuery promises and
   * increases the progress as the promises resolve.
   * 
   * @param $promise jQUery Promise
   */
  (function() {
    var initial = 0, current = 0;
    
    NProgress.promise = function($promise) {
      if (!$promise || $promise.state() == "resolved") {
        return this;
      }
      
      if (current == 0) {
        NProgress.start();
      }
      
      initial++;
      current++;
      
      $promise.always(function() {
        current--;
        if (current == 0) {
            initial = 0;
            NProgress.done();
        } else {
            NProgress.set((initial - current) / initial);
        }
      });
      
      return this;
    };
    
  })();

  /**
   * (Internal) renders the progress bar markup based on the `template`
   * setting.
   */

  NProgress.render = function(fromStart) {
    if (NProgress.isRendered()) return document.getElementById('nprogress');

    addClass(document.documentElement, 'nprogress-busy');
    
    var progress = document.createElement('div');
    progress.id = 'nprogress';
    progress.innerHTML = Settings.template;

    var bar      = progress.querySelector(Settings.barSelector),
        perc     = fromStart ? '-100' : toBarPerc(NProgress.status || 0),
        spinner;
    
    css(bar, {
      transition: 'all 0 linear',
      transform: 'translate3d(' + perc + '%,0,0)'
    });

    if (!Settings.showSpinner) {
      spinner = progress.querySelector(Settings.spinnerSelector);
      spinner && removeElement(spinner);
    }

    document.body.appendChild(progress);
    return progress;
  };

  /**
   * Removes the element. Opposite of render().
   */

  NProgress.remove = function() {
    removeClass(document.documentElement, 'nprogress-busy');
    var progress = document.getElementById('nprogress');
    progress && removeElement(progress);
  };

  /**
   * Checks if the progress bar is rendered.
   */

  NProgress.isRendered = function() {
    return !!document.getElementById('nprogress');
  };

  /**
   * Determine which positioning CSS rule to use.
   */

  NProgress.getPositioningCSS = function() {
    // Sniff on document.body.style
    var bodyStyle = document.body.style;

    // Sniff prefixes
    var vendorPrefix = ('WebkitTransform' in bodyStyle) ? 'Webkit' :
                       ('MozTransform' in bodyStyle) ? 'Moz' :
                       ('msTransform' in bodyStyle) ? 'ms' :
                       ('OTransform' in bodyStyle) ? 'O' : '';

    if (vendorPrefix + 'Perspective' in bodyStyle) {
      // Modern browsers with 3D support, e.g. Webkit, IE10
      return 'translate3d';
    } else if (vendorPrefix + 'Transform' in bodyStyle) {
      // Browsers without 3D support, e.g. IE9
      return 'translate';
    } else {
      // Browsers without translate() support, e.g. IE7-8
      return 'margin';
    }
  };

  /**
   * Helpers
   */

  function clamp(n, min, max) {
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  /**
   * (Internal) converts a percentage (`0..1`) to a bar translateX
   * percentage (`-100%..0%`).
   */

  function toBarPerc(n) {
    return (-1 + n) * 100;
  }


  /**
   * (Internal) returns the correct CSS for changing the bar's
   * position given an n percentage, and speed and ease from Settings
   */

  function barPositionCSS(n, speed, ease) {
    var barCSS;

    if (Settings.positionUsing === 'translate3d') {
      barCSS = { transform: 'translate3d('+toBarPerc(n)+'%,0,0)' };
    } else if (Settings.positionUsing === 'translate') {
      barCSS = { transform: 'translate('+toBarPerc(n)+'%,0)' };
    } else {
      barCSS = { 'margin-left': toBarPerc(n)+'%' };
    }

    barCSS.transition = 'all '+speed+'ms '+ease;

    return barCSS;
  }

  /**
   * (Internal) Queues a function to be executed.
   */

  var queue = (function() {
    var pending = [];
    
    function next() {
      var fn = pending.shift();
      if (fn) {
        fn(next);
      }
    }

    return function(fn) {
      pending.push(fn);
      if (pending.length == 1) next();
    };
  })();

  /**
   * (Internal) Applies css properties to an element, similar to the jQuery 
   * css method.
   *
   * While this helper does assist with vendor prefixed property names, it 
   * does not perform any manipulation of values prior to setting styles.
   */

  var css = (function() {
    var cssPrefixes = [ 'Webkit', 'O', 'Moz', 'ms' ],
        cssProps    = {};

    function camelCase(string) {
      return string.replace(/^-ms-/, 'ms-').replace(/-([\da-z])/gi, function(match, letter) {
        return letter.toUpperCase();
      });
    }

    function getVendorProp(name) {
      var style = document.body.style;
      if (name in style) return name;

      var i = cssPrefixes.length,
          capName = name.charAt(0).toUpperCase() + name.slice(1),
          vendorName;
      while (i--) {
        vendorName = cssPrefixes[i] + capName;
        if (vendorName in style) return vendorName;
      }

      return name;
    }

    function getStyleProp(name) {
      name = camelCase(name);
      return cssProps[name] || (cssProps[name] = getVendorProp(name));
    }

    function applyCss(element, prop, value) {
      prop = getStyleProp(prop);
      element.style[prop] = value;
    }

    return function(element, properties) {
      var args = arguments,
          prop, 
          value;

      if (args.length == 2) {
        for (prop in properties) {
          value = properties[prop];
          if (value !== undefined && properties.hasOwnProperty(prop)) applyCss(element, prop, value);
        }
      } else {
        applyCss(element, args[1], args[2]);
      }
    }
  })();

  /**
   * (Internal) Determines if an element or space separated list of class names contains a class name.
   */

  function hasClass(element, name) {
    var list = typeof element == 'string' ? element : classList(element);
    return list.indexOf(' ' + name + ' ') >= 0;
  }

  /**
   * (Internal) Adds a class to an element.
   */

  function addClass(element, name) {
    var oldList = classList(element),
        newList = oldList + name;

    if (hasClass(oldList, name)) return; 

    // Trim the opening space.
    element.className = newList.substring(1);
  }

  /**
   * (Internal) Removes a class from an element.
   */

  function removeClass(element, name) {
    var oldList = classList(element),
        newList;

    if (!hasClass(element, name)) return;

    // Replace the class name.
    newList = oldList.replace(' ' + name + ' ', ' ');

    // Trim the opening and closing spaces.
    element.className = newList.substring(1, newList.length - 1);
  }

  /**
   * (Internal) Gets a space separated list of the class names on the element. 
   * The list is wrapped with a single space on each end to facilitate finding 
   * matches within the list.
   */

  function classList(element) {
    return (' ' + (element.className || '') + ' ').replace(/\s+/gi, ' ');
  }

  /**
   * (Internal) Removes an element from the DOM.
   */

  function removeElement(element) {
    element && element.parentNode && element.parentNode.removeChild(element);
  }

  return NProgress;
});

(function() {
  this.campo = {};

}).call(this);
(function() {
  $(document).on('click', '.comment [data-reply-to]', function() {
    var textarea;
    textarea = $('#new_comment textarea');
    textarea.focus();
    return textarea.val(textarea.val() + $(this).data('reply-to'));
  });

}).call(this);
(function() {
  campo.Likes = {
    updateLike: function(likeable, id, liked) {
      if (liked == null) {
        liked = true;
      }
      if (liked) {
        return $("#like-for-" + likeable + "-" + id).addClass('liked').data('method', 'delete');
      } else {
        return $("#like-for-" + likeable + "-" + id).removeClass('liked').data('method', 'post');
      }
    },
    updateLikes: function(likeable, ids, liked) {
      var id, _i, _len, _results;
      if (liked == null) {
        liked = true;
      }
      _results = [];
      for (_i = 0, _len = ids.length; _i < _len; _i++) {
        id = ids[_i];
        _results.push(this.updateLike(likeable, id, liked));
      }
      return _results;
    }
  };

}).call(this);
(function() {
  $(document).on('change', '.markdown-area .file-upload input[type=file]', function(event) {
    var textarea;
    textarea = $(this).closest('.markdown-area').find('textarea');
    $.each(event.target.files, function() {
      var after, before, fileName, formData, imageTag, pos;
      formData = new FormData();
      formData.append('attachment[file]', this);
      fileName = this.name;
      imageTag = "![" + fileName + "]()";
      pos = textarea[0].selectionStart;
      before = textarea.val().slice(0, pos);
      after = textarea.val().slice(pos, -1);
      if (before !== '') {
        before = before + "\n";
      }
      if (after !== '') {
        after = "\n" + after;
      }
      textarea.val(before + imageTag + after).trigger('autosize.resize');
      textarea[0].selectionStart = (before + imageTag).length;
      return $.ajax({
        url: '/attachments',
        type: 'POST',
        dataType: 'json',
        processData: false,
        contentType: false,
        data: formData,
        success: function(data) {
          var imagePos;
          pos = textarea[0].selectionStart;
          imagePos = textarea.val().indexOf(imageTag);
          textarea.val(textarea.val().replace(imageTag, "![" + fileName + "](" + data.url + ")")).trigger('autosize.resize');
          if (imagePos < pos) {
            return textarea[0].selectionStart = textarea[0].selectionEnd = pos + data.url.length;
          } else {
            return textarea[0].selectionStart = textarea[0].selectionEnd = pos;
          }
        }
      });
    });
    return $(this).replaceWith($(this).val('').clone());
  });

}).call(this);
(function() {
  $(document).popover({
    selector: '[data-behaviors~=pagination-popover]',
    content: function() {
      return $(this).siblings('.popover').find('.popover-content').html();
    },
    html: true
  });

}).call(this);
(function() {
  $(document).on('submit', 'form[method=get]:not([data-remote])', function(event) {
    var symbol;
    event.preventDefault();
    symbol = this.action.indexOf('?') === -1 ? '?' : '&';
    return Turbolinks.visit(this.action + symbol + $(this).serialize());
  });

}).call(this);
(function() {
  $.validator.setDefaults({
    highlight: function(element) {
      return $(element).closest(".form-group").addClass("has-error");
    },
    unhighlight: function(element) {
      return $(element).closest(".form-group").removeClass("has-error");
    },
    errorElement: "span",
    errorClass: "help-block",
    errorPlacement: function(error, element) {
      if (element.closest('.markdown-area').length) {
        return error.insertAfter(element.closest('.markdown-area'));
      } else if (element.parent('.input-group').length) {
        return error.insertAfter(element.parent());
      } else {
        return error.insertAfter(element);
      }
    }
  });

  jQuery.validator.addMethod("format", (function(value, element, param) {
    return this.optional(element) || param.test(value);
  }), "Please fix this field.");

}).call(this);
(function() {
  var __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  campo.VisibleTo = {
    check: function() {
      return $('[data-visible-to]').each(function() {
        var $element, creator_id, rules;
        $element = $(this);
        rules = $element.data('visible-to').split(/\s/);
        if (__indexOf.call(rules, 'user') >= 0) {
          if (campo.currentUser == null) {
            return $element.remove();
          }
        }
        if (__indexOf.call(rules, 'creator') >= 0) {
          creator_id = $element.closest('[data-creator-id]').data('creator-id');
          if ((campo.currentUser == null) || (campo.currentUser.id !== creator_id)) {
            return $element.remove();
          }
        }
        if (__indexOf.call(rules, 'no-creator') >= 0) {
          creator_id = $element.closest('[data-creator-id]').data('creator-id');
          if ((campo.currentUser != null) && (campo.currentUser.id === creator_id)) {
            return $element.remove();
          }
        }
      });
    }
  };

  $(document).on('page:update', function() {
    return campo.VisibleTo.check();
  });

}).call(this);
(function() {
  var Module, Plugin, Widget,
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Module = (function() {
    function Module() {}

    Module.extend = function(obj) {
      var key, val, _ref;
      if (!((obj != null) && typeof obj === 'object')) {
        return;
      }
      for (key in obj) {
        val = obj[key];
        if (key !== 'included' && key !== 'extended') {
          this[key] = val;
        }
      }
      return (_ref = obj.extended) != null ? _ref.call(this) : void 0;
    };

    Module.include = function(obj) {
      var key, val, _ref;
      if (!((obj != null) && typeof obj === 'object')) {
        return;
      }
      for (key in obj) {
        val = obj[key];
        if (key !== 'included' && key !== 'extended') {
          this.prototype[key] = val;
        }
      }
      return (_ref = obj.included) != null ? _ref.call(this) : void 0;
    };

    Module.prototype.on = function() {
      var args, _ref;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return (_ref = $(this)).on.apply(_ref, args);
    };

    Module.prototype.one = function() {
      var args, _ref;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return (_ref = $(this)).one.apply(_ref, args);
    };

    Module.prototype.off = function() {
      var args, _ref;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return (_ref = $(this)).off.apply(_ref, args);
    };

    Module.prototype.trigger = function() {
      var args, _ref;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return (_ref = $(this)).trigger.apply(_ref, args);
    };

    Module.prototype.triggerHandler = function() {
      var args, _ref;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return (_ref = $(this)).triggerHandler.apply(_ref, args);
    };

    return Module;

  })();

  Widget = (function(_super) {
    __extends(Widget, _super);

    Widget.connect = function(cls) {
      if (typeof cls !== 'function') {
        return;
      }
      if (!cls.className) {
        throw new Error('Widget.connect: lack of class property "className"');
        return;
      }
      if (!this._connectedClasses) {
        this._connectedClasses = [];
      }
      this._connectedClasses.push(cls);
      if (cls.className) {
        return this[cls.className] = cls;
      }
    };

    Widget.prototype._init = function() {};

    Widget.prototype.opts = {};

    function Widget(opts) {
      var cls, instance, instances, name, _base, _i, _len;
      this.opts = $.extend({}, this.opts, opts);
      (_base = this.constructor)._connectedClasses || (_base._connectedClasses = []);
      instances = (function() {
        var _i, _len, _ref, _results;
        _ref = this.constructor._connectedClasses;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          cls = _ref[_i];
          name = cls.className.charAt(0).toLowerCase() + cls.className.slice(1);
          _results.push(this[name] = new cls(this));
        }
        return _results;
      }).call(this);
      this._init();
      for (_i = 0, _len = instances.length; _i < _len; _i++) {
        instance = instances[_i];
        if (typeof instance._init === "function") {
          instance._init();
        }
      }
      this.trigger('pluginconnected');
    }

    Widget.prototype.destroy = function() {};

    return Widget;

  })(Module);

  Plugin = (function(_super) {
    __extends(Plugin, _super);

    Plugin.className = 'Plugin';

    Plugin.prototype.opts = {};

    function Plugin(widget) {
      this.widget = widget;
      this.opts = $.extend({}, this.opts, this.widget.opts);
    }

    Plugin.prototype._init = function() {};

    return Plugin;

  })(Module);

  window.Module = Module;

  window.Widget = Widget;

  window.Plugin = Plugin;

}).call(this);
(function() {
  var EmojiButton,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  EmojiButton = (function(_super) {
    __extends(EmojiButton, _super);

    EmojiButton.images = ['smile', 'smiley', 'laughing', 'blush', 'heart_eyes', 'smirk', 'flushed', 'satisfied', 'grin', 'wink', 'stuck_out_tongue_winking_eye', 'stuck_out_tongue', 'sleeping', 'worried', 'expressionless', 'sweat_smile', 'cold_sweat', 'joy', 'sob', 'angry', 'mask', 'scream', 'sunglasses', 'heart', 'broken_heart', 'star', 'anger', 'exclamation', 'question', 'zzz', 'thumbsup', 'thumbsdown', 'ok_hand', 'punch', 'v', 'clap', 'muscle', 'pray', 'skull', 'trollface'];

    EmojiButton.prototype.name = 'emoji';

    EmojiButton.prototype.icon = 'smile-o';

    EmojiButton.prototype.title = '表情';

    EmojiButton.prototype.htmlTag = 'img';

    EmojiButton.prototype.menu = true;

    function EmojiButton() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      EmojiButton.__super__.constructor.apply(this, args);
      $.merge(this.editor.formatter._allowedAttributes['img'], ['data-emoji', 'alt']);
    }

    EmojiButton.prototype.renderMenu = function() {
      var $list, dir, html, name, opts, tpl, _i, _len, _ref;
      tpl = '<ul class="emoji-list">\n</ul>';
      opts = $.extend({
        imagePath: 'images/emoji/',
        images: EmojiButton.images
      }, this.editor.opts.emoji || {});
      html = "";
      dir = opts.imagePath.replace(/\/$/, '') + '/';
      _ref = opts.images;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        name = _ref[_i];
        html += "<li data-name='" + name + "'><img src='" + dir + name + ".png' width='20' height='20' alt='" + name + "' /></li>";
      }
      $list = $(tpl);
      $list.html(html).appendTo(this.menuWrapper);
      return $list.on('mousedown', 'li', (function(_this) {
        return function(e) {
          var $img;
          _this.wrapper.removeClass('menu-on');
          if (!_this.editor.inputManager.focused) {
            return;
          }
          $img = $(e.currentTarget).find('img').clone().attr({
            'data-emoji': true,
            'data-non-image': true
          });
          _this.editor.selection.insertNode($img);
          _this.editor.trigger('valuechanged');
          _this.editor.trigger('selectionchanged');
          return false;
        };
      })(this));
    };

    return EmojiButton;

  })(SimditorButton);

  Simditor.Toolbar.addButton(EmojiButton);

}).call(this);
(function() {
  var VideoButton, VideoPopover,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  VideoButton = (function(_super) {
    __extends(VideoButton, _super);

    function VideoButton() {
      return VideoButton.__super__.constructor.apply(this, arguments);
    }

    VideoButton.prototype._videoTpl = '<p><embed allowFullScreen="true" quality="high" width="620" height="500" align="middle" allowScriptAccess="always" type="application/x-shockwave-flash" src="---video-src---"></embed></p>';

    VideoButton.prototype.name = 'video';

    VideoButton.prototype.icon = 'video-camera';

    VideoButton.prototype.title = '插入视频';

    VideoButton.prototype.htmlTag = 'embed';

    VideoButton.prototype.disableTag = 'pre, table';

    VideoButton.prototype.render = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      this.editor.formatter._allowedTags.push('embed');
      this.editor.formatter._allowedAttributes['embed'] = ['allowfullscreen', 'id', 'quality', 'width', 'height', 'align', 'src', 'type'];
      VideoButton.__super__.render.apply(this, args);
      return this.popover = new VideoPopover(this);
    };

    VideoButton.prototype.parseVideoSrc = function(src) {
      var videoSrc;
      videoSrc = false;
      if (src && src.match(/\.swf\b/)) {
        videoSrc = src;
      } else if (src) {
        $.ajax({
          url: "/getvideo?url=" + (encodeURIComponent(src)),
          dataType: 'json',
          async: false,
          type: 'GET',
          success: function(data) {
            if (data.flash.length > 0) {
              return videoSrc = data.flash;
            }
          }
        });
      }
      return videoSrc;
    };

    VideoButton.prototype.loadVideo = function(src, target) {
      var newBlockEl, range, videoNode, videoSrc;
      videoSrc = this.parseVideoSrc(src);
      if (!videoSrc) {
        return;
      }
      videoNode = $(this._videoTpl.replace('---video-src---', videoSrc));
      target.after(videoNode);
      newBlockEl = $('<p/>').append(this.editor.util.phBr);
      videoNode.after(newBlockEl);
      range = document.createRange();
      this.editor.selection.setRangeAtStartOf(newBlockEl, range);
      this.editor.trigger('valuechanged');
      return this.editor.trigger('selectionchanged');
    };

    VideoButton.prototype.command = function() {
      var $breakedEl, $endBlock, $startBlock, endNode, popoverTarget, range, startNode;
      range = this.editor.selection.getRange();
      startNode = range.startContainer;
      endNode = range.endContainer;
      $startBlock = this.editor.util.closestBlockEl(startNode);
      $endBlock = this.editor.util.closestBlockEl(endNode);
      range.deleteContents();
      if ($startBlock[0] === $endBlock[0]) {
        if ($startBlock.is('li')) {
          $startBlock = this.editor.util.furthestNode($startBlock, 'ul, ol');
          $endBlock = $startBlock;
          range.setEndAfter($startBlock[0]);
          range.collapse(false);
        } else if ($startBlock.is('p')) {
          if (this.editor.util.isEmptyNode($startBlock)) {
            range.selectNode($startBlock[0]);
            range.deleteContents();
          } else if (this.editor.selection.rangeAtEndOf($startBlock, range)) {
            range.setEndAfter($startBlock[0]);
            range.collapse(false);
          } else if (this.editor.selection.rangeAtStartOf($startBlock, range)) {
            range.setEndBefore($startBlock[0]);
            range.collapse(false);
          } else {
            $breakedEl = this.editor.selection.breakBlockEl($startBlock, range);
            range.setEndBefore($breakedEl[0]);
            range.collapse(false);
          }
        }
      }
      popoverTarget = $('</p>');
      this.editor.selection.insertNode(popoverTarget, range);
      return this.popover.show(popoverTarget);
    };

    return VideoButton;

  })(SimditorButton);

  Simditor.Toolbar.addButton(VideoButton);

  VideoPopover = (function(_super) {
    __extends(VideoPopover, _super);

    VideoPopover.prototype._tpl = "<div class=\"link-settings\">\n  <div class=\"settings-field\">\n    <label>视频地址</label>\n    <input class=\"video-src\" type=\"text\"/>\n    </a>\n  </div>\n</div>";

    function VideoPopover(button) {
      this.button = button;
      VideoPopover.__super__.constructor.call(this, this.button.editor);
    }

    VideoPopover.prototype.render = function() {
      this.el.addClass('video-popover').append(this._tpl);
      this.srcEl = this.el.find('.video-src');
      this.srcEl.on('keydown', (function(_this) {
        return function(e) {
          if (e.which === 13) {
            e.preventDefault();
            _this.button.loadVideo(_this.srcEl.val(), _this.target);
            return _this.srcEl.blur();
          }
        };
      })(this));
      return this.srcEl.on('blur', (function(_this) {
        return function() {
          _this.target.remove();
          return _this.hide();
        };
      })(this));
    };

    VideoPopover.prototype.show = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      VideoPopover.__super__.show.apply(this, args);
      this.srcEl.val('');
      return this.srcEl.focus();
    };

    return VideoPopover;

  })(SimditorPopover);

}).call(this);
(function() {
  var BlockquoteButton, BoldButton, Button, CodeButton, CodePopover, Formatter, HrButton, ImageButton, ImagePopover, IndentButton, InputManager, ItalicButton, Keystroke, LinkButton, LinkPopover, ListButton, OrderListButton, OutdentButton, Popover, Selection, Simditor, StrikethroughButton, TableButton, Test, TestPlugin, TitleButton, Toolbar, UnderlineButton, UndoManager, UnorderListButton, Util,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  Selection = (function(_super) {
    __extends(Selection, _super);

    Selection.className = 'Selection';

    function Selection() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      Selection.__super__.constructor.apply(this, args);
      this.sel = document.getSelection();
      this.editor = this.widget;
    }

    Selection.prototype._init = function() {};

    Selection.prototype.clear = function() {
      var e;
      try {
        return this.sel.removeAllRanges();
      } catch (_error) {
        e = _error;
      }
    };

    Selection.prototype.getRange = function() {
      if (!this.editor.inputManager.focused || !this.sel.rangeCount) {
        return null;
      }
      return this.sel.getRangeAt(0);
    };

    Selection.prototype.selectRange = function(range) {
      this.clear();
      this.sel.addRange(range);
      if (!this.editor.inputManager.focused && (this.editor.util.browser.firefox || this.editor.util.browser.msie)) {
        return this.editor.body.focus();
      }
    };

    Selection.prototype.rangeAtEndOf = function(node, range) {
      var endNode, endNodeLength, result;
      if (range == null) {
        range = this.getRange();
      }
      if (!((range != null) && range.collapsed)) {
        return;
      }
      node = $(node)[0];
      endNode = range.endContainer;
      endNodeLength = this.editor.util.getNodeLength(endNode);
      if (!(range.endOffset === endNodeLength - 1 && $(endNode).contents().last().is('br')) && range.endOffset !== endNodeLength) {
        return false;
      }
      if (node === endNode) {
        return true;
      } else if (!$.contains(node, endNode)) {
        return false;
      }
      result = true;
      $(endNode).parentsUntil(node).addBack().each((function(_this) {
        return function(i, n) {
          var $lastChild, nodes;
          nodes = $(n).parent().contents().filter(function() {
            return !(this !== n && this.nodeType === 3 && !this.nodeValue);
          });
          $lastChild = nodes.last();
          if (!($lastChild.get(0) === n || ($lastChild.is('br') && $lastChild.prev().get(0) === n))) {
            result = false;
            return false;
          }
        };
      })(this));
      return result;
    };

    Selection.prototype.rangeAtStartOf = function(node, range) {
      var result, startNode;
      if (range == null) {
        range = this.getRange();
      }
      if (!((range != null) && range.collapsed)) {
        return;
      }
      node = $(node)[0];
      startNode = range.startContainer;
      if (range.startOffset !== 0) {
        return false;
      }
      if (node === startNode) {
        return true;
      } else if (!$.contains(node, startNode)) {
        return false;
      }
      result = true;
      $(startNode).parentsUntil(node).addBack().each((function(_this) {
        return function(i, n) {
          var nodes;
          nodes = $(n).parent().contents().filter(function() {
            return !(this !== n && this.nodeType === 3 && !this.nodeValue);
          });
          if (nodes.first().get(0) !== n) {
            return result = false;
          }
        };
      })(this));
      return result;
    };

    Selection.prototype.insertNode = function(node, range) {
      if (range == null) {
        range = this.getRange();
      }
      if (range == null) {
        return;
      }
      node = $(node)[0];
      range.insertNode(node);
      return this.setRangeAfter(node, range);
    };

    Selection.prototype.setRangeAfter = function(node, range) {
      if (range == null) {
        range = this.getRange();
      }
      if (range == null) {
        return;
      }
      node = $(node)[0];
      range.setEndAfter(node);
      range.collapse(false);
      return this.selectRange(range);
    };

    Selection.prototype.setRangeBefore = function(node, range) {
      if (range == null) {
        range = this.getRange();
      }
      if (range == null) {
        return;
      }
      node = $(node)[0];
      range.setEndBefore(node);
      range.collapse(false);
      return this.selectRange(range);
    };

    Selection.prototype.setRangeAtStartOf = function(node, range) {
      if (range == null) {
        range = this.getRange();
      }
      node = $(node).get(0);
      range.setEnd(node, 0);
      range.collapse(false);
      return this.selectRange(range);
    };

    Selection.prototype.setRangeAtEndOf = function(node, range) {
      var $node, contents, lastChild, lastText, nodeLength;
      if (range == null) {
        range = this.getRange();
      }
      $node = $(node);
      node = $node.get(0);
      if ($node.is('pre')) {
        contents = $node.contents();
        if (contents.length > 0) {
          lastChild = contents.last();
          lastText = lastChild.text();
          if (lastText.charAt(lastText.length - 1) === '\n') {
            range.setEnd(lastChild[0], this.editor.util.getNodeLength(lastChild[0]) - 1);
          } else {
            range.setEnd(lastChild[0], this.editor.util.getNodeLength(lastChild[0]));
          }
        } else {
          range.setEnd(node, 0);
        }
      } else {
        nodeLength = this.editor.util.getNodeLength(node);
        if (node.nodeType !== 3 && nodeLength > 0 && $(node).contents().last().is('br')) {
          nodeLength -= 1;
        }
        range.setEnd(node, nodeLength);
      }
      range.collapse(false);
      return this.selectRange(range);
    };

    Selection.prototype.deleteRangeContents = function(range) {
      var endRange, startRange;
      if (range == null) {
        range = this.getRange();
      }
      startRange = range.cloneRange();
      endRange = range.cloneRange();
      startRange.collapse(true);
      endRange.collapse();
      if (!range.collapsed && this.rangeAtStartOf(this.editor.body, startRange) && this.rangeAtEndOf(this.editor.body, endRange)) {
        this.editor.body.empty();
        range.setStart(this.editor.body[0], 0);
        range.collapse(true);
        this.selectRange(range);
      } else {
        range.deleteContents();
      }
      return range;
    };

    Selection.prototype.breakBlockEl = function(el, range) {
      var $el;
      if (range == null) {
        range = this.getRange();
      }
      $el = $(el);
      if (!range.collapsed) {
        return $el;
      }
      range.setStartBefore($el.get(0));
      if (range.collapsed) {
        return $el;
      }
      return $el.before(range.extractContents());
    };

    Selection.prototype.save = function(range) {
      var endCaret, startCaret;
      if (range == null) {
        range = this.getRange();
      }
      if (this._selectionSaved) {
        return;
      }
      startCaret = $('<span/>').addClass('simditor-caret-start');
      endCaret = $('<span/>').addClass('simditor-caret-end');
      range.insertNode(startCaret[0]);
      range.collapse(false);
      range.insertNode(endCaret[0]);
      this.clear();
      return this._selectionSaved = true;
    };

    Selection.prototype.restore = function() {
      var endCaret, endContainer, endOffset, range, startCaret, startContainer, startOffset;
      if (!this._selectionSaved) {
        return false;
      }
      startCaret = this.editor.body.find('.simditor-caret-start');
      endCaret = this.editor.body.find('.simditor-caret-end');
      if (startCaret.length && endCaret.length) {
        startContainer = startCaret.parent();
        startOffset = startContainer.contents().index(startCaret);
        endContainer = endCaret.parent();
        endOffset = endContainer.contents().index(endCaret);
        if (startContainer[0] === endContainer[0]) {
          endOffset -= 1;
        }
        range = document.createRange();
        range.setStart(startContainer.get(0), startOffset);
        range.setEnd(endContainer.get(0), endOffset);
        startCaret.remove();
        endCaret.remove();
        this.selectRange(range);
      } else {
        startCaret.remove();
        endCaret.remove();
      }
      this._selectionSaved = false;
      return range;
    };

    return Selection;

  })(Plugin);

  Formatter = (function(_super) {
    __extends(Formatter, _super);

    Formatter.className = 'Formatter';

    function Formatter() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      Formatter.__super__.constructor.apply(this, args);
      this.editor = this.widget;
    }

    Formatter.prototype._init = function() {
      return this.editor.body.on('click', 'a', (function(_this) {
        return function(e) {
          return false;
        };
      })(this));
    };

    Formatter.prototype._allowedTags = ['br', 'a', 'img', 'b', 'strong', 'i', 'u', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'h1', 'h2', 'h3', 'h4', 'hr'];

    Formatter.prototype._allowedAttributes = {
      img: ['src', 'alt', 'width', 'height', 'data-image-src', 'data-image-size', 'data-image-name', 'data-non-image'],
      a: ['href', 'target'],
      pre: ['data-lang', 'class'],
      p: ['data-indent'],
      h1: ['data-indent'],
      h2: ['data-indent'],
      h3: ['data-indent'],
      h4: ['data-indent']
    };

    Formatter.prototype.decorate = function($el) {
      if ($el == null) {
        $el = this.editor.body;
      }
      return this.editor.trigger('decorate', [$el]);
    };

    Formatter.prototype.undecorate = function($el) {
      if ($el == null) {
        $el = this.editor.body.clone();
      }
      this.editor.trigger('undecorate', [$el]);
      return $.trim($el.html());
    };

    Formatter.prototype.autolink = function($el) {
      var $node, findLinkNode, lastIndex, linkNodes, match, re, replaceEls, text, uri, _i, _len;
      if ($el == null) {
        $el = this.editor.body;
      }
      linkNodes = [];
      findLinkNode = function($parentNode) {
        return $parentNode.contents().each(function(i, node) {
          var $node, text;
          $node = $(node);
          if ($node.is('a') || $node.closest('a', $el).length) {
            return;
          }
          if ($node.contents().length) {
            return findLinkNode($node);
          } else if ((text = $node.text()) && /https?:\/\/|www\./ig.test(text)) {
            return linkNodes.push($node);
          }
        });
      };
      findLinkNode($el);
      re = /(https?:\/\/|www\.)[\w\-\.\?&=\/#%:\!]+/ig;
      for (_i = 0, _len = linkNodes.length; _i < _len; _i++) {
        $node = linkNodes[_i];
        text = $node.text();
        replaceEls = [];
        match = null;
        lastIndex = 0;
        while ((match = re.exec(text)) !== null) {
          replaceEls.push(document.createTextNode(text.substring(lastIndex, match.index)));
          lastIndex = re.lastIndex;
          uri = /^(http(s)?:\/\/|\/)/.test(match[0]) ? match[0] : 'http://' + match[0];
          replaceEls.push($('<a href="' + uri + '" rel="nofollow">' + match[0] + '</a>')[0]);
        }
        replaceEls.push(document.createTextNode(text.substring(lastIndex)));
        $node.replaceWith($(replaceEls));
      }
      return $el;
    };

    Formatter.prototype.format = function($el) {
      var $node, blockNode, n, node, _i, _j, _len, _len1, _ref, _ref1;
      if ($el == null) {
        $el = this.editor.body;
      }
      if ($el.is(':empty')) {
        $el.append('<p>' + this.editor.util.phBr + '</p>');
        return $el;
      }
      _ref = $el.contents();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        n = _ref[_i];
        this.cleanNode(n, true);
      }
      _ref1 = $el.contents();
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        node = _ref1[_j];
        $node = $(node);
        if ($node.is('br')) {
          if (typeof blockNode !== "undefined" && blockNode !== null) {
            blockNode = null;
          }
          $node.remove();
        } else if (this.editor.util.isBlockNode(node)) {
          if ($node.is('li')) {
            if (blockNode && blockNode.is('ul, ol')) {
              blockNode.append(node);
            } else {
              blockNode = $('<ul/>').insertBefore(node);
              blockNode.append(node);
            }
          } else {
            blockNode = null;
          }
        } else {
          if (!blockNode || blockNode.is('ul, ol')) {
            blockNode = $('<p/>').insertBefore(node);
          }
          blockNode.append(node);
        }
      }
      return $el;
    };

    Formatter.prototype.cleanNode = function(node, recursive) {
      var $node, $p, $td, allowedAttributes, attr, contents, isDecoration, n, text, textNode, _i, _j, _len, _len1, _ref, _ref1;
      $node = $(node);
      if ($node[0].nodeType === 3) {
        text = $node.text().replace(/(\r\n|\n|\r)/gm, '');
        if (text) {
          textNode = document.createTextNode(text);
          $node.replaceWith(textNode);
        } else {
          $node.remove();
        }
        return;
      }
      contents = $node.contents();
      isDecoration = $node.is('[class^="simditor-"]');
      if ($node.is(this._allowedTags.join(',')) || isDecoration) {
        if ($node.is('a') && $node.find('img').length > 0) {
          contents.first().unwrap();
        }
        if ($node.is('img') && $node.hasClass('uploading')) {
          $node.remove();
        }
        if (!isDecoration) {
          allowedAttributes = this._allowedAttributes[$node[0].tagName.toLowerCase()];
          _ref = $.makeArray($node[0].attributes);
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            attr = _ref[_i];
            if (!((allowedAttributes != null) && (_ref1 = attr.name, __indexOf.call(allowedAttributes, _ref1) >= 0))) {
              $node.removeAttr(attr.name);
            }
          }
        }
      } else if ($node[0].nodeType === 1 && !$node.is(':empty')) {
        if ($node.is('div, article, dl, header, footer, tr')) {
          $node.append('<br/>');
          contents.first().unwrap();
        } else if ($node.is('table')) {
          $p = $('<p/>');
          $node.find('tr').each((function(_this) {
            return function(i, tr) {
              return $p.append($(tr).text() + '<br/>');
            };
          })(this));
          $node.replaceWith($p);
          contents = null;
        } else if ($node.is('thead, tfoot')) {
          $node.remove();
          contents = null;
        } else if ($node.is('th')) {
          $td = $('<td/>').append($node.contents());
          $node.replaceWith($td);
        } else {
          contents.first().unwrap();
        }
      } else {
        $node.remove();
        contents = null;
      }
      if (recursive && (contents != null) && !$node.is('pre')) {
        for (_j = 0, _len1 = contents.length; _j < _len1; _j++) {
          n = contents[_j];
          this.cleanNode(n, true);
        }
      }
      return null;
    };

    Formatter.prototype.clearHtml = function(html, lineBreak) {
      var container, contents, result;
      if (lineBreak == null) {
        lineBreak = true;
      }
      container = $('<div/>').append(html);
      contents = container.contents();
      result = '';
      contents.each((function(_this) {
        return function(i, node) {
          var $node;
          if (node.nodeType === 3) {
            return result += node.nodeValue;
          } else if (node.nodeType === 1) {
            $node = $(node);
            contents = $node.contents();
            if (contents.length > 0) {
              result += _this.clearHtml(contents);
            }
            if (lineBreak && i < contents.length - 1 && $node.is('br, p, div, li, tr, pre, address, artticle, aside, dl, figcaption, footer, h1, h2, h3, h4, header')) {
              return result += '\n';
            }
          }
        };
      })(this));
      return result;
    };

    Formatter.prototype.beautify = function($contents) {
      var uselessP;
      uselessP = function($el) {
        return !!($el.is('p') && !$el.text() && $el.children(':not(br)').length < 1);
      };
      return $contents.each((function(_this) {
        return function(i, el) {
          var $el;
          $el = $(el);
          if ($el.is(':not(img, br, col, td, hr, [class^="simditor-"]):empty')) {
            $el.remove();
          }
          if (uselessP($el)) {
            $el.remove();
          }
          return $el.find(':not(img, br, col, td, hr, [class^="simditor-"]):empty').remove();
        };
      })(this));
    };

    return Formatter;

  })(Plugin);

  InputManager = (function(_super) {
    __extends(InputManager, _super);

    InputManager.className = 'InputManager';

    InputManager.prototype.opts = {
      pasteImage: false
    };

    function InputManager() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      InputManager.__super__.constructor.apply(this, args);
      this.editor = this.widget;
      if (this.opts.pasteImage && typeof this.opts.pasteImage !== 'string') {
        this.opts.pasteImage = 'inline';
      }
    }

    InputManager.prototype._modifierKeys = [16, 17, 18, 91, 93, 224];

    InputManager.prototype._arrowKeys = [37, 38, 39, 40];

    InputManager.prototype._init = function() {
      this._pasteArea = $('<div/>').css({
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        position: 'fixed',
        right: '0',
        bottom: '100px'
      }).attr({
        tabIndex: '-1',
        contentEditable: true
      }).addClass('simditor-paste-area').appendTo(this.editor.el);
      this.editor.on('valuechanged', (function(_this) {
        return function() {
          return _this.editor.body.find('hr, pre, .simditor-table').each(function(i, el) {
            var $el, formatted;
            $el = $(el);
            if ($el.parent().is('blockquote') || $el.parent()[0] === _this.editor.body[0]) {
              formatted = false;
              if ($el.next().length === 0) {
                $('<p/>').append(_this.editor.util.phBr).insertAfter($el);
                formatted = true;
              }
              if ($el.prev().length === 0) {
                $('<p/>').append(_this.editor.util.phBr).insertBefore($el);
                formatted = true;
              }
              if (formatted) {
                return setTimeout(function() {
                  return _this.editor.trigger('valuechanged');
                }, 10);
              }
            }
          });
        };
      })(this));
      this.editor.body.on('keydown', $.proxy(this._onKeyDown, this)).on('keypress', $.proxy(this._onKeyPress, this)).on('keyup', $.proxy(this._onKeyUp, this)).on('mouseup', $.proxy(this._onMouseUp, this)).on('focus', $.proxy(this._onFocus, this)).on('blur', $.proxy(this._onBlur, this)).on('paste', $.proxy(this._onPaste, this)).on('drop', $.proxy(this._onDrop, this));
      if (this.editor.util.browser.firefox) {
        this.addShortcut('cmd+37', (function(_this) {
          return function(e) {
            e.preventDefault();
            _this.editor.selection.sel.modify('move', 'backward', 'lineboundary');
            return false;
          };
        })(this));
        this.addShortcut('cmd+39', (function(_this) {
          return function(e) {
            e.preventDefault();
            _this.editor.selection.sel.modify('move', 'forward', 'lineboundary');
            return false;
          };
        })(this));
      }
      if (this.editor.textarea.attr('autofocus')) {
        return setTimeout((function(_this) {
          return function() {
            return _this.editor.focus();
          };
        })(this), 0);
      }
    };

    InputManager.prototype._onFocus = function(e) {
      this.editor.el.addClass('focus').removeClass('error');
      this.focused = true;
      this.lastCaretPosition = null;
      return setTimeout((function(_this) {
        return function() {
          return _this.editor.triggerHandler('focus');
        };
      })(this), 0);
    };

    InputManager.prototype._onBlur = function(e) {
      var _ref;
      this.editor.el.removeClass('focus');
      this.editor.sync();
      this.focused = false;
      this.lastCaretPosition = (_ref = this.editor.undoManager.currentState()) != null ? _ref.caret : void 0;
      return this.editor.triggerHandler('blur');
    };

    InputManager.prototype._onMouseUp = function(e) {
      return setTimeout((function(_this) {
        return function() {
          _this.editor.trigger('selectionchanged');
          return _this.editor.undoManager.update();
        };
      })(this), 0);
    };

    InputManager.prototype._onKeyDown = function(e) {
      var $blockEl, metaKey, result, shortcutKey, _base, _ref, _ref1;
      if (this.editor.triggerHandler(e) === false) {
        return false;
      }
      shortcutKey = this.editor.util.getShortcutKey(e);
      if (this._shortcuts[shortcutKey]) {
        return this._shortcuts[shortcutKey].call(this, e);
      }
      if (e.which in this._keystrokeHandlers) {
        result = typeof (_base = this._keystrokeHandlers[e.which])['*'] === "function" ? _base['*'](e) : void 0;
        if (result) {
          this.editor.trigger('valuechanged');
          this.editor.trigger('selectionchanged');
          return false;
        }
        this.editor.util.traverseUp((function(_this) {
          return function(node) {
            var handler, _ref;
            if (node.nodeType !== 1) {
              return;
            }
            handler = (_ref = _this._keystrokeHandlers[e.which]) != null ? _ref[node.tagName.toLowerCase()] : void 0;
            result = typeof handler === "function" ? handler(e, $(node)) : void 0;
            return !result;
          };
        })(this));
        if (result) {
          this.editor.trigger('valuechanged');
          this.editor.trigger('selectionchanged');
          return false;
        }
      }
      if ((_ref = e.which, __indexOf.call(this._modifierKeys, _ref) >= 0) || (_ref1 = e.which, __indexOf.call(this._arrowKeys, _ref1) >= 0)) {
        return;
      }
      metaKey = this.editor.util.metaKey(e);
      $blockEl = this.editor.util.closestBlockEl();
      if (metaKey && e.which === 86) {
        return;
      }
      if (this._typing) {
        if (this._typing !== true) {
          clearTimeout(this._typing);
        }
        this._typing = setTimeout((function(_this) {
          return function() {
            _this.editor.trigger('valuechanged');
            _this.editor.trigger('selectionchanged');
            return _this._typing = false;
          };
        })(this), 200);
      } else {
        setTimeout((function(_this) {
          return function() {
            _this.editor.trigger('valuechanged');
            return _this.editor.trigger('selectionchanged');
          };
        })(this), 10);
        this._typing = true;
      }
      return null;
    };

    InputManager.prototype._onKeyPress = function(e) {
      if (this.editor.triggerHandler(e) === false) {
        return false;
      }
    };

    InputManager.prototype._onKeyUp = function(e) {
      var p, _ref;
      if (this.editor.triggerHandler(e) === false) {
        return false;
      }
      if (_ref = e.which, __indexOf.call(this._arrowKeys, _ref) >= 0) {
        this.editor.trigger('selectionchanged');
        this.editor.undoManager.update();
        return;
      }
      if (e.which === 8 && this.editor.util.isEmptyNode(this.editor.body)) {
        this.editor.body.empty();
        p = $('<p/>').append(this.editor.util.phBr).appendTo(this.editor.body);
        this.editor.selection.setRangeAtStartOf(p);
      }
    };

    InputManager.prototype._onPaste = function(e) {
      var $blockEl, cleanPaste, imageFile, pasteItem, range, uploadOpt, _ref;
      if (this.editor.triggerHandler(e) === false) {
        return false;
      }
      if (e.originalEvent.clipboardData && e.originalEvent.clipboardData.items && e.originalEvent.clipboardData.items.length > 0) {
        pasteItem = e.originalEvent.clipboardData.items[0];
        if (/^image\//.test(pasteItem.type)) {
          imageFile = pasteItem.getAsFile();
          if (!((imageFile != null) && this.opts.pasteImage)) {
            return;
          }
          if (!imageFile.name) {
            imageFile.name = "Clipboard Image.png";
          }
          uploadOpt = {};
          uploadOpt[this.opts.pasteImage] = true;
          if ((_ref = this.editor.uploader) != null) {
            _ref.upload(imageFile, uploadOpt);
          }
          return false;
        }
      }
      range = this.editor.selection.deleteRangeContents();
      if (!range.collapsed) {
        range.collapse(true);
      }
      $blockEl = this.editor.util.closestBlockEl();
      cleanPaste = $blockEl.is('pre, table');
      this.editor.selection.save(range);
      this._pasteArea.focus();
      return setTimeout((function(_this) {
        return function() {
          var $img, blob, children, insertPosition, lastLine, line, lines, node, pasteContent, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref1, _ref2;
          if (_this._pasteArea.is(':empty')) {
            pasteContent = null;
          } else if (cleanPaste) {
            pasteContent = _this.editor.formatter.clearHtml(_this._pasteArea.html());
          } else {
            pasteContent = $('<div/>').append(_this._pasteArea.contents());
            _this.editor.formatter.format(pasteContent);
            _this.editor.formatter.decorate(pasteContent);
            _this.editor.formatter.beautify(pasteContent.children());
            pasteContent = pasteContent.contents();
          }
          _this._pasteArea.empty();
          range = _this.editor.selection.restore();
          if (_this.editor.triggerHandler('pasting', [pasteContent]) === false) {
            return;
          }
          if (!pasteContent) {
            return;
          } else if (cleanPaste) {
            if ($blockEl.is('table')) {
              lines = pasteContent.split('\n');
              lastLine = lines.pop();
              for (_i = 0, _len = lines.length; _i < _len; _i++) {
                line = lines[_i];
                _this.editor.selection.insertNode(document.createTextNode(line));
                _this.editor.selection.insertNode($('<br/>'));
              }
              _this.editor.selection.insertNode(document.createTextNode(lastLine));
            } else {
              pasteContent = $('<div/>').text(pasteContent);
              console.log(pasteContent.contents());
              _ref1 = pasteContent.contents();
              for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
                node = _ref1[_j];
                _this.editor.selection.insertNode($(node)[0], range);
              }
            }
          } else if ($blockEl.is(_this.editor.body)) {
            for (_k = 0, _len2 = pasteContent.length; _k < _len2; _k++) {
              node = pasteContent[_k];
              _this.editor.selection.insertNode(node, range);
            }
          } else if (pasteContent.length < 1) {
            return;
          } else if (pasteContent.length === 1) {
            if (pasteContent.is('p')) {
              children = pasteContent.contents();
              if (children.length === 1 && children.is('img')) {
                $img = children;
                if (/^data:image/.test($img.attr('src'))) {
                  if (!_this.opts.pasteImage) {
                    return;
                  }
                  blob = _this.editor.util.dataURLtoBlob($img.attr("src"));
                  blob.name = "Clipboard Image.png";
                  uploadOpt = {};
                  uploadOpt[_this.opts.pasteImage] = true;
                  if ((_ref2 = _this.editor.uploader) != null) {
                    _ref2.upload(blob, uploadOpt);
                  }
                  return;
                } else if ($img.is('img[src^="webkit-fake-url://"]')) {
                  return;
                }
              } else {
                for (_l = 0, _len3 = children.length; _l < _len3; _l++) {
                  node = children[_l];
                  _this.editor.selection.insertNode(node, range);
                }
              }
            } else if ($blockEl.is('p') && _this.editor.util.isEmptyNode($blockEl)) {
              $blockEl.replaceWith(pasteContent);
              _this.editor.selection.setRangeAtEndOf(pasteContent, range);
            } else if (pasteContent.is('ul, ol') && $blockEl.is('li')) {
              $blockEl.parent().after(pasteContent);
              _this.editor.selection.setRangeAtEndOf(pasteContent, range);
            } else {
              $blockEl.after(pasteContent);
              _this.editor.selection.setRangeAtEndOf(pasteContent, range);
            }
          } else {
            if ($blockEl.is('li')) {
              $blockEl = $blockEl.parent();
            }
            if (_this.editor.selection.rangeAtStartOf($blockEl, range)) {
              insertPosition = 'before';
            } else if (_this.editor.selection.rangeAtEndOf($blockEl, range)) {
              insertPosition = 'after';
            } else {
              _this.editor.selection.breakBlockEl($blockEl, range);
              insertPosition = 'before';
            }
            $blockEl[insertPosition](pasteContent);
            _this.editor.selection.setRangeAtEndOf(pasteContent.last(), range);
          }
          _this.editor.trigger('valuechanged');
          return _this.editor.trigger('selectionchanged');
        };
      })(this), 10);
    };

    InputManager.prototype._onDrop = function(e) {
      if (this.editor.triggerHandler(e) === false) {
        return false;
      }
      return setTimeout((function(_this) {
        return function() {
          _this.editor.trigger('valuechanged');
          return _this.editor.trigger('selectionchanged');
        };
      })(this), 0);
    };

    InputManager.prototype._keystrokeHandlers = {};

    InputManager.prototype.addKeystrokeHandler = function(key, node, handler) {
      if (!this._keystrokeHandlers[key]) {
        this._keystrokeHandlers[key] = {};
      }
      return this._keystrokeHandlers[key][node] = handler;
    };

    InputManager.prototype._shortcuts = {
      'cmd+13': function(e) {
        this.editor.el.closest('form').find('button:submit').click();
        return false;
      }
    };

    InputManager.prototype.addShortcut = function(keys, handler) {
      return this._shortcuts[keys] = $.proxy(handler, this);
    };

    return InputManager;

  })(Plugin);

  Keystroke = (function(_super) {
    __extends(Keystroke, _super);

    Keystroke.className = 'Keystroke';

    function Keystroke() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      Keystroke.__super__.constructor.apply(this, args);
      this.editor = this.widget;
    }

    Keystroke.prototype._init = function() {
      var titleEnterHandler;
      if (this.editor.util.browser.safari) {
        this.editor.inputManager.addKeystrokeHandler('13', '*', (function(_this) {
          return function(e) {
            var $br;
            if (!e.shiftKey) {
              return;
            }
            $br = $('<br/>');
            if (_this.editor.selection.rangeAtEndOf($blockEl)) {
              _this.editor.selection.insertNode($br);
              _this.editor.selection.insertNode($('<br/>'));
              _this.editor.selection.setRangeBefore($br);
            } else {
              _this.editor.selection.insertNode($br);
            }
            return true;
          };
        })(this));
      }
      if (this.editor.util.browser.webkit || this.editor.util.browser.msie) {
        titleEnterHandler = (function(_this) {
          return function(e, $node) {
            var $p;
            if (!_this.editor.selection.rangeAtEndOf($node)) {
              return;
            }
            $p = $('<p/>').append(_this.editor.util.phBr).insertAfter($node);
            _this.editor.selection.setRangeAtStartOf($p);
            return true;
          };
        })(this);
        this.editor.inputManager.addKeystrokeHandler('13', 'h1', titleEnterHandler);
        this.editor.inputManager.addKeystrokeHandler('13', 'h2', titleEnterHandler);
        this.editor.inputManager.addKeystrokeHandler('13', 'h3', titleEnterHandler);
        this.editor.inputManager.addKeystrokeHandler('13', 'h4', titleEnterHandler);
        this.editor.inputManager.addKeystrokeHandler('13', 'h5', titleEnterHandler);
        this.editor.inputManager.addKeystrokeHandler('13', 'h6', titleEnterHandler);
      }
      this.editor.inputManager.addKeystrokeHandler('8', '*', (function(_this) {
        return function(e) {
          var $prevBlockEl, $rootBlock;
          $rootBlock = _this.editor.util.furthestBlockEl();
          $prevBlockEl = $rootBlock.prev();
          if ($prevBlockEl.is('hr') && _this.editor.selection.rangeAtStartOf($rootBlock)) {
            _this.editor.selection.save();
            $prevBlockEl.remove();
            _this.editor.selection.restore();
            return true;
          }
        };
      })(this));
      this.editor.inputManager.addKeystrokeHandler('9', '*', (function(_this) {
        return function(e) {
          if (!_this.editor.opts.tabIndent) {
            return;
          }
          if (e.shiftKey) {
            _this.editor.util.outdent();
          } else {
            _this.editor.util.indent();
          }
          return true;
        };
      })(this));
      this.editor.inputManager.addKeystrokeHandler('13', 'li', (function(_this) {
        return function(e, $node) {
          var $cloneNode, listEl, newBlockEl, newListEl;
          $cloneNode = $node.clone();
          $cloneNode.find('ul, ol').remove();
          if (!(_this.editor.util.isEmptyNode($cloneNode) && $node.is(_this.editor.util.closestBlockEl()))) {
            return;
          }
          listEl = $node.parent();
          if ($node.next('li').length > 0) {
            if (!_this.editor.util.isEmptyNode($node)) {
              return;
            }
            if (listEl.parent('li').length > 0) {
              newBlockEl = $('<li/>').append(_this.editor.util.phBr).insertAfter(listEl.parent('li'));
              newListEl = $('<' + listEl[0].tagName + '/>').append($node.nextAll('li'));
              newBlockEl.append(newListEl);
            } else {
              newBlockEl = $('<p/>').append(_this.editor.util.phBr).insertAfter(listEl);
              newListEl = $('<' + listEl[0].tagName + '/>').append($node.nextAll('li'));
              newBlockEl.after(newListEl);
            }
          } else {
            if (listEl.parent('li').length > 0) {
              newBlockEl = $('<li/>').insertAfter(listEl.parent('li'));
              if ($node.contents().length > 0) {
                newBlockEl.append($node.contents());
              } else {
                newBlockEl.append(_this.editor.util.phBr);
              }
            } else {
              newBlockEl = $('<p/>').append(_this.editor.util.phBr).insertAfter(listEl);
              if ($node.children('ul, ol').length > 0) {
                newBlockEl.after($node.children('ul, ol'));
              }
            }
          }
          if ($node.prev('li').length) {
            $node.remove();
          } else {
            listEl.remove();
          }
          _this.editor.selection.setRangeAtStartOf(newBlockEl);
          return true;
        };
      })(this));
      this.editor.inputManager.addKeystrokeHandler('13', 'pre', (function(_this) {
        return function(e, $node) {
          var breakNode, range;
          e.preventDefault();
          range = _this.editor.selection.getRange();
          breakNode = null;
          range.deleteContents();
          if (!_this.editor.util.browser.msie && _this.editor.selection.rangeAtEndOf($node)) {
            breakNode = document.createTextNode('\n\n');
            range.insertNode(breakNode);
            range.setEnd(breakNode, 1);
          } else {
            breakNode = document.createTextNode('\n');
            range.insertNode(breakNode);
            range.setStartAfter(breakNode);
          }
          range.collapse(false);
          _this.editor.selection.selectRange(range);
          return true;
        };
      })(this));
      this.editor.inputManager.addKeystrokeHandler('13', 'blockquote', (function(_this) {
        return function(e, $node) {
          var $closestBlock;
          $closestBlock = _this.editor.util.closestBlockEl();
          if (!($closestBlock.is('p') && !$closestBlock.next().length && _this.editor.util.isEmptyNode($closestBlock))) {
            return;
          }
          $node.after($closestBlock);
          _this.editor.selection.setRangeAtStartOf($closestBlock);
          return true;
        };
      })(this));
      this.editor.inputManager.addKeystrokeHandler('8', 'li', (function(_this) {
        return function(e, $node) {
          var $br, $childList, $newLi, $prevChildList, $prevNode, $textNode, range, text;
          $childList = $node.children('ul, ol');
          $prevNode = $node.prev('li');
          if (!($childList.length > 0 && $prevNode.length > 0)) {
            return;
          }
          text = '';
          $textNode = null;
          $node.contents().each(function(i, n) {
            if (n.nodeType === 3 && n.nodeValue) {
              text += n.nodeValue;
              return $textNode = $(n);
            }
          });
          if ($textNode && text.length === 1 && _this.editor.util.browser.firefox && !$textNode.next('br').length) {
            $br = $(_this.editor.util.phBr).insertAfter($textNode);
            $textNode.remove();
            _this.editor.selection.setRangeBefore($br);
            return true;
          } else if (text.length > 0) {
            return;
          }
          range = document.createRange();
          $prevChildList = $prevNode.children('ul, ol');
          if ($prevChildList.length > 0) {
            $newLi = $('<li/>').append(_this.editor.util.phBr).appendTo($prevChildList);
            $prevChildList.append($childList.children('li'));
            $node.remove();
            _this.editor.selection.setRangeAtEndOf($newLi, range);
          } else {
            _this.editor.selection.setRangeAtEndOf($prevNode, range);
            $prevNode.append($childList);
            $node.remove();
            _this.editor.selection.selectRange(range);
          }
          return true;
        };
      })(this));
      this.editor.inputManager.addKeystrokeHandler('8', 'pre', (function(_this) {
        return function(e, $node) {
          var $newNode, codeStr;
          if (!_this.editor.selection.rangeAtStartOf($node)) {
            return;
          }
          codeStr = $node.html().replace('\n', '<br/>');
          $newNode = $('<p/>').append(codeStr || _this.editor.util.phBr).insertAfter($node);
          $node.remove();
          _this.editor.selection.setRangeAtStartOf($newNode);
          return true;
        };
      })(this));
      return this.editor.inputManager.addKeystrokeHandler('8', 'blockquote', (function(_this) {
        return function(e, $node) {
          var $firstChild;
          if (!_this.editor.selection.rangeAtStartOf($node)) {
            return;
          }
          $firstChild = $node.children().first().unwrap();
          _this.editor.selection.setRangeAtStartOf($firstChild);
          return true;
        };
      })(this));
    };

    return Keystroke;

  })(Plugin);

  UndoManager = (function(_super) {
    __extends(UndoManager, _super);

    UndoManager.className = 'UndoManager';

    UndoManager.prototype._stack = [];

    UndoManager.prototype._index = -1;

    UndoManager.prototype._capacity = 50;

    UndoManager.prototype._timer = null;

    function UndoManager() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      UndoManager.__super__.constructor.apply(this, args);
      this.editor = this.widget;
    }

    UndoManager.prototype._init = function() {
      var redoShortcut, undoShortcut;
      if (this.editor.util.os.mac) {
        undoShortcut = 'cmd+90';
        redoShortcut = 'shift+cmd+90';
      } else if (this.editor.util.os.win) {
        undoShortcut = 'ctrl+90';
        redoShortcut = 'ctrl+89';
      } else {
        undoShortcut = 'ctrl+90';
        redoShortcut = 'shift+ctrl+90';
      }
      this.editor.inputManager.addShortcut(undoShortcut, (function(_this) {
        return function(e) {
          e.preventDefault();
          _this.undo();
          return false;
        };
      })(this));
      this.editor.inputManager.addShortcut(redoShortcut, (function(_this) {
        return function(e) {
          e.preventDefault();
          _this.redo();
          return false;
        };
      })(this));
      return this.editor.on('valuechanged', (function(_this) {
        return function(e, src) {
          if (src === 'undo') {
            return;
          }
          if (_this._timer) {
            clearTimeout(_this._timer);
            _this._timer = null;
          }
          return _this._timer = setTimeout(function() {
            return _this._pushUndoState();
          }, 200);
        };
      })(this));
    };

    UndoManager.prototype._pushUndoState = function() {
      var currentState, html;
      currentState = this.currentState();
      html = this.editor.body.html();
      if (currentState && currentState.html === html) {
        return;
      }
      this._index += 1;
      this._stack.length = this._index;
      this._stack.push({
        html: html,
        caret: this.caretPosition()
      });
      if (this._stack.length > this._capacity) {
        this._stack.shift();
        return this._index -= 1;
      }
    };

    UndoManager.prototype.currentState = function() {
      if (this._stack.length && this._index > -1) {
        return this._stack[this._index];
      } else {
        return null;
      }
    };

    UndoManager.prototype.undo = function() {
      var state;
      if (this._index < 1 || this._stack.length < 2) {
        return;
      }
      this.editor.hidePopover();
      this._index -= 1;
      state = this._stack[this._index];
      this.editor.body.html(state.html);
      this.caretPosition(state.caret);
      this.editor.body.find('.selected').removeClass('selected');
      this.editor.sync();
      this.editor.trigger('valuechanged', ['undo']);
      return this.editor.trigger('selectionchanged', ['undo']);
    };

    UndoManager.prototype.redo = function() {
      var state;
      if (this._index < 0 || this._stack.length < this._index + 2) {
        return;
      }
      this.editor.hidePopover();
      this._index += 1;
      state = this._stack[this._index];
      this.editor.body.html(state.html);
      this.caretPosition(state.caret);
      this.editor.body.find('.selected').removeClass('selected');
      this.editor.sync();
      this.editor.trigger('valuechanged', ['undo']);
      return this.editor.trigger('selectionchanged', ['undo']);
    };

    UndoManager.prototype.update = function() {
      var currentState, html;
      currentState = this.currentState();
      if (!currentState) {
        return;
      }
      html = this.editor.body.html();
      currentState.html = html;
      return currentState.caret = this.caretPosition();
    };

    UndoManager.prototype._getNodeOffset = function(node, index) {
      var $parent, merging, offset;
      if (index) {
        $parent = $(node);
      } else {
        $parent = $(node).parent();
      }
      offset = 0;
      merging = false;
      $parent.contents().each((function(_this) {
        return function(i, child) {
          if (index === i || node === child) {
            return false;
          }
          if (child.nodeType === 3) {
            if (!merging) {
              offset += 1;
              merging = true;
            }
          } else {
            offset += 1;
            merging = false;
          }
          return null;
        };
      })(this));
      return offset;
    };

    UndoManager.prototype._getNodePosition = function(node, offset) {
      var position, prevNode;
      if (node.nodeType === 3) {
        prevNode = node.previousSibling;
        while (prevNode && prevNode.nodeType === 3) {
          node = prevNode;
          offset += this.editor.util.getNodeLength(prevNode);
          prevNode = prevNode.previousSibling;
        }
      } else {
        offset = this._getNodeOffset(node, offset);
      }
      position = [];
      position.unshift(offset);
      this.editor.util.traverseUp((function(_this) {
        return function(n) {
          return position.unshift(_this._getNodeOffset(n));
        };
      })(this), node);
      return position;
    };

    UndoManager.prototype._getNodeByPosition = function(position) {
      var child, childNodes, i, node, offset, _i, _len, _ref;
      node = this.editor.body[0];
      _ref = position.slice(0, position.length - 1);
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        offset = _ref[i];
        childNodes = node.childNodes;
        if (offset > childNodes.length - 1) {
          if (i === position.length - 2 && $(node).is('pre')) {
            child = document.createTextNode('');
            node.appendChild(child);
            childNodes = node.childNodes;
          } else {
            node = null;
            break;
          }
        }
        node = childNodes[offset];
      }
      return node;
    };

    UndoManager.prototype.caretPosition = function(caret) {
      var endContainer, endOffset, range, startContainer, startOffset;
      if (!caret) {
        range = this.editor.selection.getRange();
        if (!(this.editor.inputManager.focused && (range != null))) {
          return {};
        }
        caret = {
          start: [],
          end: null,
          collapsed: true
        };
        caret.start = this._getNodePosition(range.startContainer, range.startOffset);
        if (!range.collapsed) {
          caret.end = this._getNodePosition(range.endContainer, range.endOffset);
          caret.collapsed = false;
        }
        return caret;
      } else {
        if (!this.editor.inputManager.focused) {
          this.editor.body.focus();
        }
        if (!caret.start) {
          this.editor.body.blur();
          return;
        }
        startContainer = this._getNodeByPosition(caret.start);
        startOffset = caret.start[caret.start.length - 1];
        if (caret.collapsed) {
          endContainer = startContainer;
          endOffset = startOffset;
        } else {
          endContainer = this._getNodeByPosition(caret.end);
          endOffset = caret.start[caret.start.length - 1];
        }
        if (!startContainer || !endContainer) {
          throw new Error('simditor: invalid caret state');
          return;
        }
        range = document.createRange();
        range.setStart(startContainer, startOffset);
        range.setEnd(endContainer, endOffset);
        return this.editor.selection.selectRange(range);
      }
    };

    return UndoManager;

  })(Plugin);

  Util = (function(_super) {
    __extends(Util, _super);

    Util.className = 'Util';

    function Util() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      Util.__super__.constructor.apply(this, args);
      if (this.browser.msie && this.browser.version < 11) {
        this.phBr = '';
      }
      this.editor = this.widget;
    }

    Util.prototype._init = function() {};

    Util.prototype.phBr = '<br/>';

    Util.prototype.os = (function() {
      if (/Mac/.test(navigator.appVersion)) {
        return {
          mac: true
        };
      } else if (/Linux/.test(navigator.appVersion)) {
        return {
          linux: true
        };
      } else if (/Win/.test(navigator.appVersion)) {
        return {
          win: true
        };
      } else if (/X11/.test(navigator.appVersion)) {
        return {
          unix: true
        };
      } else {
        return {};
      }
    })();

    Util.prototype.browser = (function() {
      var chrome, firefox, ie, safari, ua;
      ua = navigator.userAgent;
      ie = /(msie|trident)/i.test(ua);
      chrome = /chrome|crios/i.test(ua);
      safari = /safari/i.test(ua) && !chrome;
      firefox = /firefox/i.test(ua);
      if (ie) {
        return {
          msie: true,
          version: ua.match(/(msie |rv:)(\d+(\.\d+)?)/i)[2]
        };
      } else if (chrome) {
        return {
          webkit: true,
          chrome: true,
          version: ua.match(/(?:chrome|crios)\/(\d+(\.\d+)?)/i)[1]
        };
      } else if (safari) {
        return {
          webkit: true,
          safari: true,
          version: ua.match(/version\/(\d+(\.\d+)?)/i)[1]
        };
      } else if (firefox) {
        return {
          mozilla: true,
          firefox: true,
          version: ua.match(/firefox\/(\d+(\.\d+)?)/i)[1]
        };
      } else {
        return {};
      }
    })();

    Util.prototype.metaKey = function(e) {
      var isMac;
      isMac = /Mac/.test(navigator.userAgent);
      if (isMac) {
        return e.metaKey;
      } else {
        return e.ctrlKey;
      }
    };

    Util.prototype.isEmptyNode = function(node) {
      var $node;
      $node = $(node);
      return $node.is(':empty') || (!$node.text() && !$node.find(':not(br, span, div)').length);
    };

    Util.prototype.isBlockNode = function(node) {
      node = $(node)[0];
      if (!node || node.nodeType === 3) {
        return false;
      }
      return /^(div|p|ul|ol|li|blockquote|hr|pre|h1|h2|h3|h4|table)$/.test(node.nodeName.toLowerCase());
    };

    Util.prototype.closestBlockEl = function(node) {
      var $node, blockEl, range;
      if (node == null) {
        range = this.editor.selection.getRange();
        node = range != null ? range.commonAncestorContainer : void 0;
      }
      $node = $(node);
      if (!$node.length) {
        return null;
      }
      blockEl = $node.parentsUntil(this.editor.body).addBack();
      blockEl = blockEl.filter((function(_this) {
        return function(i) {
          return _this.isBlockNode(blockEl.eq(i));
        };
      })(this));
      if (blockEl.length) {
        return blockEl.last();
      } else {
        return null;
      }
    };

    Util.prototype.furthestNode = function(node, filter) {
      var $node, blockEl, range;
      if (node == null) {
        range = this.editor.selection.getRange();
        node = range != null ? range.commonAncestorContainer : void 0;
      }
      $node = $(node);
      if (!$node.length) {
        return null;
      }
      blockEl = $node.parentsUntil(this.editor.body).addBack();
      blockEl = blockEl.filter((function(_this) {
        return function(i) {
          var $n;
          $n = blockEl.eq(i);
          if ($.isFunction(filter)) {
            return filter($n);
          } else {
            return $n.is(filter);
          }
        };
      })(this));
      if (blockEl.length) {
        return blockEl.first();
      } else {
        return null;
      }
    };

    Util.prototype.furthestBlockEl = function(node) {
      return this.furthestNode(node, this.isBlockNode);
    };

    Util.prototype.getNodeLength = function(node) {
      switch (node.nodeType) {
        case 7:
        case 10:
          return 0;
        case 3:
        case 8:
          return node.length;
        default:
          return node.childNodes.length;
      }
    };

    Util.prototype.traverseUp = function(callback, node) {
      var n, nodes, range, result, _i, _len, _results;
      if (node == null) {
        range = this.editor.selection.getRange();
        node = range != null ? range.commonAncestorContainer : void 0;
      }
      if ((node == null) || !$.contains(this.editor.body[0], node)) {
        return false;
      }
      nodes = $(node).parentsUntil(this.editor.body).get();
      nodes.unshift(node);
      _results = [];
      for (_i = 0, _len = nodes.length; _i < _len; _i++) {
        n = nodes[_i];
        result = callback(n);
        if (result === false) {
          break;
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Util.prototype.getShortcutKey = function(e) {
      var shortcutName;
      shortcutName = [];
      if (e.shiftKey) {
        shortcutName.push('shift');
      }
      if (e.ctrlKey) {
        shortcutName.push('ctrl');
      }
      if (e.altKey) {
        shortcutName.push('alt');
      }
      if (e.metaKey) {
        shortcutName.push('cmd');
      }
      shortcutName.push(e.which);
      return shortcutName.join('+');
    };

    Util.prototype.indent = function() {
      var $blockEl, $childList, $nextTd, $parentLi, $td, indentLevel, range, spaceNode, tagName, _ref;
      $blockEl = this.editor.util.closestBlockEl();
      if (!($blockEl && $blockEl.length > 0)) {
        return false;
      }
      if ($blockEl.is('pre')) {
        spaceNode = document.createTextNode('\u00A0\u00A0');
        this.editor.selection.insertNode(spaceNode);
      } else if ($blockEl.is('li')) {
        $parentLi = $blockEl.prev('li');
        if ($parentLi.length < 1) {
          return false;
        }
        this.editor.selection.save();
        tagName = $blockEl.parent()[0].tagName;
        $childList = $parentLi.children('ul, ol');
        if ($childList.length > 0) {
          $childList.append($blockEl);
        } else {
          $('<' + tagName + '/>').append($blockEl).appendTo($parentLi);
        }
        this.editor.selection.restore();
      } else if ($blockEl.is('p, h1, h2, h3, h4')) {
        indentLevel = (_ref = $blockEl.attr('data-indent')) != null ? _ref : 0;
        indentLevel = indentLevel * 1 + 1;
        if (indentLevel > 10) {
          indentLevel = 10;
        }
        $blockEl.attr('data-indent', indentLevel);
      } else if ($blockEl.is('table')) {
        range = this.editor.selection.getRange();
        $td = $(range.commonAncestorContainer).closest('td');
        $nextTd = $td.next('td');
        if (!($nextTd.length > 0)) {
          $nextTd = $td.parent('tr').next('tr').find('td:first');
        }
        if (!($td.length > 0 && $nextTd.length > 0)) {
          return false;
        }
        this.editor.selection.setRangeAtEndOf($nextTd);
      } else {
        spaceNode = document.createTextNode('\u00A0\u00A0\u00A0\u00A0');
        this.editor.selection.insertNode(spaceNode);
      }
      this.editor.trigger('valuechanged');
      this.editor.trigger('selectionchanged');
      return true;
    };

    Util.prototype.outdent = function() {
      var $blockEl, $parent, $parentLi, $prevTd, $td, button, indentLevel, range, _ref;
      $blockEl = this.editor.util.closestBlockEl();
      if (!($blockEl && $blockEl.length > 0)) {
        return false;
      }
      if ($blockEl.is('pre')) {
        return false;
      } else if ($blockEl.is('li')) {
        $parent = $blockEl.parent();
        $parentLi = $parent.parent('li');
        if ($parentLi.length < 1) {
          button = this.editor.toolbar.findButton($parent[0].tagName.toLowerCase());
          if (button != null) {
            button.command();
          }
          return false;
        }
        this.editor.selection.save();
        if ($blockEl.next('li').length > 0) {
          $('<' + $parent[0].tagName + '/>').append($blockEl.nextAll('li')).appendTo($blockEl);
        }
        $blockEl.insertAfter($parentLi);
        if ($parent.children('li').length < 1) {
          $parent.remove();
        }
        this.editor.selection.restore();
      } else if ($blockEl.is('p, h1, h2, h3, h4')) {
        indentLevel = (_ref = $blockEl.attr('data-indent')) != null ? _ref : 0;
        indentLevel = indentLevel * 1 - 1;
        if (indentLevel < 0) {
          indentLevel = 0;
        }
        $blockEl.attr('data-indent', indentLevel);
      } else if ($blockEl.is('table')) {
        range = this.editor.selection.getRange();
        $td = $(range.commonAncestorContainer).closest('td');
        $prevTd = $td.prev('td');
        if (!($prevTd.length > 0)) {
          $prevTd = $td.parent('tr').prev('tr').find('td:last');
        }
        if (!($td.length > 0 && $prevTd.length > 0)) {
          return false;
        }
        this.editor.selection.setRangeAtEndOf($prevTd);
      } else {
        return false;
      }
      this.editor.trigger('valuechanged');
      this.editor.trigger('selectionchanged');
      return true;
    };

    Util.prototype.dataURLtoBlob = function(dataURL) {
      var BlobBuilder, arrayBuffer, bb, byteString, hasArrayBufferViewSupport, hasBlobConstructor, i, intArray, mimeString, _i, _ref;
      hasBlobConstructor = window.Blob && (function() {
        var e;
        try {
          return Boolean(new Blob());
        } catch (_error) {
          e = _error;
          return false;
        }
      })();
      hasArrayBufferViewSupport = hasBlobConstructor && window.Uint8Array && (function() {
        var e;
        try {
          return new Blob([new Uint8Array(100)]).size === 100;
        } catch (_error) {
          e = _error;
          return false;
        }
      })();
      BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
      if (!((hasBlobConstructor || BlobBuilder) && window.atob && window.ArrayBuffer && window.Uint8Array)) {
        return false;
      }
      if (dataURL.split(',')[0].indexOf('base64') >= 0) {
        byteString = atob(dataURL.split(',')[1]);
      } else {
        byteString = decodeURIComponent(dataURL.split(',')[1]);
      }
      arrayBuffer = new ArrayBuffer(byteString.length);
      intArray = new Uint8Array(arrayBuffer);
      for (i = _i = 0, _ref = byteString.length; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
        intArray[i] = byteString.charCodeAt(i);
      }
      mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
      if (hasBlobConstructor) {
        return new Blob([hasArrayBufferViewSupport ? intArray : arrayBuffer], {
          type: mimeString
        });
      }
      bb = new BlobBuilder();
      bb.append(arrayBuffer);
      return bb.getBlob(mimeString);
    };

    return Util;

  })(Plugin);

  Toolbar = (function(_super) {
    __extends(Toolbar, _super);

    Toolbar.className = 'Toolbar';

    Toolbar.prototype.opts = {
      toolbar: true,
      toolbarFloat: true
    };

    Toolbar.prototype._tpl = {
      wrapper: '<div class="simditor-toolbar"><ul></ul></div>',
      separator: '<li><span class="separator"></span></li>'
    };

    function Toolbar() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      Toolbar.__super__.constructor.apply(this, args);
      this.editor = this.widget;
    }

    Toolbar.prototype._init = function() {
      if (!this.opts.toolbar) {
        return;
      }
      if (!$.isArray(this.opts.toolbar)) {
        this.opts.toolbar = ['bold', 'italic', 'underline', 'strikethrough', '|', 'ol', 'ul', 'blockquote', 'code', '|', 'link', 'image', '|', 'indent', 'outdent'];
      }
      this._render();
      this.list.on('click', (function(_this) {
        return function(e) {
          return false;
        };
      })(this));
      this.wrapper.on('mousedown', (function(_this) {
        return function(e) {
          return _this.list.find('.menu-on').removeClass('.menu-on');
        };
      })(this));
      $(document).on('mousedown.simditor', (function(_this) {
        return function(e) {
          return _this.list.find('.menu-on').removeClass('.menu-on');
        };
      })(this));
      if (this.opts.toolbarFloat) {
        this.wrapper.width(this.wrapper.outerWidth());
        this.wrapper.css('left', this.wrapper.offset().left);
        $(window).on('scroll.simditor-' + this.editor.id, (function(_this) {
          return function(e) {
            var bottomEdge, scrollTop, topEdge;
            topEdge = _this.editor.wrapper.offset().top;
            bottomEdge = topEdge + _this.editor.wrapper.outerHeight() - 80;
            scrollTop = $(document).scrollTop();
            if (scrollTop <= topEdge || scrollTop >= bottomEdge) {
              return _this.editor.wrapper.removeClass('toolbar-floating');
            } else {
              return _this.editor.wrapper.addClass('toolbar-floating');
            }
          };
        })(this));
      }
      this.editor.on('selectionchanged focus', (function(_this) {
        return function() {
          return _this.toolbarStatus();
        };
      })(this));
      this.editor.on('destroy', (function(_this) {
        return function() {
          return _this.buttons.length = 0;
        };
      })(this));
      return $(document).on('mousedown.simditor-' + this.editor.id, (function(_this) {
        return function(e) {
          return _this.list.find('li.menu-on').removeClass('menu-on');
        };
      })(this));
    };

    Toolbar.prototype._render = function() {
      var name, _i, _len, _ref, _results;
      this.buttons = [];
      this.wrapper = $(this._tpl.wrapper).prependTo(this.editor.wrapper);
      this.list = this.wrapper.find('ul');
      _ref = this.opts.toolbar;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        name = _ref[_i];
        if (name === '|') {
          $(this._tpl.separator).appendTo(this.list);
          continue;
        }
        if (!this.constructor.buttons[name]) {
          throw new Error('simditor: invalid toolbar button "' + name + '"');
          continue;
        }
        _results.push(this.buttons.push(new this.constructor.buttons[name](this.editor)));
      }
      return _results;
    };

    Toolbar.prototype.toolbarStatus = function(name) {
      var buttons;
      if (!this.editor.inputManager.focused) {
        return;
      }
      buttons = this.buttons.slice(0);
      return this.editor.util.traverseUp((function(_this) {
        return function(node) {
          var button, i, removeButtons, _i, _j, _len, _len1;
          removeButtons = [];
          for (i = _i = 0, _len = buttons.length; _i < _len; i = ++_i) {
            button = buttons[i];
            if ((name != null) && button.name !== name) {
              continue;
            }
            if (!button.status || button.status($(node)) === true) {
              removeButtons.push(button);
            }
          }
          for (_j = 0, _len1 = removeButtons.length; _j < _len1; _j++) {
            button = removeButtons[_j];
            i = $.inArray(button, buttons);
            buttons.splice(i, 1);
          }
          if (buttons.length === 0) {
            return false;
          }
        };
      })(this));
    };

    Toolbar.prototype.findButton = function(name) {
      var button;
      button = this.list.find('.toolbar-item-' + name).data('button');
      return button != null ? button : null;
    };

    Toolbar.addButton = function(btn) {
      return this.buttons[btn.prototype.name] = btn;
    };

    Toolbar.buttons = {};

    return Toolbar;

  })(Plugin);

  Simditor = (function(_super) {
    __extends(Simditor, _super);

    function Simditor() {
      return Simditor.__super__.constructor.apply(this, arguments);
    }

    Simditor.connect(Util);

    Simditor.connect(UndoManager);

    Simditor.connect(InputManager);

    Simditor.connect(Keystroke);

    Simditor.connect(Formatter);

    Simditor.connect(Selection);

    Simditor.connect(Toolbar);

    Simditor.count = 0;

    Simditor.prototype.opts = {
      textarea: null,
      placeholder: '',
      defaultImage: 'images/image.png',
      params: {},
      upload: false,
      tabIndent: true
    };

    Simditor.prototype._init = function() {
      var editor, form, uploadOpts, _ref;
      this.textarea = $(this.opts.textarea);
      this.opts.placeholder = (_ref = this.opts.placeholder) != null ? _ref : this.textarea.attr('placeholder');
      if (!this.textarea.length) {
        throw new Error('simditor: param textarea is required.');
        return;
      }
      editor = this.textarea.data('simditor');
      if (editor != null) {
        editor.destroy();
      }
      this.id = ++Simditor.count;
      this._render();
      if (this.opts.upload && (typeof simple !== "undefined" && simple !== null ? simple.uploader : void 0)) {
        uploadOpts = typeof this.opts.upload === 'object' ? this.opts.upload : {};
        this.uploader = simple.uploader(uploadOpts);
      }
      form = this.textarea.closest('form');
      if (form.length) {
        form.on('submit.simditor-' + this.id, (function(_this) {
          return function() {
            return _this.sync();
          };
        })(this));
        form.on('reset.simditor-' + this.id, (function(_this) {
          return function() {
            return _this.setValue('');
          };
        })(this));
      }
      this.on('pluginconnected', (function(_this) {
        return function() {
          _this.setValue(_this.textarea.val() || '');
          if (_this.opts.placeholder) {
            _this.on('valuechanged', function() {
              return _this._placeholder();
            });
          }
          return setTimeout(function() {
            return _this.trigger('valuechanged');
          }, 0);
        };
      })(this));
      if (this.util.browser.mozilla) {
        document.execCommand("enableObjectResizing", false, false);
        return document.execCommand("enableInlineTableEditing", false, false);
      }
    };

    Simditor.prototype._tpl = "<div class=\"simditor\">\n  <div class=\"simditor-wrapper\">\n    <div class=\"simditor-placeholder\"></div>\n    <div class=\"simditor-body\" contenteditable=\"true\">\n    </div>\n  </div>\n</div>";

    Simditor.prototype._render = function() {
      var key, val, _ref, _results;
      this.el = $(this._tpl).insertBefore(this.textarea);
      this.wrapper = this.el.find('.simditor-wrapper');
      this.body = this.wrapper.find('.simditor-body');
      this.placeholderEl = this.wrapper.find('.simditor-placeholder').append(this.opts.placeholder);
      this.el.append(this.textarea).data('simditor', this);
      this.textarea.data('simditor', this).hide().blur();
      this.body.attr('tabindex', this.textarea.attr('tabindex'));
      if (this.util.os.mac) {
        this.el.addClass('simditor-mac');
      } else if (this.util.os.linux) {
        this.el.addClass('simditor-linux');
      }
      if (this.opts.params) {
        _ref = this.opts.params;
        _results = [];
        for (key in _ref) {
          val = _ref[key];
          _results.push($('<input/>', {
            type: 'hidden',
            name: key,
            value: val
          }).insertAfter(this.textarea));
        }
        return _results;
      }
    };

    Simditor.prototype._placeholder = function() {
      var children, _ref;
      children = this.body.children();
      if (children.length === 0 || (children.length === 1 && this.util.isEmptyNode(children) && ((_ref = children.data('indent')) != null ? _ref : 0) < 1)) {
        return this.placeholderEl.show();
      } else {
        return this.placeholderEl.hide();
      }
    };

    Simditor.prototype.setValue = function(val) {
      this.hidePopover();
      this.textarea.val(val);
      this.body.html(val);
      this.formatter.format();
      return this.formatter.decorate();
    };

    Simditor.prototype.getValue = function() {
      return this.sync();
    };

    Simditor.prototype.sync = function() {
      var children, cloneBody, emptyP, firstP, lastP, val;
      this.hidePopover;
      cloneBody = this.body.clone();
      this.formatter.undecorate(cloneBody);
      this.formatter.format(cloneBody);
      this.formatter.autolink(cloneBody);
      children = cloneBody.children();
      lastP = children.last('p');
      firstP = children.first('p');
      while (lastP.is('p') && this.util.isEmptyNode(lastP)) {
        emptyP = lastP;
        lastP = lastP.prev('p');
        emptyP.remove();
      }
      while (firstP.is('p') && this.util.isEmptyNode(firstP)) {
        emptyP = firstP;
        firstP = lastP.next('p');
        emptyP.remove();
      }
      cloneBody.find('img.uploading').remove();
      val = $.trim(cloneBody.html());
      this.textarea.val(val);
      return val;
    };

    Simditor.prototype.focus = function() {
      var $blockEl, range;
      $blockEl = this.body.find('p, li, pre, h1, h2, h3, h4, td').first();
      if (!($blockEl.length > 0)) {
        return;
      }
      range = document.createRange();
      this.selection.setRangeAtStartOf($blockEl, range);
      return this.body.focus();
    };

    Simditor.prototype.blur = function() {
      return this.body.blur();
    };

    Simditor.prototype.hidePopover = function() {
      return this.wrapper.find('.simditor-popover').each((function(_this) {
        return function(i, popover) {
          popover = $(popover).data('popover');
          if (popover.active) {
            return popover.hide();
          }
        };
      })(this));
    };

    Simditor.prototype.destroy = function() {
      this.triggerHandler('destroy');
      this.textarea.closest('form').off('.simditor .simditor-' + this.id);
      this.selection.clear();
      this.textarea.insertBefore(this.el).hide().val('').removeData('simditor');
      this.el.remove();
      $(document).off('.simditor-' + this.id);
      $(window).off('.simditor-' + this.id);
      return this.off();
    };

    return Simditor;

  })(Widget);

  window.Simditor = Simditor;

  TestPlugin = (function(_super) {
    __extends(TestPlugin, _super);

    function TestPlugin() {
      return TestPlugin.__super__.constructor.apply(this, arguments);
    }

    return TestPlugin;

  })(Plugin);

  Test = (function(_super) {
    __extends(Test, _super);

    function Test() {
      return Test.__super__.constructor.apply(this, arguments);
    }

    Test.connect(TestPlugin);

    return Test;

  })(Widget);

  Button = (function(_super) {
    __extends(Button, _super);

    Button.prototype._tpl = {
      item: '<li><a tabindex="-1" unselectable="on" class="toolbar-item" href="javascript:;"><span></span></a></li>',
      menuWrapper: '<div class="toolbar-menu"></div>',
      menuItem: '<li><a tabindex="-1" unselectable="on" class="menu-item" href="javascript:;"><span></span></a></li>',
      separator: '<li><span class="separator"></span></li>'
    };

    Button.prototype.name = '';

    Button.prototype.icon = '';

    Button.prototype.title = '';

    Button.prototype.text = '';

    Button.prototype.htmlTag = '';

    Button.prototype.disableTag = '';

    Button.prototype.menu = false;

    Button.prototype.active = false;

    Button.prototype.disabled = false;

    Button.prototype.needFocus = true;

    Button.prototype.shortcut = null;

    function Button(editor) {
      var tag, _i, _len, _ref;
      this.editor = editor;
      this.render();
      this.el.on('mousedown', (function(_this) {
        return function(e) {
          var exceed, param;
          e.preventDefault();
          if (_this.menu) {
            _this.wrapper.toggleClass('menu-on').siblings('li').removeClass('menu-on');
            if (_this.wrapper.is('.menu-on')) {
              exceed = _this.menuWrapper.offset().left + _this.menuWrapper.outerWidth() + 5 - _this.editor.wrapper.offset().left - _this.editor.wrapper.outerWidth();
              if (exceed > 0) {
                _this.menuWrapper.css({
                  'left': 'auto',
                  'right': 0
                });
              }
            }
            return false;
          }
          if (_this.el.hasClass('disabled') || (_this.needFocus && !_this.editor.inputManager.focused)) {
            return false;
          }
          param = _this.el.data('param');
          _this.command(param);
          return false;
        };
      })(this));
      this.wrapper.on('click', 'a.menu-item', (function(_this) {
        return function(e) {
          var btn, param;
          e.preventDefault();
          btn = $(e.currentTarget);
          _this.wrapper.removeClass('menu-on');
          if (btn.hasClass('disabled') || (_this.needFocus && !_this.editor.inputManager.focused)) {
            return false;
          }
          _this.editor.toolbar.wrapper.removeClass('menu-on');
          param = btn.data('param');
          _this.command(param);
          return false;
        };
      })(this));
      this.wrapper.on('mousedown', 'a.menu-item', (function(_this) {
        return function(e) {
          return false;
        };
      })(this));
      this.editor.on('blur', (function(_this) {
        return function() {
          _this.setActive(false);
          return _this.setDisabled(false);
        };
      })(this));
      if (this.shortcut != null) {
        this.editor.inputManager.addShortcut(this.shortcut, (function(_this) {
          return function(e) {
            _this.el.mousedown();
            return false;
          };
        })(this));
      }
      _ref = this.htmlTag.split(',');
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        tag = _ref[_i];
        tag = $.trim(tag);
        if (tag && $.inArray(tag, this.editor.formatter._allowedTags) < 0) {
          this.editor.formatter._allowedTags.push(tag);
        }
      }
    }

    Button.prototype.render = function() {
      this.wrapper = $(this._tpl.item).appendTo(this.editor.toolbar.list);
      this.el = this.wrapper.find('a.toolbar-item');
      this.el.attr('title', this.title).addClass('toolbar-item-' + this.name).data('button', this);
      this.el.find('span').addClass(this.icon ? 'fa fa-' + this.icon : '').text(this.text);
      if (!this.menu) {
        return;
      }
      this.menuWrapper = $(this._tpl.menuWrapper).appendTo(this.wrapper);
      this.menuWrapper.addClass('toolbar-menu-' + this.name);
      return this.renderMenu();
    };

    Button.prototype.renderMenu = function() {
      var $menuBtntnEl, $menuItemEl, menuItem, _i, _len, _ref, _ref1, _results;
      if (!$.isArray(this.menu)) {
        return;
      }
      this.menuEl = $('<ul/>').appendTo(this.menuWrapper);
      _ref = this.menu;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        menuItem = _ref[_i];
        if (menuItem === '|') {
          $(this._tpl.separator).appendTo(this.menuEl);
          continue;
        }
        $menuItemEl = $(this._tpl.menuItem).appendTo(this.menuEl);
        _results.push($menuBtntnEl = $menuItemEl.find('a.menu-item').attr({
          'title': (_ref1 = menuItem.title) != null ? _ref1 : menuItem.text,
          'data-param': menuItem.param
        }).addClass('menu-item-' + menuItem.name).find('span').text(menuItem.text));
      }
      return _results;
    };

    Button.prototype.setActive = function(active) {
      this.active = active;
      return this.el.toggleClass('active', this.active);
    };

    Button.prototype.setDisabled = function(disabled) {
      this.disabled = disabled;
      return this.el.toggleClass('disabled', this.disabled);
    };

    Button.prototype.status = function($node) {
      if ($node != null) {
        this.setDisabled($node.is(this.disableTag));
      }
      if (this.disabled) {
        return true;
      }
      if ($node != null) {
        this.setActive($node.is(this.htmlTag));
      }
      return this.active;
    };

    Button.prototype.command = function(param) {};

    return Button;

  })(Module);

  window.SimditorButton = Button;

  Popover = (function(_super) {
    __extends(Popover, _super);

    Popover.prototype.offset = {
      top: 4,
      left: 0
    };

    Popover.prototype.target = null;

    Popover.prototype.active = false;

    function Popover(editor) {
      this.editor = editor;
      this.el = $('<div class="simditor-popover"></div>').appendTo(this.editor.wrapper).data('popover', this);
      this.render();
      this.el.on('mouseenter', (function(_this) {
        return function(e) {
          return _this.el.addClass('hover');
        };
      })(this));
      this.el.on('mouseleave', (function(_this) {
        return function(e) {
          return _this.el.removeClass('hover');
        };
      })(this));
    }

    Popover.prototype.render = function() {};

    Popover.prototype.show = function($target, position) {
      if (position == null) {
        position = 'bottom';
      }
      if ($target == null) {
        return;
      }
      this.target = $target.addClass('selected');
      this.el.siblings('.simditor-popover').each((function(_this) {
        return function(i, el) {
          var popover;
          popover = $(el).data('popover');
          return popover.hide();
        };
      })(this));
      if (this.active) {
        this.refresh(position);
        return this.trigger('popovershow');
      } else {
        this.active = true;
        this.el.css({
          left: -9999
        }).show();
        return setTimeout((function(_this) {
          return function() {
            _this.refresh(position);
            return _this.trigger('popovershow');
          };
        })(this), 0);
      }
    };

    Popover.prototype.hide = function() {
      if (!this.active) {
        return;
      }
      if (this.target) {
        this.target.removeClass('selected');
      }
      this.target = null;
      this.active = false;
      this.el.hide();
      return this.trigger('popoverhide');
    };

    Popover.prototype.refresh = function(position) {
      var left, targetH, targetOffset, top, wrapperOffset;
      if (position == null) {
        position = 'bottom';
      }
      wrapperOffset = this.editor.wrapper.offset();
      targetOffset = this.target.offset();
      targetH = this.target.outerHeight();
      if (position === 'bottom') {
        top = targetOffset.top - wrapperOffset.top + targetH;
      } else if (position === 'top') {
        top = targetOffset.top - wrapperOffset.top - this.el.height();
      }
      left = Math.min(targetOffset.left - wrapperOffset.left, this.editor.wrapper.width() - this.el.outerWidth() - 10);
      return this.el.css({
        top: top + this.offset.top,
        left: left + this.offset.left
      });
    };

    Popover.prototype.destroy = function() {
      this.target = null;
      this.active = false;
      this.editor.off('.linkpopover');
      return this.el.remove();
    };

    return Popover;

  })(Module);

  window.SimditorPopover = Popover;

  TitleButton = (function(_super) {
    __extends(TitleButton, _super);

    function TitleButton() {
      return TitleButton.__super__.constructor.apply(this, arguments);
    }

    TitleButton.prototype.name = 'title';

    TitleButton.prototype.title = '标题文字';

    TitleButton.prototype.htmlTag = 'h1, h2, h3, h4';

    TitleButton.prototype.disableTag = 'pre, table';

    TitleButton.prototype.menu = [
      {
        name: 'normal',
        text: '普通文本',
        param: 'p'
      }, '|', {
        name: 'h1',
        text: '标题 1',
        param: 'h1'
      }, {
        name: 'h2',
        text: '标题 2',
        param: 'h2'
      }, {
        name: 'h3',
        text: '标题 3',
        param: 'h3'
      }
    ];

    TitleButton.prototype.setActive = function(active, param) {
      this.active = active;
      if (active) {
        return this.el.addClass('active active-' + param);
      } else {
        return this.el.removeClass('active active-p active-h1 active-h2 active-h3');
      }
    };

    TitleButton.prototype.status = function($node) {
      var param, _ref;
      if ($node != null) {
        this.setDisabled($node.is(this.disableTag));
      }
      if (this.disabled) {
        return true;
      }
      if ($node != null) {
        param = (_ref = $node[0].tagName) != null ? _ref.toLowerCase() : void 0;
        this.setActive($node.is(this.htmlTag), param);
      }
      return this.active;
    };

    TitleButton.prototype.command = function(param) {
      var $contents, $endBlock, $startBlock, endNode, node, range, results, startNode, _i, _len, _ref;
      range = this.editor.selection.getRange();
      startNode = range.startContainer;
      endNode = range.endContainer;
      $startBlock = this.editor.util.closestBlockEl(startNode);
      $endBlock = this.editor.util.closestBlockEl(endNode);
      this.editor.selection.save();
      range.setStartBefore($startBlock[0]);
      range.setEndAfter($endBlock[0]);
      $contents = $(range.extractContents());
      results = [];
      $contents.children().each((function(_this) {
        return function(i, el) {
          var c, converted, _i, _len, _results;
          converted = _this._convertEl(el, param);
          _results = [];
          for (_i = 0, _len = converted.length; _i < _len; _i++) {
            c = converted[_i];
            _results.push(results.push(c));
          }
          return _results;
        };
      })(this));
      _ref = results.reverse();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        node = _ref[_i];
        range.insertNode(node[0]);
      }
      this.editor.selection.restore();
      this.editor.trigger('valuechanged');
      return this.editor.trigger('selectionchanged');
    };

    TitleButton.prototype._convertEl = function(el, param) {
      var $block, $el, results;
      $el = $(el);
      results = [];
      if ($el.is(param)) {
        results.push($el);
      } else {
        $block = $('<' + param + '/>').append($el.contents());
        results.push($block);
      }
      return results;
    };

    return TitleButton;

  })(Button);

  Simditor.Toolbar.addButton(TitleButton);

  BoldButton = (function(_super) {
    __extends(BoldButton, _super);

    function BoldButton() {
      return BoldButton.__super__.constructor.apply(this, arguments);
    }

    BoldButton.prototype.name = 'bold';

    BoldButton.prototype.icon = 'bold';

    BoldButton.prototype.title = '加粗文字';

    BoldButton.prototype.htmlTag = 'b, strong';

    BoldButton.prototype.disableTag = 'pre';

    BoldButton.prototype.shortcut = 'cmd+66';

    BoldButton.prototype.render = function() {
      if (this.editor.util.os.mac) {
        this.title = this.title + ' ( Cmd + b )';
      } else {
        this.title = this.title + ' ( Ctrl + b )';
        this.shortcut = 'ctrl+66';
      }
      return BoldButton.__super__.render.call(this);
    };

    BoldButton.prototype.status = function($node) {
      var active;
      if ($node != null) {
        this.setDisabled($node.is(this.disableTag));
      }
      if (this.disabled) {
        return true;
      }
      active = document.queryCommandState('bold') === true;
      this.setActive(active);
      return active;
    };

    BoldButton.prototype.command = function() {
      document.execCommand('bold');
      this.editor.trigger('valuechanged');
      return this.editor.trigger('selectionchanged');
    };

    return BoldButton;

  })(Button);

  Simditor.Toolbar.addButton(BoldButton);

  ItalicButton = (function(_super) {
    __extends(ItalicButton, _super);

    function ItalicButton() {
      return ItalicButton.__super__.constructor.apply(this, arguments);
    }

    ItalicButton.prototype.name = 'italic';

    ItalicButton.prototype.icon = 'italic';

    ItalicButton.prototype.title = '斜体文字';

    ItalicButton.prototype.htmlTag = 'i';

    ItalicButton.prototype.disableTag = 'pre';

    ItalicButton.prototype.shortcut = 'cmd+73';

    ItalicButton.prototype.render = function() {
      if (this.editor.util.os.mac) {
        this.title = this.title + ' ( Cmd + i )';
      } else {
        this.title = this.title + ' ( Ctrl + i )';
        this.shortcut = 'ctrl+73';
      }
      return ItalicButton.__super__.render.call(this);
    };

    ItalicButton.prototype.status = function($node) {
      var active;
      if ($node != null) {
        this.setDisabled($node.is(this.disableTag));
      }
      if (this.disabled) {
        return this.disabled;
      }
      active = document.queryCommandState('italic') === true;
      this.setActive(active);
      return active;
    };

    ItalicButton.prototype.command = function() {
      document.execCommand('italic');
      this.editor.trigger('valuechanged');
      return this.editor.trigger('selectionchanged');
    };

    return ItalicButton;

  })(Button);

  Simditor.Toolbar.addButton(ItalicButton);

  UnderlineButton = (function(_super) {
    __extends(UnderlineButton, _super);

    function UnderlineButton() {
      return UnderlineButton.__super__.constructor.apply(this, arguments);
    }

    UnderlineButton.prototype.name = 'underline';

    UnderlineButton.prototype.icon = 'underline';

    UnderlineButton.prototype.title = '下划线文字';

    UnderlineButton.prototype.htmlTag = 'u';

    UnderlineButton.prototype.disableTag = 'pre';

    UnderlineButton.prototype.shortcut = 'cmd+85';

    UnderlineButton.prototype.render = function() {
      if (this.editor.util.os.mac) {
        this.title = this.title + ' ( Cmd + u )';
      } else {
        this.title = this.title + ' ( Ctrl + u )';
        this.shortcut = 'ctrl+85';
      }
      return UnderlineButton.__super__.render.call(this);
    };

    UnderlineButton.prototype.status = function($node) {
      var active;
      if ($node != null) {
        this.setDisabled($node.is(this.disableTag));
      }
      if (this.disabled) {
        return this.disabled;
      }
      active = document.queryCommandState('underline') === true;
      this.setActive(active);
      return active;
    };

    UnderlineButton.prototype.command = function() {
      document.execCommand('underline');
      this.editor.trigger('valuechanged');
      return this.editor.trigger('selectionchanged');
    };

    return UnderlineButton;

  })(Button);

  Simditor.Toolbar.addButton(UnderlineButton);

  ListButton = (function(_super) {
    __extends(ListButton, _super);

    function ListButton() {
      return ListButton.__super__.constructor.apply(this, arguments);
    }

    ListButton.prototype.type = '';

    ListButton.prototype.disableTag = 'pre, table';

    ListButton.prototype.status = function($node) {
      var anotherType;
      if ($node != null) {
        this.setDisabled($node.is(this.disableTag));
      }
      if (this.disabled) {
        return true;
      }
      if ($node == null) {
        return this.active;
      }
      anotherType = this.type === 'ul' ? 'ol' : 'ul';
      if ($node.is(anotherType)) {
        this.setActive(false);
        return true;
      } else {
        this.setActive($node.is(this.htmlTag));
        return this.active;
      }
    };

    ListButton.prototype.command = function(param) {
      var $contents, $endBlock, $furthestEnd, $furthestStart, $parent, $startBlock, endLevel, endNode, getListLevel, node, range, results, startLevel, startNode, _i, _len, _ref;
      range = this.editor.selection.getRange();
      startNode = range.startContainer;
      endNode = range.endContainer;
      $startBlock = this.editor.util.closestBlockEl(startNode);
      $endBlock = this.editor.util.closestBlockEl(endNode);
      this.editor.selection.save();
      range.setStartBefore($startBlock[0]);
      range.setEndAfter($endBlock[0]);
      if ($startBlock.is('li') && $endBlock.is('li')) {
        $furthestStart = this.editor.util.furthestNode($startBlock, 'ul, ol');
        $furthestEnd = this.editor.util.furthestNode($endBlock, 'ul, ol');
        if ($furthestStart.is($furthestEnd)) {
          getListLevel = function($li) {
            var lvl;
            lvl = 1;
            while (!$li.parent().is($furthestStart)) {
              lvl += 1;
              $li = $li.parent();
            }
            return lvl;
          };
          startLevel = getListLevel($startBlock);
          endLevel = getListLevel($endBlock);
          if (startLevel > endLevel) {
            $parent = $endBlock.parent();
          } else {
            $parent = $startBlock.parent();
          }
          range.setStartBefore($parent[0]);
          range.setEndAfter($parent[0]);
        } else {
          range.setStartBefore($furthestStart[0]);
          range.setEndAfter($furthestEnd[0]);
        }
      }
      $contents = $(range.extractContents());
      results = [];
      $contents.children().each((function(_this) {
        return function(i, el) {
          var c, converted, _i, _len, _results;
          converted = _this._convertEl(el);
          _results = [];
          for (_i = 0, _len = converted.length; _i < _len; _i++) {
            c = converted[_i];
            if (results.length && results[results.length - 1].is(_this.type) && c.is(_this.type)) {
              _results.push(results[results.length - 1].append(c.children()));
            } else {
              _results.push(results.push(c));
            }
          }
          return _results;
        };
      })(this));
      _ref = results.reverse();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        node = _ref[_i];
        range.insertNode(node[0]);
      }
      this.editor.selection.restore();
      this.editor.trigger('valuechanged');
      return this.editor.trigger('selectionchanged');
    };

    ListButton.prototype._convertEl = function(el) {
      var $el, anotherType, block, child, children, results, _i, _len, _ref;
      $el = $(el);
      results = [];
      anotherType = this.type === 'ul' ? 'ol' : 'ul';
      if ($el.is(this.type)) {
        $el.children('li').each((function(_this) {
          return function(i, li) {
            var $childList, $li, block;
            $li = $(li);
            $childList = $li.children('ul, ol').remove();
            block = $('<p/>').append($(li).html() || _this.editor.util.phBr);
            results.push(block);
            if ($childList.length > 0) {
              return results.push($childList);
            }
          };
        })(this));
      } else if ($el.is(anotherType)) {
        block = $('<' + this.type + '/>').append($el.html());
        results.push(block);
      } else if ($el.is('blockquote')) {
        _ref = $el.children().get();
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          child = _ref[_i];
          children = this._convertEl(child);
        }
        $.merge(results, children);
      } else if ($el.is('table')) {

      } else {
        block = $('<' + this.type + '><li></li></' + this.type + '>');
        block.find('li').append($el.html() || this.editor.util.phBr);
        results.push(block);
      }
      return results;
    };

    return ListButton;

  })(Button);

  OrderListButton = (function(_super) {
    __extends(OrderListButton, _super);

    function OrderListButton() {
      return OrderListButton.__super__.constructor.apply(this, arguments);
    }

    OrderListButton.prototype.type = 'ol';

    OrderListButton.prototype.name = 'ol';

    OrderListButton.prototype.title = '有序列表';

    OrderListButton.prototype.icon = 'list-ol';

    OrderListButton.prototype.htmlTag = 'ol';

    OrderListButton.prototype.shortcut = 'cmd+191';

    OrderListButton.prototype.render = function() {
      if (this.editor.util.os.mac) {
        this.title = this.title + ' ( Cmd + / )';
      } else {
        this.title = this.title + ' ( ctrl + / )';
        this.shortcut = 'ctrl+191';
      }
      return OrderListButton.__super__.render.call(this);
    };

    return OrderListButton;

  })(ListButton);

  UnorderListButton = (function(_super) {
    __extends(UnorderListButton, _super);

    function UnorderListButton() {
      return UnorderListButton.__super__.constructor.apply(this, arguments);
    }

    UnorderListButton.prototype.type = 'ul';

    UnorderListButton.prototype.name = 'ul';

    UnorderListButton.prototype.title = '无序列表';

    UnorderListButton.prototype.icon = 'list-ul';

    UnorderListButton.prototype.htmlTag = 'ul';

    UnorderListButton.prototype.shortcut = 'cmd+190';

    UnorderListButton.prototype.render = function() {
      if (this.editor.util.os.mac) {
        this.title = this.title + ' ( Cmd + . )';
      } else {
        this.title = this.title + ' ( Ctrl + . )';
        this.shortcut = 'ctrl+190';
      }
      return UnorderListButton.__super__.render.call(this);
    };

    return UnorderListButton;

  })(ListButton);

  Simditor.Toolbar.addButton(OrderListButton);

  Simditor.Toolbar.addButton(UnorderListButton);

  BlockquoteButton = (function(_super) {
    __extends(BlockquoteButton, _super);

    function BlockquoteButton() {
      return BlockquoteButton.__super__.constructor.apply(this, arguments);
    }

    BlockquoteButton.prototype.name = 'blockquote';

    BlockquoteButton.prototype.icon = 'quote-left';

    BlockquoteButton.prototype.title = '引用';

    BlockquoteButton.prototype.htmlTag = 'blockquote';

    BlockquoteButton.prototype.disableTag = 'pre, table';

    BlockquoteButton.prototype.command = function() {
      var $contents, $endBlock, $startBlock, endNode, node, range, results, startNode, _i, _len, _ref;
      range = this.editor.selection.getRange();
      startNode = range.startContainer;
      endNode = range.endContainer;
      $startBlock = this.editor.util.furthestBlockEl(startNode);
      $endBlock = this.editor.util.furthestBlockEl(endNode);
      this.editor.selection.save();
      range.setStartBefore($startBlock[0]);
      range.setEndAfter($endBlock[0]);
      $contents = $(range.extractContents());
      results = [];
      $contents.children().each((function(_this) {
        return function(i, el) {
          var c, converted, _i, _len, _results;
          converted = _this._convertEl(el);
          _results = [];
          for (_i = 0, _len = converted.length; _i < _len; _i++) {
            c = converted[_i];
            if (results.length && results[results.length - 1].is(_this.htmlTag) && c.is(_this.htmlTag)) {
              _results.push(results[results.length - 1].append(c.children()));
            } else {
              _results.push(results.push(c));
            }
          }
          return _results;
        };
      })(this));
      _ref = results.reverse();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        node = _ref[_i];
        range.insertNode(node[0]);
      }
      this.editor.selection.restore();
      this.editor.trigger('valuechanged');
      return this.editor.trigger('selectionchanged');
    };

    BlockquoteButton.prototype._convertEl = function(el) {
      var $el, block, results;
      $el = $(el);
      results = [];
      if ($el.is(this.htmlTag)) {
        $el.children().each((function(_this) {
          return function(i, node) {
            return results.push($(node));
          };
        })(this));
      } else {
        block = $('<' + this.htmlTag + '/>').append($el);
        results.push(block);
      }
      return results;
    };

    return BlockquoteButton;

  })(Button);

  Simditor.Toolbar.addButton(BlockquoteButton);

  CodeButton = (function(_super) {
    __extends(CodeButton, _super);

    CodeButton.prototype.name = 'code';

    CodeButton.prototype.icon = 'code';

    CodeButton.prototype.title = '插入代码';

    CodeButton.prototype.htmlTag = 'pre';

    CodeButton.prototype.disableTag = 'li, table';

    function CodeButton(editor) {
      this.editor = editor;
      CodeButton.__super__.constructor.call(this, this.editor);
      this.editor.on('decorate', (function(_this) {
        return function(e, $el) {
          return $el.find('pre').each(function(i, pre) {
            return _this.decorate($(pre));
          });
        };
      })(this));
      this.editor.on('undecorate', (function(_this) {
        return function(e, $el) {
          return $el.find('pre').each(function(i, pre) {
            return _this.undecorate($(pre));
          });
        };
      })(this));
    }

    CodeButton.prototype.render = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      CodeButton.__super__.render.apply(this, args);
      return this.popover = new CodePopover(this.editor);
    };

    CodeButton.prototype.status = function($node) {
      var result;
      result = CodeButton.__super__.status.call(this, $node);
      if (this.active) {
        this.popover.show($node);
      } else if (this.editor.util.isBlockNode($node)) {
        this.popover.hide();
      }
      return result;
    };

    CodeButton.prototype.decorate = function($pre) {
      var lang;
      lang = $pre.attr('data-lang');
      $pre.removeClass();
      if (lang && lang !== -1) {
        return $pre.addClass('lang-' + lang);
      }
    };

    CodeButton.prototype.undecorate = function($pre) {
      var lang;
      lang = $pre.attr('data-lang');
      $pre.removeClass();
      if (lang && lang !== -1) {
        return $pre.addClass('lang-' + lang);
      }
    };

    CodeButton.prototype.command = function() {
      var $contents, $endBlock, $startBlock, endNode, node, range, results, startNode, _i, _len, _ref;
      range = this.editor.selection.getRange();
      startNode = range.startContainer;
      endNode = range.endContainer;
      $startBlock = this.editor.util.closestBlockEl(startNode);
      $endBlock = this.editor.util.closestBlockEl(endNode);
      range.setStartBefore($startBlock[0]);
      range.setEndAfter($endBlock[0]);
      $contents = $(range.extractContents());
      results = [];
      $contents.children().each((function(_this) {
        return function(i, el) {
          var c, converted, _i, _len, _results;
          converted = _this._convertEl(el);
          _results = [];
          for (_i = 0, _len = converted.length; _i < _len; _i++) {
            c = converted[_i];
            if (results.length && results[results.length - 1].is(_this.htmlTag) && c.is(_this.htmlTag)) {
              _results.push(results[results.length - 1].append(c.contents()));
            } else {
              _results.push(results.push(c));
            }
          }
          return _results;
        };
      })(this));
      _ref = results.reverse();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        node = _ref[_i];
        range.insertNode(node[0]);
      }
      this.editor.selection.setRangeAtEndOf(results[0]);
      this.editor.trigger('valuechanged');
      return this.editor.trigger('selectionchanged');
    };

    CodeButton.prototype._convertEl = function(el) {
      var $el, block, codeStr, results;
      $el = $(el);
      results = [];
      if ($el.is(this.htmlTag)) {
        block = $('<p/>').append($el.html().replace('\n', '<br/>'));
        results.push(block);
      } else {
        if (!$el.text() && $el.children().length === 1 && $el.children().is('br')) {
          codeStr = '\n';
        } else {
          codeStr = this.editor.formatter.clearHtml($el);
        }
        block = $('<' + this.htmlTag + '/>').text(codeStr);
        results.push(block);
      }
      return results;
    };

    return CodeButton;

  })(Button);

  CodePopover = (function(_super) {
    __extends(CodePopover, _super);

    function CodePopover() {
      return CodePopover.__super__.constructor.apply(this, arguments);
    }

    CodePopover.prototype._tpl = "<div class=\"code-settings\">\n  <div class=\"settings-field\">\n    <select class=\"select-lang\">\n      <option value=\"-1\">选择程序语言</option>\n      <option value=\"c++\">C++</option>\n      <option value=\"css\">CSS</option>\n      <option value=\"coffeeScript\">CoffeeScript</option>\n      <option value=\"html\">Html,XML</option>\n      <option value=\"json\">JSON</option>\n      <option value=\"java\">Java</option>\n      <option value=\"js\">JavaScript</option>\n      <option value=\"markdown\">Markdown</option>\n      <option value=\"oc\">Objective C</option>\n      <option value=\"php\">PHP</option>\n      <option value=\"perl\">Perl</option>\n      <option value=\"python\">Python</option>\n      <option value=\"ruby\">Ruby</option>\n      <option value=\"sql\">SQL</option>\n    </select>\n  </div>\n</div>";

    CodePopover.prototype.render = function() {
      this.el.addClass('code-popover').append(this._tpl);
      this.selectEl = this.el.find('.select-lang');
      return this.selectEl.on('change', (function(_this) {
        return function(e) {
          var selected;
          _this.lang = _this.selectEl.val();
          selected = _this.target.hasClass('selected');
          _this.target.removeClass().removeAttr('data-lang');
          if (_this.lang !== -1) {
            _this.target.addClass('lang-' + _this.lang);
            _this.target.attr('data-lang', _this.lang);
          }
          if (selected) {
            return _this.target.addClass('selected');
          }
        };
      })(this));
    };

    CodePopover.prototype.show = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      CodePopover.__super__.show.apply(this, args);
      this.lang = this.target.attr('data-lang');
      if (this.lang != null) {
        return this.selectEl.val(this.lang);
      }
    };

    return CodePopover;

  })(Popover);

  Simditor.Toolbar.addButton(CodeButton);

  LinkButton = (function(_super) {
    __extends(LinkButton, _super);

    function LinkButton() {
      return LinkButton.__super__.constructor.apply(this, arguments);
    }

    LinkButton.prototype.name = 'link';

    LinkButton.prototype.icon = 'link';

    LinkButton.prototype.title = '插入链接';

    LinkButton.prototype.htmlTag = 'a';

    LinkButton.prototype.disableTag = 'pre';

    LinkButton.prototype.render = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      LinkButton.__super__.render.apply(this, args);
      return this.popover = new LinkPopover(this.editor);
    };

    LinkButton.prototype.status = function($node) {
      var showPopover;
      if ($node != null) {
        this.setDisabled($node.is(this.disableTag));
      }
      if (this.disabled) {
        return true;
      }
      if ($node == null) {
        return this.active;
      }
      showPopover = true;
      if (!$node.is(this.htmlTag) || $node.is('[class^="simditor-"]')) {
        this.setActive(false);
        showPopover = false;
      } else if (this.editor.selection.rangeAtEndOf($node)) {
        this.setActive(true);
        showPopover = false;
      } else {
        this.setActive(true);
      }
      if (showPopover) {
        this.popover.show($node);
      } else if (this.editor.util.isBlockNode($node)) {
        this.popover.hide();
      }
      return this.active;
    };

    LinkButton.prototype.command = function() {
      var $contents, $endBlock, $link, $newBlock, $startBlock, endNode, linkText, range, startNode, txtNode;
      range = this.editor.selection.getRange();
      if (this.active) {
        $link = $(range.commonAncestorContainer).closest('a');
        txtNode = document.createTextNode($link.text());
        $link.replaceWith(txtNode);
        range.selectNode(txtNode);
      } else {
        startNode = range.startContainer;
        endNode = range.endContainer;
        $startBlock = this.editor.util.closestBlockEl(startNode);
        $endBlock = this.editor.util.closestBlockEl(endNode);
        $contents = $(range.extractContents());
        linkText = this.editor.formatter.clearHtml($contents.contents(), false);
        $link = $('<a/>', {
          href: 'http://www.example.com',
          target: '_blank',
          text: linkText || '链接文字'
        });
        if ($startBlock[0] === $endBlock[0]) {
          range.insertNode($link[0]);
        } else {
          $newBlock = $('<p/>').append($link);
          range.insertNode($newBlock[0]);
        }
        range.selectNodeContents($link[0]);
        this.popover.one('popovershow', (function(_this) {
          return function() {
            if (linkText) {
              _this.popover.urlEl.focus();
              return _this.popover.urlEl[0].select();
            } else {
              _this.popover.textEl.focus();
              return _this.popover.textEl[0].select();
            }
          };
        })(this));
      }
      this.editor.selection.selectRange(range);
      this.editor.trigger('valuechanged');
      return this.editor.trigger('selectionchanged');
    };

    return LinkButton;

  })(Button);

  LinkPopover = (function(_super) {
    __extends(LinkPopover, _super);

    function LinkPopover() {
      return LinkPopover.__super__.constructor.apply(this, arguments);
    }

    LinkPopover.prototype._tpl = "<div class=\"link-settings\">\n  <div class=\"settings-field\">\n    <label>文本</label>\n    <input class=\"link-text\" type=\"text\"/>\n    <a class=\"btn-unlink\" href=\"javascript:;\" title=\"取消链接\" tabindex=\"-1\"><span class=\"fa fa-unlink\"></span></a>\n  </div>\n  <div class=\"settings-field\">\n    <label>链接</label>\n    <input class=\"link-url\" type=\"text\"/>\n  </div>\n</div>";

    LinkPopover.prototype.render = function() {
      this.el.addClass('link-popover').append(this._tpl);
      this.textEl = this.el.find('.link-text');
      this.urlEl = this.el.find('.link-url');
      this.unlinkEl = this.el.find('.btn-unlink');
      this.textEl.on('keyup', (function(_this) {
        return function(e) {
          if (e.which === 13) {
            return;
          }
          return _this.target.text(_this.textEl.val());
        };
      })(this));
      this.urlEl.on('keyup', (function(_this) {
        return function(e) {
          if (e.which === 13) {
            return;
          }
          return _this.target.attr('href', _this.urlEl.val());
        };
      })(this));
      $([this.urlEl[0], this.textEl[0]]).on('keydown', (function(_this) {
        return function(e) {
          if (e.which === 13 || e.which === 27 || (!e.shiftKey && e.which === 9 && $(e.target).hasClass('link-url'))) {
            e.preventDefault();
            return setTimeout(function() {
              var range;
              range = document.createRange();
              _this.editor.selection.setRangeAfter(_this.target, range);
              _this.hide();
              _this.editor.trigger('valuechanged');
              return _this.editor.trigger('selectionchanged');
            }, 0);
          }
        };
      })(this));
      return this.unlinkEl.on('click', (function(_this) {
        return function(e) {
          var range, txtNode;
          txtNode = document.createTextNode(_this.target.text());
          _this.target.replaceWith(txtNode);
          _this.hide();
          range = document.createRange();
          _this.editor.selection.setRangeAfter(txtNode, range);
          _this.editor.trigger('valuechanged');
          return _this.editor.trigger('selectionchanged');
        };
      })(this));
    };

    LinkPopover.prototype.show = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      LinkPopover.__super__.show.apply(this, args);
      this.textEl.val(this.target.text());
      return this.urlEl.val(this.target.attr('href'));
    };

    return LinkPopover;

  })(Popover);

  Simditor.Toolbar.addButton(LinkButton);

  ImageButton = (function(_super) {
    __extends(ImageButton, _super);

    ImageButton.prototype.name = 'image';

    ImageButton.prototype.icon = 'picture-o';

    ImageButton.prototype.title = '插入图片';

    ImageButton.prototype.htmlTag = 'img';

    ImageButton.prototype.disableTag = 'pre, table';

    ImageButton.prototype.defaultImage = '';

    ImageButton.prototype.maxWidth = 0;

    ImageButton.prototype.maxHeight = 0;

    ImageButton.prototype.menu = [
      {
        name: 'upload-image',
        text: '本地图片'
      }, {
        name: 'external-image',
        text: '外链图片'
      }
    ];

    function ImageButton(editor) {
      this.editor = editor;
      if (this.editor.uploader == null) {
        this.menu = false;
      }
      ImageButton.__super__.constructor.call(this, this.editor);
      this.defaultImage = this.editor.opts.defaultImage;
      this.maxWidth = this.editor.opts.maxImageWidth || this.editor.body.width();
      this.maxHeight = this.editor.opts.maxImageHeight || $(window).height();
      this.editor.body.on('click', 'img:not([data-non-image])', (function(_this) {
        return function(e) {
          var $img, range;
          $img = $(e.currentTarget);
          range = document.createRange();
          range.selectNode($img[0]);
          _this.editor.selection.selectRange(range);
          setTimeout(function() {
            _this.editor.body.focus();
            return _this.editor.trigger('selectionchanged');
          }, 0);
          return false;
        };
      })(this));
      this.editor.body.on('mouseup', 'img:not([data-non-image])', (function(_this) {
        return function(e) {
          return false;
        };
      })(this));
      this.editor.on('selectionchanged.image', (function(_this) {
        return function() {
          var $contents, $img, range;
          range = _this.editor.selection.sel.getRangeAt(0);
          if (range == null) {
            return;
          }
          $contents = $(range.cloneContents()).contents();
          if ($contents.length === 1 && $contents.is('img:not([data-non-image])')) {
            $img = $(range.startContainer).contents().eq(range.startOffset);
            return _this.popover.show($img);
          } else {
            return _this.popover.hide();
          }
        };
      })(this));
    }

    ImageButton.prototype.render = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      ImageButton.__super__.render.apply(this, args);
      return this.popover = new ImagePopover(this);
    };

    ImageButton.prototype.renderMenu = function() {
      var $input, $uploadItem, createInput;
      ImageButton.__super__.renderMenu.call(this);
      $uploadItem = this.menuEl.find('.menu-item-upload-image');
      $input = null;
      createInput = (function(_this) {
        return function() {
          if ($input) {
            $input.remove();
          }
          return $input = $('<input type="file" title="上传图片" name="upload_file" accept="image/*">').appendTo($uploadItem);
        };
      })(this);
      createInput();
      $uploadItem.on('click mousedown', 'input[name=upload_file]', (function(_this) {
        return function(e) {
          return e.stopPropagation();
        };
      })(this));
      $uploadItem.on('change', 'input[name=upload_file]', (function(_this) {
        return function(e) {
          if (_this.editor.inputManager.focused) {
            _this.editor.uploader.upload($input, {
              inline: true
            });
            createInput();
          } else if (_this.editor.inputManager.lastCaretPosition) {
            _this.editor.one('focus', function(e) {
              _this.editor.uploader.upload($input, {
                inline: true
              });
              return createInput();
            });
            _this.editor.undoManager.caretPosition(_this.editor.inputManager.lastCaretPosition);
          }
          return _this.wrapper.removeClass('menu-on');
        };
      })(this));
      return this._initUploader();
    };

    ImageButton.prototype._initUploader = function() {
      if (this.editor.uploader == null) {
        this.el.find('.btn-upload').remove();
        return;
      }
      this.editor.uploader.on('beforeupload', (function(_this) {
        return function(e, file) {
          var $img;
          if (!file.inline) {
            return;
          }
          if (file.img) {
            $img = $(file.img);
          } else {
            $img = _this.createImage(file.name);
            $img.click();
            file.img = $img;
          }
          $img.addClass('uploading');
          return _this.editor.uploader.readImageFile(file.obj, function(img) {
            var src;
            if (!$img.hasClass('uploading')) {
              return;
            }
            src = img ? img.src : _this.defaultImage;
            return _this.loadImage($img, src, function() {
              _this.popover.refresh();
              return _this.popover.srcEl.val('正在上传...').prop('disabled', true);
            });
          });
        };
      })(this));
      this.editor.uploader.on('uploadprogress', (function(_this) {
        return function(e, file, loaded, total) {
          var $mask, percent;
          if (!file.inline) {
            return;
          }
          percent = loaded / total;
          percent = (percent * 100).toFixed(0);
          if (percent > 99) {
            percent = 99;
          }
          $mask = file.img.data('mask');
          if ($mask) {
            return $mask.find("span").text(percent);
          }
        };
      })(this));
      this.editor.uploader.on('uploadsuccess', (function(_this) {
        return function(e, file, result) {
          var $img;
          if (!file.inline) {
            return;
          }
          $img = file.img.removeClass('uploading');
          return _this.loadImage($img, result.file_path, function() {
            _this.popover.srcEl.prop('disabled', false);
            $img.click();
            _this.editor.trigger('valuechanged');
            return _this.editor.uploader.trigger('uploadready', [file, result]);
          });
        };
      })(this));
      return this.editor.uploader.on('uploaderror', (function(_this) {
        return function(e, file, xhr) {
          var $img, msg, result;
          if (!file.inline) {
            return;
          }
          if (xhr.statusText === 'abort') {
            return;
          }
          if (xhr.responseText) {
            try {
              result = $.parseJSON(xhr.responseText);
              msg = result.msg;
            } catch (_error) {
              e = _error;
              msg = '上传出错了';
            }
            if ((typeof simple !== "undefined" && simple !== null) && (simple.message != null)) {
              simple.message(msg);
            } else {
              alert(msg);
            }
          }
          $img = file.img.removeClass('uploading');
          return _this.loadImage($img, _this.defaultImage, function() {
            _this.popover.refresh();
            _this.popover.srcEl.val($img.attr('src')).prop('disabled', false);
            return _this.editor.trigger('valuechanged');
          });
        };
      })(this));
    };

    ImageButton.prototype.status = function($node) {
      if ($node != null) {
        this.setDisabled($node.is(this.disableTag));
      }
      if (this.disabled) {
        return true;
      }
    };

    ImageButton.prototype.loadImage = function($img, src, callback) {
      var $mask, img, imgPosition, toolbarH;
      $mask = $img.data('mask');
      if (!$mask) {
        $mask = $('<div class="simditor-image-loading"><span></span></div>').appendTo(this.editor.wrapper);
        if ($img.hasClass('uploading') && this.editor.uploader.html5) {
          $mask.addClass('uploading');
        }
        $img.data('mask', $mask);
      }
      imgPosition = $img.position();
      toolbarH = this.editor.toolbar.wrapper.outerHeight();
      $mask.css({
        top: imgPosition.top + toolbarH,
        left: imgPosition.left,
        width: $img.width(),
        height: $img.height()
      });
      img = new Image();
      img.onload = (function(_this) {
        return function() {
          var height, width;
          width = img.width;
          height = img.height;
          if (width > _this.maxWidth) {
            height = _this.maxWidth * height / width;
            width = _this.maxWidth;
          }
          if (height > _this.maxHeight) {
            width = _this.maxHeight * width / height;
            height = _this.maxHeight;
          }
          $img.attr({
            src: src,
            width: width,
            height: height,
            'data-image-size': img.width + ',' + img.height
          });
          if ($img.hasClass('uploading')) {
            $mask.css({
              width: width,
              height: height
            });
          } else {
            $mask.remove();
            $img.removeData('mask');
          }
          return callback(img);
        };
      })(this);
      img.onerror = (function(_this) {
        return function() {
          callback(false);
          $mask.remove();
          return $img.removeData('mask');
        };
      })(this);
      return img.src = src;
    };

    ImageButton.prototype.createImage = function(name) {
      var $img, range;
      if (name == null) {
        name = 'Image';
      }
      range = this.editor.selection.getRange();
      range.deleteContents();
      $img = $('<img/>').attr('alt', name);
      range.insertNode($img[0]);
      return $img;
    };

    ImageButton.prototype.command = function(src) {
      var $img;
      $img = this.createImage();
      return this.loadImage($img, src || this.defaultImage, (function(_this) {
        return function() {
          _this.editor.trigger('valuechanged');
          $img.click();
          return _this.popover.one('popovershow', function() {
            _this.popover.srcEl.focus();
            return _this.popover.srcEl[0].select();
          });
        };
      })(this));
    };

    return ImageButton;

  })(Button);

  ImagePopover = (function(_super) {
    __extends(ImagePopover, _super);

    ImagePopover.prototype._tpl = "<div class=\"link-settings\">\n  <div class=\"settings-field\">\n    <label>图片地址</label>\n    <input class=\"image-src\" type=\"text\"/>\n    <a class=\"btn-upload\" href=\"javascript:;\" title=\"上传图片\" tabindex=\"-1\">\n      <span class=\"fa fa-upload\"></span>\n    </a>\n  </div>\n</div>";

    ImagePopover.prototype.offset = {
      top: 6,
      left: -4
    };

    function ImagePopover(button) {
      this.button = button;
      ImagePopover.__super__.constructor.call(this, this.button.editor);
    }

    ImagePopover.prototype.render = function() {
      this.el.addClass('image-popover').append(this._tpl);
      this.srcEl = this.el.find('.image-src');
      this.srcEl.on('keydown', (function(_this) {
        return function(e) {
          var src;
          if (e.which === 13 || e.which === 27 || e.which === 9) {
            e.preventDefault();
            if (e.which === 13 && !_this.target.hasClass('uploading')) {
              src = _this.srcEl.val();
              return _this.button.loadImage(_this.target, src, function(success) {
                if (!success) {
                  return;
                }
                _this.button.editor.body.focus();
                _this.button.editor.selection.setRangeAfter(_this.target);
                _this.hide();
                return _this.editor.trigger('valuechanged');
              });
            } else {
              _this.button.editor.body.focus();
              _this.button.editor.selection.setRangeAfter(_this.target);
              return _this.hide();
            }
          }
        };
      })(this));
      this.editor.on('valuechanged', (function(_this) {
        return function(e) {
          if (_this.active) {
            return _this.refresh();
          }
        };
      })(this));
      return this._initUploader();
    };

    ImagePopover.prototype._initUploader = function() {
      var $uploadBtn, createInput;
      $uploadBtn = this.el.find('.btn-upload');
      if (this.editor.uploader == null) {
        $uploadBtn.remove();
        return;
      }
      createInput = (function(_this) {
        return function() {
          if (_this.input) {
            _this.input.remove();
          }
          return _this.input = $('<input type="file" title="上传图片" name="upload_file" accept="image/*">').appendTo($uploadBtn);
        };
      })(this);
      createInput();
      this.el.on('click mousedown', 'input[name=upload_file]', (function(_this) {
        return function(e) {
          return e.stopPropagation();
        };
      })(this));
      return this.el.on('change', 'input[name=upload_file]', (function(_this) {
        return function(e) {
          _this.editor.uploader.upload(_this.input, {
            inline: true,
            img: _this.target
          });
          return createInput();
        };
      })(this));
    };

    ImagePopover.prototype.show = function() {
      var $img, args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      ImagePopover.__super__.show.apply(this, args);
      $img = this.target;
      if ($img.hasClass('uploading')) {
        return this.srcEl.val('正在上传');
      } else {
        return this.srcEl.val($img.attr('src'));
      }
    };

    return ImagePopover;

  })(Popover);

  Simditor.Toolbar.addButton(ImageButton);

  IndentButton = (function(_super) {
    __extends(IndentButton, _super);

    function IndentButton() {
      return IndentButton.__super__.constructor.apply(this, arguments);
    }

    IndentButton.prototype.name = 'indent';

    IndentButton.prototype.icon = 'indent';

    IndentButton.prototype.title = '向右缩进（Tab）';

    IndentButton.prototype.status = function($node) {
      return true;
    };

    IndentButton.prototype.command = function() {
      return this.editor.util.indent();
    };

    return IndentButton;

  })(Button);

  Simditor.Toolbar.addButton(IndentButton);

  OutdentButton = (function(_super) {
    __extends(OutdentButton, _super);

    function OutdentButton() {
      return OutdentButton.__super__.constructor.apply(this, arguments);
    }

    OutdentButton.prototype.name = 'outdent';

    OutdentButton.prototype.icon = 'outdent';

    OutdentButton.prototype.title = '向左缩进（Shift + Tab）';

    OutdentButton.prototype.status = function($node) {
      return true;
    };

    OutdentButton.prototype.command = function() {
      return this.editor.util.outdent();
    };

    return OutdentButton;

  })(Button);

  Simditor.Toolbar.addButton(OutdentButton);

  HrButton = (function(_super) {
    __extends(HrButton, _super);

    function HrButton() {
      return HrButton.__super__.constructor.apply(this, arguments);
    }

    HrButton.prototype.name = 'hr';

    HrButton.prototype.icon = 'minus';

    HrButton.prototype.title = '分隔线';

    HrButton.prototype.htmlTag = 'hr';

    HrButton.prototype.status = function($node) {
      return true;
    };

    HrButton.prototype.command = function() {
      var $hr, $newBlock, $nextBlock, $rootBlock;
      $rootBlock = this.editor.util.furthestBlockEl();
      $nextBlock = $rootBlock.next();
      if ($nextBlock.length > 0) {
        this.editor.selection.save();
      } else {
        $newBlock = $('<p/>').append(this.editor.util.phBr);
      }
      $hr = $('<hr/>').insertAfter($rootBlock);
      if ($newBlock) {
        $newBlock.insertAfter($hr);
        this.editor.selection.setRangeAtStartOf($newBlock);
      } else {
        this.editor.selection.restore();
      }
      this.editor.trigger('valuechanged');
      return this.editor.trigger('selectionchanged');
    };

    return HrButton;

  })(Button);

  Simditor.Toolbar.addButton(HrButton);

  TableButton = (function(_super) {
    __extends(TableButton, _super);

    TableButton.prototype.name = 'table';

    TableButton.prototype.icon = 'table';

    TableButton.prototype.title = '表格';

    TableButton.prototype.htmlTag = 'table';

    TableButton.prototype.disableTag = 'pre, li, blockquote';

    TableButton.prototype.menu = true;

    function TableButton() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      TableButton.__super__.constructor.apply(this, args);
      $.merge(this.editor.formatter._allowedTags, ['tbody', 'tr', 'td', 'colgroup', 'col']);
      $.extend(this.editor.formatter._allowedAttributes, {
        td: ['rowspan', 'colspan'],
        col: ['width']
      });
      this.editor.on('decorate', (function(_this) {
        return function(e, $el) {
          return $el.find('table').each(function(i, table) {
            return _this.decorate($(table));
          });
        };
      })(this));
      this.editor.on('undecorate', (function(_this) {
        return function(e, $el) {
          return $el.find('table').each(function(i, table) {
            return _this.undecorate($(table));
          });
        };
      })(this));
      this.editor.on('selectionchanged.table', (function(_this) {
        return function(e) {
          var $container, range;
          _this.editor.body.find('.simditor-table td').removeClass('active');
          range = _this.editor.selection.getRange();
          if (range == null) {
            return;
          }
          $container = $(range.commonAncestorContainer);
          if (range.collapsed && $container.is('.simditor-table')) {
            if (_this.editor.selection.rangeAtStartOf($container)) {
              $container = $container.find('td:first');
            } else {
              $container = $container.find('td:last');
            }
            _this.editor.selection.setRangeAtEndOf($container);
          }
          return $container.closest('td', _this.editor.body).addClass('active');
        };
      })(this));
      this.editor.on('blur.table', (function(_this) {
        return function(e) {
          return _this.editor.body.find('.simditor-table td').removeClass('active');
        };
      })(this));
      this.editor.inputManager.addKeystrokeHandler('38', 'td', (function(_this) {
        return function(e, $node) {
          var $prevTr, $tr, index;
          $tr = $node.parent('tr');
          $prevTr = $tr.prev('tr');
          if (!($prevTr.length > 0)) {
            return true;
          }
          index = $tr.find('td').index($node);
          _this.editor.selection.setRangeAtEndOf($prevTr.find('td').eq(index));
          return true;
        };
      })(this));
      this.editor.inputManager.addKeystrokeHandler('40', 'td', (function(_this) {
        return function(e, $node) {
          var $nextTr, $tr, index;
          $tr = $node.parent('tr');
          $nextTr = $tr.next('tr');
          if (!($nextTr.length > 0)) {
            return true;
          }
          index = $tr.find('td').index($node);
          _this.editor.selection.setRangeAtEndOf($nextTr.find('td').eq(index));
          return true;
        };
      })(this));
    }

    TableButton.prototype.initResize = function($table) {
      var $colgroup, $resizeHandle, $wrapper;
      $wrapper = $table.parent('.simditor-table');
      $colgroup = $table.find('colgroup');
      if ($colgroup.length < 1) {
        $colgroup = $('<colgroup/>').prependTo($table);
        $table.find('tr:first td').each((function(_this) {
          return function(i, td) {
            var $col;
            return $col = $('<col/>').appendTo($colgroup);
          };
        })(this));
        this.refreshTableWidth($table);
      }
      $resizeHandle = $('<div class="simditor-resize-handle" contenteditable="false"></div>').appendTo($wrapper);
      $wrapper.on('mousemove', 'td', (function(_this) {
        return function(e) {
          var $col, $td, index, x, _ref, _ref1;
          if ($wrapper.hasClass('resizing')) {
            return;
          }
          $td = $(e.currentTarget);
          x = e.pageX - $(e.currentTarget).offset().left;
          if (x < 5 && $td.prev().length > 0) {
            $td = $td.prev();
          }
          if ($td.next('td').length < 1) {
            $resizeHandle.hide();
            return;
          }
          if ((_ref = $resizeHandle.data('td')) != null ? _ref.is($td) : void 0) {
            $resizeHandle.show();
            return;
          }
          index = $td.parent().find('td').index($td);
          $col = $colgroup.find('col').eq(index);
          if ((_ref1 = $resizeHandle.data('col')) != null ? _ref1.is($col) : void 0) {
            $resizeHandle.show();
            return;
          }
          return $resizeHandle.css('left', $td.position().left + $td.outerWidth() - 5).data('td', $td).data('col', $col).show();
        };
      })(this));
      $wrapper.on('mouseleave', (function(_this) {
        return function(e) {
          return $resizeHandle.hide();
        };
      })(this));
      return $wrapper.on('mousedown', '.simditor-resize-handle', (function(_this) {
        return function(e) {
          var $handle, $leftCol, $leftTd, $rightCol, $rightTd, minWidth, startHandleLeft, startLeftWidth, startRightWidth, startX, tableWidth;
          $handle = $(e.currentTarget);
          $leftTd = $handle.data('td');
          $leftCol = $handle.data('col');
          $rightTd = $leftTd.next('td');
          $rightCol = $leftCol.next('col');
          startX = e.pageX;
          startLeftWidth = $leftTd.outerWidth() * 1;
          startRightWidth = $rightTd.outerWidth() * 1;
          startHandleLeft = parseFloat($handle.css('left'));
          tableWidth = $leftTd.closest('table').width();
          minWidth = 50;
          $(document).on('mousemove.simditor-resize-table', function(e) {
            var deltaX, leftWidth, rightWidth;
            deltaX = e.pageX - startX;
            leftWidth = startLeftWidth + deltaX;
            rightWidth = startRightWidth - deltaX;
            if (leftWidth < minWidth) {
              leftWidth = minWidth;
              deltaX = minWidth - startLeftWidth;
              rightWidth = startRightWidth - deltaX;
            } else if (rightWidth < minWidth) {
              rightWidth = minWidth;
              deltaX = startRightWidth - minWidth;
              leftWidth = startLeftWidth + deltaX;
            }
            $leftCol.attr('width', (leftWidth / tableWidth * 100) + '%');
            $rightCol.attr('width', (rightWidth / tableWidth * 100) + '%');
            return $handle.css('left', startHandleLeft + deltaX);
          });
          $(document).one('mouseup.simditor-resize-table', function(e) {
            $(document).off('.simditor-resize-table');
            return $wrapper.removeClass('resizing');
          });
          $wrapper.addClass('resizing');
          return false;
        };
      })(this));
    };

    TableButton.prototype.decorate = function($table) {
      if ($table.parent('.simditor-table').length > 0) {
        this.undecorate($table);
      }
      $table.wrap('<div class="simditor-table"></div>');
      this.initResize($table);
      return $table.parent();
    };

    TableButton.prototype.undecorate = function($table) {
      if (!($table.parent('.simditor-table').length > 0)) {
        return;
      }
      return $table.parent().replaceWith($table);
    };

    TableButton.prototype.renderMenu = function() {
      $('<div class="menu-create-table">\n</div>\n<div class="menu-edit-table">\n  <ul>\n    <li><a tabindex="-1" unselectable="on" class="menu-item" href="javascript:;" data-param="deleteRow"><span>删除行</span></a></li>\n    <li><a tabindex="-1" unselectable="on" class="menu-item" href="javascript:;" data-param="insertRowAbove"><span>在上面插入行</span></a></li>\n    <li><a tabindex="-1" unselectable="on" class="menu-item" href="javascript:;" data-param="insertRowBelow"><span>在下面插入行</span></a></li>\n    <li><span class="separator"></span></li>\n    <li><a tabindex="-1" unselectable="on" class="menu-item" href="javascript:;" data-param="deleteCol"><span>删除列</span></a></li>\n    <li><a tabindex="-1" unselectable="on" class="menu-item" href="javascript:;" data-param="insertColLeft"><span>在左边插入列</span></a></li>\n    <li><a tabindex="-1" unselectable="on" class="menu-item" href="javascript:;" data-param="insertColRight"><span>在右边插入列</span></a></li>\n    <li><span class="separator"></span></li>\n    <li><a tabindex="-1" unselectable="on" class="menu-item" href="javascript:;" data-param="deleteTable"><span>删除表格</span></a></li>\n  </ul>\n</div>').appendTo(this.menuWrapper);
      this.createMenu = this.menuWrapper.find('.menu-create-table');
      this.editMenu = this.menuWrapper.find('.menu-edit-table');
      this.createTable(6, 6).appendTo(this.createMenu);
      this.createMenu.on('mouseenter', 'td', (function(_this) {
        return function(e) {
          var $td, $tr, num;
          _this.createMenu.find('td').removeClass('selected');
          $td = $(e.currentTarget);
          $tr = $td.parent();
          num = $tr.find('td').index($td) + 1;
          return $tr.prevAll('tr').addBack().find('td:lt(' + num + ')').addClass('selected');
        };
      })(this));
      this.createMenu.on('mouseleave', (function(_this) {
        return function(e) {
          return $(e.currentTarget).find('td').removeClass('selected');
        };
      })(this));
      return this.createMenu.on('mousedown', 'td', (function(_this) {
        return function(e) {
          var $closestBlock, $table, $td, $tr, colNum, rowNum;
          _this.wrapper.removeClass('menu-on');
          if (!_this.editor.inputManager.focused) {
            return;
          }
          $td = $(e.currentTarget);
          $tr = $td.parent();
          colNum = $tr.find('td').index($td) + 1;
          rowNum = $tr.prevAll('tr').length + 1;
          $table = _this.createTable(rowNum, colNum, true);
          $closestBlock = _this.editor.util.closestBlockEl();
          if (_this.editor.util.isEmptyNode($closestBlock)) {
            $closestBlock.replaceWith($table);
          } else {
            $closestBlock.after($table);
          }
          _this.decorate($table);
          _this.editor.selection.setRangeAtStartOf($table.find('td:first'));
          _this.editor.trigger('valuechanged');
          _this.editor.trigger('selectionchanged');
          return false;
        };
      })(this));
    };

    TableButton.prototype.createTable = function(row, col, phBr) {
      var $table, $tbody, $td, $tr, c, r, _i, _j;
      $table = $('<table/>');
      $tbody = $('<tbody/>').appendTo($table);
      for (r = _i = 0; 0 <= row ? _i < row : _i > row; r = 0 <= row ? ++_i : --_i) {
        $tr = $('<tr/>').appendTo($tbody);
        for (c = _j = 0; 0 <= col ? _j < col : _j > col; c = 0 <= col ? ++_j : --_j) {
          $td = $('<td/>').appendTo($tr);
          if (phBr) {
            $td.append(this.editor.util.phBr);
          }
        }
      }
      return $table;
    };

    TableButton.prototype.refreshTableWidth = function($table) {
      var cols, tableWidth;
      tableWidth = $table.width();
      cols = $table.find('col');
      return $table.find('tr:first td').each((function(_this) {
        return function(i, td) {
          var $col;
          $col = cols.eq(i);
          return $col.attr('width', ($(td).outerWidth() / tableWidth * 100) + '%');
        };
      })(this));
    };

    TableButton.prototype.setActive = function(active) {
      TableButton.__super__.setActive.call(this, active);
      if (active) {
        this.createMenu.hide();
        return this.editMenu.show();
      } else {
        this.createMenu.show();
        return this.editMenu.hide();
      }
    };

    TableButton.prototype.deleteRow = function($td) {
      var $newTr, $tr, index;
      $tr = $td.parent('tr');
      if ($tr.siblings('tr').length < 1) {
        return this.deleteTable($td);
      } else {
        $newTr = $tr.next('tr');
        if (!($newTr.length > 0)) {
          $newTr = $tr.prev('tr');
        }
        index = $tr.find('td').index($td);
        $tr.remove();
        return this.editor.selection.setRangeAtEndOf($newTr.find('td').eq(index));
      }
    };

    TableButton.prototype.insertRow = function($td, direction) {
      var $newTr, $table, $tr, colNum, i, index, _i;
      if (direction == null) {
        direction = 'after';
      }
      $tr = $td.parent('tr');
      $table = $tr.closest('table');
      colNum = 0;
      $table.find('tr').each((function(_this) {
        return function(i, tr) {
          return colNum = Math.max(colNum, $(tr).find('td').length);
        };
      })(this));
      $newTr = $('<tr/>');
      for (i = _i = 1; 1 <= colNum ? _i <= colNum : _i >= colNum; i = 1 <= colNum ? ++_i : --_i) {
        $('<td/>').append(this.editor.util.phBr).appendTo($newTr);
      }
      $tr[direction]($newTr);
      index = $tr.find('td').index($td);
      return this.editor.selection.setRangeAtStartOf($newTr.find('td').eq(index));
    };

    TableButton.prototype.deleteCol = function($td) {
      var $newTd, $table, $tr, index;
      $tr = $td.parent('tr');
      if ($tr.siblings('tr').length < 1 && $td.siblings('td').length < 1) {
        return this.deleteTable($td);
      } else {
        index = $tr.find('td').index($td);
        $newTd = $td.next('td');
        if (!($newTd.length > 0)) {
          $newTd = $tr.prev('td');
        }
        $table = $tr.closest('table');
        $table.find('col').eq(index).remove();
        $table.find('tr').each((function(_this) {
          return function(i, tr) {
            return $(tr).find('td').eq(index).remove();
          };
        })(this));
        this.refreshTableWidth($table);
        return this.editor.selection.setRangeAtEndOf($newTd);
      }
    };

    TableButton.prototype.insertCol = function($td, direction) {
      var $col, $newCol, $newTd, $table, $tr, index, tableWidth, width;
      if (direction == null) {
        direction = 'after';
      }
      $tr = $td.parent('tr');
      index = $tr.find('td').index($td);
      $table = $td.closest('table');
      $col = $table.find('col').eq(index);
      $table.find('tr').each((function(_this) {
        return function(i, tr) {
          var $newTd;
          $newTd = $('<td/>').append(_this.editor.util.phBr);
          return $(tr).find('td').eq(index)[direction]($newTd);
        };
      })(this));
      $newCol = $('<col/>');
      $col[direction]($newCol);
      tableWidth = $table.width();
      width = Math.max(parseFloat($col.attr('width')) / 2, 50 / tableWidth * 100);
      $col.attr('width', width + '%');
      $newCol.attr('width', width + '%');
      this.refreshTableWidth($table);
      $newTd = direction === 'after' ? $td.next('td') : $td.prev('td');
      return this.editor.selection.setRangeAtStartOf($newTd);
    };

    TableButton.prototype.deleteTable = function($td) {
      var $block, $table;
      $table = $td.closest('.simditor-table');
      $block = $table.next('p');
      $table.remove();
      if ($block.length > 0) {
        return this.editor.selection.setRangeAtStartOf($block);
      }
    };

    TableButton.prototype.command = function(param) {
      var $td, range;
      range = this.editor.selection.getRange();
      $td = $(range.commonAncestorContainer).closest('td');
      if (!($td.length > 0)) {
        return;
      }
      if (param === 'deleteRow') {
        this.deleteRow($td);
      } else if (param === 'insertRowAbove') {
        this.insertRow($td, 'before');
      } else if (param === 'insertRowBelow') {
        this.insertRow($td);
      } else if (param === 'deleteCol') {
        this.deleteCol($td);
      } else if (param === 'insertColLeft') {
        this.insertCol($td, 'before');
      } else if (param === 'insertColRight') {
        this.insertCol($td);
      } else if (param === 'deleteTable') {
        this.deleteTable($td);
      } else {
        return;
      }
      this.editor.trigger('valuechanged');
      return this.editor.trigger('selectionchanged');
    };

    return TableButton;

  })(Button);

  Simditor.Toolbar.addButton(TableButton);

  StrikethroughButton = (function(_super) {
    __extends(StrikethroughButton, _super);

    function StrikethroughButton() {
      return StrikethroughButton.__super__.constructor.apply(this, arguments);
    }

    StrikethroughButton.prototype.name = 'strikethrough';

    StrikethroughButton.prototype.icon = 'strikethrough';

    StrikethroughButton.prototype.title = '删除线文字';

    StrikethroughButton.prototype.htmlTag = 'strike';

    StrikethroughButton.prototype.disableTag = 'pre';

    StrikethroughButton.prototype.status = function($node) {
      var active;
      if ($node != null) {
        this.setDisabled($node.is(this.disableTag));
      }
      if (this.disabled) {
        return true;
      }
      active = document.queryCommandState('strikethrough') === true;
      this.setActive(active);
      return active;
    };

    StrikethroughButton.prototype.command = function() {
      document.execCommand('strikethrough');
      this.editor.trigger('valuechanged');
      return this.editor.trigger('selectionchanged');
    };

    return StrikethroughButton;

  })(Button);

  Simditor.Toolbar.addButton(StrikethroughButton);

}).call(this);
(function() {
  var Uploader,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Uploader = (function(_super) {
    __extends(Uploader, _super);

    Uploader.count = 0;

    Uploader.prototype.opts = {
      url: '',
      params: null,
      connectionCount: 3,
      leaveConfirm: '正在上传文件，如果离开上传会自动取消'
    };

    Uploader.prototype.files = [];

    Uploader.prototype.queue = [];

    Uploader.prototype.html5 = !!(window.File && window.FileList);

    function Uploader(opts) {
      if (opts == null) {
        opts = {};
      }
      $.extend(this.opts, opts);
      this.id = ++Uploader.count;
      this.on('uploadcomplete', (function(_this) {
        return function(e, file) {
          _this.files.splice($.inArray(file, _this.files), 1);
          if (_this.queue.length > 0 && _this.files.length < _this.opts.connectionCount) {
            return _this.upload(_this.queue.shift());
          } else {
            return _this.uploading = false;
          }
        };
      })(this));
      $(window).on('beforeunload.uploader-' + this.id, (function(_this) {
        return function(e) {
          if (!_this.uploading) {
            return;
          }
          e.originalEvent.returnValue = _this.opts.leaveConfirm;
          return _this.opts.leaveConfirm;
        };
      })(this));
    }

    Uploader.prototype.generateId = (function() {
      var id;
      id = 0;
      return function() {
        return id += 1;
      };
    })();

    Uploader.prototype.upload = function(file, opts) {
      var f, _i, _len;
      if (opts == null) {
        opts = {};
      }
      if (file == null) {
        return;
      }
      if ($.isArray(file)) {
        for (_i = 0, _len = file.length; _i < _len; _i++) {
          f = file[_i];
          this.upload(f, opts);
        }
      } else if ($(file).is('input:file') && this.html5) {
        this.upload($.makeArray($(file)[0].files), opts);
      } else if (!file.id || !file.obj) {
        file = this.getFile(file);
      }
      if (!(file && file.obj)) {
        return;
      }
      $.extend(file, opts);
      if (this.files.length >= this.opts.connectionCount) {
        this.queue.push(file);
        return;
      }
      if (this.triggerHandler('beforeupload', [file]) === false) {
        return;
      }
      this.files.push(file);
      if (this.html5) {
        this.xhrUpload(file);
      } else {
        this.iframeUpload(file);
      }
      return this.uploading = true;
    };

    Uploader.prototype.getFile = function(fileObj) {
      var name, _ref, _ref1;
      if (fileObj instanceof window.File || fileObj instanceof window.Blob) {
        name = (_ref = fileObj.fileName) != null ? _ref : fileObj.name;
      } else if ($(fileObj).is('input:file')) {
        name = $input.val().replace(/.*(\/|\\)/, "");
        fileObj = $(fileObj).clone();
      } else {
        return null;
      }
      return {
        id: this.generateId(),
        url: this.opts.url,
        params: this.opts.params,
        name: name,
        size: (_ref1 = fileObj.fileSize) != null ? _ref1 : fileObj.size,
        ext: name ? name.split('.').pop().toLowerCase() : '',
        obj: fileObj
      };
    };

    Uploader.prototype.xhrUpload = function(file) {
      var formData, k, v, _ref;
      formData = new FormData();
      formData.append("upload_file", file.obj);
      formData.append("original_filename", file.name);
      if (file.params) {
        _ref = file.params;
        for (k in _ref) {
          v = _ref[k];
          formData.append(k, v);
        }
      }
      return file.xhr = $.ajax({
        url: file.url,
        data: formData,
        processData: false,
        contentType: false,
        type: 'POST',
        headers: {
          'X-File-Name': encodeURIComponent(file.name)
        },
        xhr: function() {
          var req;
          req = $.ajaxSettings.xhr();
          if (req) {
            req.upload.onprogress = (function(_this) {
              return function(e) {
                return _this.progress(e);
              };
            })(this);
          }
          return req;
        },
        progress: (function(_this) {
          return function(e) {
            if (!e.lengthComputable) {
              return;
            }
            return _this.trigger('uploadprogress', [file, e.loaded, e.total]);
          };
        })(this),
        error: (function(_this) {
          return function(xhr, status, err) {
            return _this.trigger('uploaderror', [file, xhr, status]);
          };
        })(this),
        success: (function(_this) {
          return function(result) {
            _this.trigger('uploadprogress', [file, file.size, file.size]);
            return _this.trigger('uploadsuccess', [file, result]);
          };
        })(this),
        complete: (function(_this) {
          return function(xhr, status) {
            return _this.trigger('uploadcomplete', [file, xhr.responseText]);
          };
        })(this)
      });
    };

    Uploader.prototype.iframeUpload = function(file) {
      var k, v, _ref;
      file.iframe = $('iframe', {
        src: 'javascript:false;',
        name: 'uploader-' + file.id
      }).hide().appendTo(document.body);
      file.form = $('<form/>', {
        method: 'post',
        enctype: 'multipart/form-data',
        action: file.url,
        target: file.iframe[0].name
      }).hide().append(file.obj).appendTo(document.body);
      if (file.params) {
        _ref = file.params;
        for (k in _ref) {
          v = _ref[k];
          $('<input/>', {
            type: 'hidden',
            name: k,
            value: v
          }).appendTo(form);
        }
      }
      file.iframe.on('load', (function(_this) {
        return function() {
          var error, iframeDoc, json, responseEl, result;
          if (!(iframe.parent().length > 0)) {
            return;
          }
          iframeDoc = iframe[0].contentDocument;
          if (iframeDoc && iframeDoc.body && iframeDoc.body.innerHTML === "false") {
            return;
          }
          responseEl = iframeDoc.getElementById('json-response');
          json = responseEl ? responseEl.innerHTML : iframeDoc.body.innerHTML;
          try {
            result = $.parseJSON(json);
          } catch (_error) {
            error = _error;
            _this.trigger('uploaderror', [file, null, 'parsererror']);
            result = {};
          }
          if (result.success) {
            _this.trigger('uploadsuccess', [file, result]);
          }
          _this.trigger('uploadcomplete', [file, result]);
          return file.iframe.remove();
        };
      })(this));
      return file.form.submit().remove();
    };

    Uploader.prototype.cancel = function(file) {
      var f, _i, _len, _ref;
      if (!file.id) {
        _ref = this.files;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          f = _ref[_i];
          if (f.id === file) {
            file = f;
            break;
          }
        }
      }
      this.trigger('uploadcancel', [file]);
      if (this.html5) {
        if (file.xhr) {
          file.xhr.abort();
        }
        return file.xhr = null;
      } else {
        file.iframe.attr('src', 'javascript:false;').remove();
        return this.trigger('uploadcomplete', [file]);
      }
    };

    Uploader.prototype.readImageFile = function(fileObj, callback) {
      var fileReader, img;
      if (!$.isFunction(callback)) {
        return;
      }
      img = new Image();
      img.onload = function() {
        return callback(img);
      };
      img.onerror = function() {
        return callback();
      };
      if (window.FileReader && FileReader.prototype.readAsDataURL && /^image/.test(fileObj.type)) {
        fileReader = new FileReader();
        fileReader.onload = function(e) {
          return img.src = e.target.result;
        };
        return fileReader.readAsDataURL(fileObj);
      } else {
        return callback();
      }
    };

    Uploader.prototype.destroy = function() {
      var file, _i, _len, _ref;
      this.queue.length = 0;
      _ref = this.files;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        file = _ref[_i];
        this.cancel(file);
      }
      $(window).off('.uploader-' + this.id);
      return $(document).off('.uploader-' + this.id);
    };

    return Uploader;

  })(Module);

  this.simple || (this.simple = {});

  this.simple.uploader = function(opts) {
    return new Uploader(opts);
  };

}).call(this);
(function() {
  $(document).on('page:fetch', function() {
    return NProgress.start();
  });

  $(document).on('page:change', function() {
    return NProgress.done();
  });

  $(document).on('page:restore', function() {
    return NProgress.remove();
  });

  $(document).on('page:update', function() {
    var jumbotron, search_form;
    $('[data-behaviors~=autosize]').autosize();
    $("time[data-behaviors~=timeago]").timeago();
    search_form = $('form.search-form');
    $('input', search_form).focus(function() {
      return search_form.addClass('typing');
    }).blur(function() {
      return search_form.removeClass('typing');
    });
    $('b', search_form).on('click', function() {
      return search_form.submit();
    });
    $('a.apptoggle').on('click', function() {
      $('#jumbotron').slideToggle();
      return $(this).parent('li').toggleClass('active');
    });
    jumbotron = $('#jumbotron');
    $('.androidbtn', jumbotron).hover(function() {
      if (!glo_touchDevice) {
        $('.androidpic').show();
        return $('.iphonepic').hide();
      }
    }, null);
    $('.iphonebtn', jumbotron).hover(function() {
      if (!glo_touchDevice) {
        $('.androidpic').hide();
        return $('.iphonepic').show();
      }
    }, null);
    return $('.qrwapper, .qrwapper>.close', jumbotron).on('click', function() {
      return $('.qrcode', jumbotron).fadeToggle();
    });
  });

  window.glo_iosapp_nav = function() {
    return $('button.navbar-toggle').click();
  };

}).call(this);
