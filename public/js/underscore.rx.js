import Rx from 'rx';

const _ = {},
      root = window;

/**
 * Creates an observable for an Ajax request with either a settings object with url, headers, etc or a string for a URL.
 *
 * @example
 *   source = _.request('GET', '/products');
 *   source = Rx.DOM.ajax({ url: 'products', method: 'GET' });
 *
 * @param {String} method Method of the request, such as GET, POST, PUT, PATCH, DELETE
 * @param {String} resource The the URL or resource to request
 * @param {Object | FormData | string} data The data in the request of the request.
 * @param {Object} settings Can be one of the following:
 *
 *  The settings object may contain these properties:
 *   - async: Whether the request is async.
 *   - headers: Any optional headers.
 *   - crossDomain: whether this is a cross domain request, defaults to false.
 *   - responseType: 'json' or 'text', to treat response with if server gives no hints.
 *   - progressObserver: an Observable[] that you can use to print the progress of the
 *     upload/request.
 *   - normaliseError: browser-error-evt * XHR * String -> ErrorEvent
 *  {
 *    type: type,
 *    status: xhr.status,
 *    xhr: xhr,
 *    originalEvent: e
 *  }
 *   - normaliseSuccess: browser-success-evt * XHR * Settings -> SuccessEvent
 *  {
 *    response: response,
 *    status: xhr.status,
 *    responseType: xhr.responseType,
 *    xhr: xhr,
 *    originalEvent: e
 *  };
 *   - interceptors: an arrayish of interceptors that can change the opts
 *     before it's sent, signature Settings -> Settings
 *
 * @returns {Observable} An observable sequence containing the XMLHttpRequest.
 */
