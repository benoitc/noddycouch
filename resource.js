/*
 * This file is part of noddycouch released under the MIT license. 
 * See the NOTICE for more information. */
 
var base64 = require('./util/base64');
    events = require('events'),
    fs = require('fs'),
    sys = require('sys'),
    http = require('http'),
    url = require('url'),
    utils = require('./util/misc');
 

var HttpError = function(type, status, body) {
  this.type = type;
  this.status = status;
  this.body = body;
}
   

var Resource = function(uri) {
  events.EventEmitter.call(this);
  
  if (typeof(uri) == "undefined") {
    uri = "http://127.0.0.1:5984";
  }
  
  this.uri = uri;
  
  // parse url
  var u = this.url = url.parse(uri);
  if (!u.port) {
    this.port = 80;
  } else {
    this.port = u.port;
  }
  this.host = u.hostname;
  this.auth = u.auth || null;
};

sys.inherits(Resource, events.EventEmitter)

Resource.prototype.request = function(args) {
  var self = this;
  
  var args = Array.prototype.slice.call(args, 0);

  if (args.length > 3) {
    var method = args.shift() || "GET",
        path = args.shift() || "/",
        payload = args.shift(),
        options = args.shift() || {};
  } else if (args.length == 3) {
    var method = args.shift() || "GET",
        path = args.shift() || "/",
        options = args.shift() || {},
        payload = undefined;
  } else if (args.length == 2) {
    var method = args.shift() || "GET",
        options = args.shift() || {},
        path = "/",
        payload = undefined;
  } else {
    throw new Error("Incorrect number of Resource arguments")
  }
  
  var headers = options.headers || {},
      params = options.params || {};
  

  // init headers
  headers["host"] = this.host + ":" + this.port;
  headers["Connection"] = "keep-alive";
  
  if (!payload && (method == "POST" || method == "PUT")) payload = "";
  
  if (payload instanceof fs.ReadStream) {
    if (!payload.fd) throw new Error("fd is null");

    if (!headers['content-length']) 
      headers["transfer-encoding"] = "chunked";
      
  } else if (typeof(payload) == "object") { // we send json
    payload = JSON.stringify(payload)
    headers['content-type'] = "application/json";
    headers['content-length'] = String(payload.length);
  } else if ((typeof(payload) == "string")) { // set size
    headers['content-length'] = String(payload.length);
  }
  
  var auth = options.auth || this.auth;
  if (auth) headers['Authorization'] = 'Basic ' + base64.encode(auth);
  
  
  // create final uri
  var uri = utils.makeUri(this.url.pathname, path, params);
    // prepare request
  var couchdb = http.createClient(this.port, this.host);

  var request = couchdb.request(method.toUpperCase(), uri, headers);
  
  if (payload) {
    
    if (payload instanceof fs.ReadStream) {
      sys.log("info: start write chunk")
      payload.resume()
      payload.addListener("data", function(chunk) {
        if (request.write(chunk) === false) {
          var resume = function() {
            request.removeListener("drain", resume);
            payload.resume();
          }
          request.addListener("drain", resume)
          payload.pause()
        }
      })
      payload.addListener("end", function() {
        self._wait_response(request, options);
      })

    } else {
      request.write(payload);
      this._wait_response(request, options);
    }
  }  else {
    this._wait_response(request, options);
  }
  
  
};

function _requet_method(method, args) {
  // private method used to add method to args
  var args = Array.prototype.slice.call(args, 0);
  args.splice(0, 0, method);
  return args
}

Resource.prototype.head = function() {
  args = _requet_method("HEAD", arguments)
  return this.request(args);
};

Resource.prototype.get = function() {
  args = _requet_method("GET", arguments)
  return this.request( args);
};

Resource.prototype.del = function() {
  args = _requet_method("DELETE", arguments)
  return this.request(args);
};

Resource.prototype.post = function() {
  args = _requet_method("POST", arguments)
  return this.request(args);
};

Resource.prototype.put = function() {
  args = _requet_method("PUT", arguments)
  return this.request(args);
};

Resource.prototype.copy = function() {
  args = _requet_method("COPY", arguments)
  return this.request(args);
};

Resource.prototype._wait_response = function(request, options) {
  request.end()
  
  var options = options || {};
  
  var self = this;
    
  request.addListener("response", function(response) {
    if (options.startResponse) options.startResponse(response);

    var buf = [];
    var status = response.statusCode;
    var error = "";
    
    response.setEncoding(options.responseEncoding || 'utf8');
    
    response
      .addListener("data", function(chunk) {
        buf.push(chunk);
      })
      .addListener("end", function() {
        body = buf.join("");
        
        if (status >= 400) {
                      
          if (options.error) {
            error = utils.httpError(status)
            return options.error(error, status, body);
          }
          return;
        } else if (options.success) {
          if (options.responseEncoding == "binary") {
            return options.success(body, status);
          } else {
            try {
              json = JSON.parse(body);
            } catch (e) {
              if (options.error) 
                return options.error("json_error", e.message, body);
              throw e;
            } 
            return options.success(json, status);
          }
        }
       
      });
  });
  
};

exports.Resource = Resource;
exports.HttpError = HttpError;
