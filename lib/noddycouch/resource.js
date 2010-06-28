/*
 * This file is part of noddycouch released under the MIT license. 
 * See the NOTICE for more information. */
 
var events = require('events'),
    sys = require('sys'),
    http = require('http'),
    url = require('url'),
    utils = require('./utils');


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
  this.host = u.hostname
  
  this.queue = [];
};

sys.inherits(Resource, events.EventEmitter)

Resource.prototype.request = function(args) {
  var args = Array.prototype.slice.call(args, 0);
  
  var method = args.shift() || "GET",
      path = args.shift() || "/",
      payload = args.shift(),
      headers = args.shift() || {},
      params = args.shift();

  // init headers
  headers["host"] = this.host + ":" + this.port;
  
  // keepalive
  headers["Connection"] = "keep-alive";
    
  if (typeof(payload) == "object") { // we send json
    payload = JSON.stringify(payload)
    headers['content-type'] = "application/json";
    headers['content-length'] = String(payload.length);
  } else if ((typeof(payload) == "string")) { // set size
    headers['content-length'] = String(payload.length);
  }
  
  // create final uri
  var uri = utils.makeUri(this.url.pathname, path, params);
  
  sys.log("request " + method + " " + uri);

  var couchdb = http.createClient(this.port, this.host);
  var request = couchdb.request(method.toUpperCase(), uri, headers)
  
  if (payload) {
    // TODO: stream 
    request.write(payload);
  }
  request.end();
  
  return request;
};

function _requet_method(method, args) {
  // private method used to add method to args
  var args = Array.prototype.slice.call(args, 0);
  args.splice(0, 0, method);
  return args
}

Resource.prototype.head = function() {
  args = _requet_method("HEAD", arguments)
  return this.request( args);
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

Resource.prototype.wait_response = function(request, options) {
  var options = options || {};
  
  if (options.error || options.success ) {
    
    var self = this;
    request.addListener("response", function(response) {
      var buff = "";
      var status = response.statusCode;
      var error = "";
      response.setEncoding(options.responseEncoding || 'utf8');
      response
        .addListener("data", function(chunk) {
          buff += chunk;
        })
        .addListener("end", function() {
          if (status >= 400) {
            if (options.error) {
              error = httpError(status)
              return options.error(error, status, buff);
            }
            return;
          } else if (options.success) {
            if (options.responseEncoding == "binary") {
              return options.success(buff, status);
            } else {
              try {
                json = JSON.parse(buff);
              } catch (e) {
                if (options.error) {
                  return options.error("json_error", e.message, buff);
                }
              }
              return options.success(json, status);
            }
          }
        });
    });
  }
  
};

exports.Resource = Resource;