_.request = (function() {

  // Gets the proper XMLHttpRequest for support for older IE
  function getXMLHttpRequest() {
    if (root.XMLHttpRequest) {
      return new root.XMLHttpRequest();
    } else {
      let progId;
      try {
        let progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'];
        for (let i = 0; i < 3; i++) {
          try {
            progId = progIds[i];
            if (new root.ActiveXObject(progId)) {
              break;
            }
          } catch(e) {} // eslint-ignore-line eqeqeq no-empty
        }
        return new root.ActiveXObject(progId);
      } catch (e) {
        throw new Error('XMLHttpRequest is not supported by your browser');
      }
    }
  }

  // Get CORS support even for older IE
  function getCORSRequest() {
    let xhr = new root.XMLHttpRequest();
    if ('withCredentials' in xhr) {
      return xhr;
    } else if (root.XDomainRequest) {
      return new XDomainRequest();
    } else {
      throw new Error('CORS is not supported by your browser');
    }
  }

  let normaliseAjaxSuccessEvent = (e, xhr, s) => {
    let response = ('response' in xhr) ? xhr.response : xhr.responseText;
    response = s.responseType === 'json' ? JSON.parse(response) : response;
    return {
      response: response,
      status: xhr.status,
      responseType: xhr.responseType,
      xhr: xhr,
      originalEvent: e
    };
  };

  let normaliseAjaxErrorEvent = (e, xhr, type) => ({
    type: type,
    status: xhr.status,
    xhr: xhr,
    originalEvent: e
  });

  const requestFn = function (method, resource, data, opts = {}) {
    const
      dataInterceptors = requestFn.dataInterceptors.concat(opts.dataInterceptors || []),
      merged = [
        opts,
        {
          method: method,
          url: (/^https?:\/\//i.test(resource) ? resource : (root.location.origin + resource)),
          data: requestFn.dataInterceptors.reduce((st, f) => f(data), data)
        }
      ].reduce(_.merge, {
        async: true,
        crossDomain: false,
        createXHR: crossDomain => crossDomain ? getCORSRequest() : getXMLHttpRequest(),
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        normaliseError: normaliseAjaxErrorEvent,
        normaliseSuccess: normaliseAjaxSuccessEvent,
        responseType: 'json',
        progressObserver: null
      }),
      s = (opts.interceptors || []).reduce((settings, fn) => fn(settings), merged)

    return new Rx.AnonymousObservable(function (observer) {
      let isDone = false,
          xhr = s.createXHR(s.crossDomain),
          processResponse = (xhr, event) => {
            let status = xhr.status === 1223 ? 204 : xhr.status;
            if ((status >= 200 && status <= 500) || status === 0 || status === '') {
              observer.onNext(s.normaliseSuccess(event, xhr, s));
              observer.onCompleted();
            } else {
              observer.onError(s.normaliseError(event, xhr, 'error'));
            }
            isDone = true;
          };

      try {
        if (s.user) {
          xhr.open(s.method, s.url, s.async, s.user, s.password);
        } else {
          xhr.open(s.method, s.url, s.async);
        }
      } catch (e) {
        observer.onError(e);
        // no need for aborting, 'open' failed
        return () => { return; };
      }

      for (let header in s.headers) {
        if (!s.headers.hasOwnProperty(header)) {
          continue;
        }
        xhr.setRequestHeader(header, s.headers[header]);
      }

      // it's open, now subscribe everything
      if (!!xhr.upload || (!('withCredentials' in xhr) && !!root.XDomainRequest)) {
        xhr.onload = function(e) {
          if (s.progressObserver) {
            s.progressObserver.onNext(e);
            s.progressObserver.onCompleted();
          }
          processResponse(xhr, e);
        };

        if (s.progressObserver) {
          xhr.onprogress = s.progressObserver.onNext.bind(s.progressObserver);
        }

        xhr.onerror = function(e) {
          if (s.progressObserver) s.progressObserver.onError(e);
          observer.onError(s.normaliseError(e, xhr, 'error'));
          isDone = true;
        };

        xhr.onabort = function(e) {
          if (s.progressObserver) s.progressObserver.onError(e);
          observer.onError(s.normaliseError(e, xhr, 'abort'));
          isDone = true;
        };
      } else {
        xhr.onreadystatechange = function (e) {
          if (xhr.readyState === 4) {
            processResponse(xhr, e);
          }
        };
      }

      // we're set, let's send the request
      try {
        xhr.send(typeof s.data !== 'undefined' && s.data || null);
      } catch (e) {
        observer.onError(e);
      }

      // after sending request, we may abort it, even on error
      return () => {
        if (!isDone && xhr.readyState !== 4) {
          xhr.abort();
        }
      };
    });
  };

  const ctorOf = Function.prototype.call.bind(Object.prototype.toString);

  requestFn.dataInterceptors = [
    // stringify plain objects to JSON
    data => ctorOf(data) === "[object Object]"
              ? JSON.stringify(data)
              : data
    ];

  return requestFn;
})();

_.requestJSON = (resource, data, opts) =>
  _.request('GET', resource, data, opts).map(x => x.response);

/**
 * Intercept the request with the given function,
 * Returns the request function with the interceptor configured.
 */
_.requestWrap =
  fn =>
    (m, r, d, o) =>
      _.request(m, r, d, _.merge(o, { interceptors: [fn] }));

/**
 * This method wraps an EventSource as an observable sequence.
 * @param {String} url The url of the server-side script.
 * @param {Observer} [openObserver] An optional observer for the 'open' event for the server side event.
 * @returns {Observable} An observable sequence which represents the data from a server-side event.
 */
_.requestES = function (url, openObserver) {
  if (!EventSource) {
    throw new Error('EventSource not implemented in your runtime.');
  }

  return new Rx.AnonymousObservable(function (observer) {
    let source = new EventSource(url),
        onOpen = e => {
          if (openObserver) openObserver.onNext(e);
          if (openObserver) openObserver.onCompleted();
          source.removeEventListener('open', onOpen, false);
        },
        onError = e => {
          if (e.readyState === EventSource.CLOSED) {
            observer.onCompleted();
          } else {
            observer.onError(e);
          }
        },
        onMessage = observer.onNext.bind(observer);

    if (openObserver) source.addEventListener('open', onOpen, false);
    source.addEventListener('error', onError, false);
    source.addEventListener('message', onMessage, false);

    return () => {
      source.removeEventListener('error', onError, false);
      source.removeEventListener('message', onMessage, false);
      source.close();
    };
  });
};

_.requestESJSON = (resource) =>
  _.requestES(resource).map(x => JSON.parse(x.data));

export default underscore => {
  Object.assign(_, underscore);
  return _;
};
