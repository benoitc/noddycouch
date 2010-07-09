/*
 * This file is part of noddycouch released under the MIT license. 
 * See the NOTICE for more information. */
 
var querystring = require('querystring'),
    base64 = require('./base64');



String.prototype.trim = function() {
  return (this.replace(/^[\s\xA0]+/, "").replace(/[\s\xA0]+$/, ""));
}

String.prototype.startsWith = function(str)  {
  return (this.match("^"+str)==str);
}

String.prototype.endsWith = function(str) {
  return (this.match(str+"$")==str);
}

var encodeParams = exports.encodeParams = function(params) {
  var _params = {};
  if (typeof(params) == "object") {
    for (var name in params) {
       if (!params.hasOwnProperty(name)) continue;
       if (name == "key" || name == "startkey" || name == "endkey") {
         _params[name] = JSON.stringify(params[name]);
       } else {
         _params[name] = String(params[name]);
       }
    }
  }
  return querystring.stringify(_params);
};
 
exports.makeUri = function(base, path, params) {
  var buf = [];
  
  if (base) {
    if (base && base.endsWith("/")) {
      base = base.slice(0, -1);
    }
    if (base.startsWith("/")) {
      base = base.substr(1)
    }
    buf.push(base);
  }
  
  if (path) {
    if (typeof(path) == "string") {
      if (path.startsWith("/")) {
        path = path.substr(1);
      }
      path = path.split("/");
    }
    path.forEach(function(item) {
      buf.push(encodeURIComponent(item));
    });
  } 
  return "/" + buf.join('/') + "?"+encodeParams(params);
};

exports.httpError = function(statusCode) {
  var error = "unknown";
  if (statusCode == 404) {
    error = "not_found";
  } else if (statusCode == 401 || statusCode == 403) {
    error = "not_authorized";
  } else if (statusCode == 409) {
    error = "conflict";
  } else if (statusCode == 412) {
    error = "precondition_failed";
  } else {
    error = "http_error";
  }
  return error;
}

exports.escape = function(docid) {
  if (docid.startswith('/')) docid = docid.substr(1)

  if (docid.startswith('_design')) {
    docid = '_design/' + querystring.escape(docid.substr(8))
  } else {
    docid = querystring.escape(docid)
  }
  return docid;
}

exports.encodeAttachements = function(attachments) {
  for (attname in attachments) {
    var att = attachments[attname];
    if (att.stub) {
      att[data] = base64.encode(att[data]).replace(/\s/, "");
    }
    attachments[attname] = att;
  }
  return attachments;
}
