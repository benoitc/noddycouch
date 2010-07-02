/*
 * This file is part of noddycouch released under the MIT license. 
 * See the NOTICE for more information. */

var events = require('events'),
    sys = require('sys'),
    resource = require('./resource'),
    url = require('url'),
    fs = require('fs'),
    rpath = require('path'),
    mime = require('./util/mime');
    
var Server = function(uri) {
  resource.Resource.call(this, uri)
}        
sys.inherits(Server, resource.Resource)

Server.prototype.info = function(options) {
  this.get(options)
  
};

Server.prototype.create_db = function(dbname, options) {
  this.put("/" + dbname, options);
  
};

Server.prototype.delete_db = function(dbname, options) {
  this.del("/" + dbname, options);
  
}

Server.prototype.all_dbs = function(options) { 
  this.get("/_all_dbs", options);
  
}

Server.prototype.replicate = function(options) {
  this.post("/_replicate", options);
  
}

Server.prototype.uuids = function(options) {
  this.get("/_uuids", options);
}

var Uuids = function(uri) {
  resource.Resource.call(this, uri);
  this.uri += "/_uuids";
  this.url = url.parse(this.uri);
  this.max_uuids = 1000;
  this.uuids = [];    
}
sys.inherits(Uuids, resource.Resource);

Uuids.prototype.fetch_uuids = function(count, options) {
  var options = options || {},
      params = options.params || {};
      
  params.count = count;
  options.params = params;
  this.get(options);
  
}

Uuids.prototype.uuid = function(options) {
  var self = this;
  if (this.uuids.length > 0) {
    
    if (options && options.success) {
      options.success(this.uuids.pop());
    } 
  } else {
    this.fetch_uuids(this.max_uuids, {
      success: function(data) {
        self.uuids = data.uuids;
        if (options && options.success) {
          options.success(self.uuids.shift());
        }
      },
      error: function() {
        if (options && options.error) {
          options.errors(arguments);
        }
      }
      
    });
  }
}

var Database = function(uri) {
  resource.Resource.call(this, uri);
  
  // get server uri & dbname
  var uri_parts = this.uri.split("/")
  this.dbname = uri_parts.pop()
  this.server_uri = uri_parts.join("/");
  
  this.uuids = new Uuids(this.server_uri)
}
sys.inherits(Database, resource.Resource)

Database.prototype.info = function(options) {
  this.get(options);  
}

Database.prototype.exists = function(docid, callback) {
  this.head("/docid", {
    startResponse: function(response) {
      if (response.statusCode >= 400 && response.statusCode != 404) {
        throw new resource.HttpError(utils.httpError(response.statusCode), 
                      response.statusCode, '');
      } else {
        callback((response.statusCode != 404), response);
      }
    }
  });
}

Database.prototype.saveDoc = function(doc, options) {
  var self = this;
  
  if (doc._attachments && options.encod_attachments) {
    // do we encode attachments
    doc['attachments'] = utils.encodeAttachements(doc['attachments']);
  }

  if (!doc._id || typeof(doc._id) == "undefined") {
    this.uuids.uuid({
      success: function(uuid) {
        doc['_id'] = uuid;
        self.put("/" + doc['_id'], doc, options);
      }
    });
    return;
  }
  self.put("/" + doc['_id'], doc, options);
}

Database.prototype.openDoc = function(doc_or_id, options) {
  if (typeof(doc_or_id) == "string") {
    var docid = doc_or_id;
  } else {
    var docid = doc_or_id._id;
  }

  this.get("/" + docid, options);
}

Database.prototype.lastRev = function(docid, options) {
  this.head("/" + docid, {
    startResponse: function(response) {
      if (response.statusCode >= 400) {
        if (options && options.error) {
          error = httpError(response.statusCode)
          return options.error(error, status);
        }
      } else {
        rev = response.headers['etag'].replace(/"/g, '')
        if (options && options.success) {
          return options.success(rev);
        }
      }
    }
  });
}

Database.prototype.deleteDoc = function(doc_or_id, options) {
  var self = this;
  
  if (typeof(doc_or_id) == "string") {
    var docid = doc_or_id;
    var rev = null;
  } else {
    var docid = doc_or_id._id;
    var rev = doc_or_id._rev || null;
    
  }
  
  function delete_doc(docid, rev) {
    options.params.rev = rev
    self.del(docid, options);
  }
  
  if (!rev) {
    this.lastRev(docid, {
      success: function(rev) {
        delete_doc(docid, rev);
      },
      error: function(error, msg, buff) {
        if (options && options.errors) {
          options.error(error, msg, buff)
        }
      }
    });
  } else {
    delete_doc(docid, rev);
  } 
};


Database.prototype.saveDocs = function(docs, options) {
  var self = this;
  var noids = [];
  docs.forEach(function(doc, idx) {
    if (!doc._id) {
      noids.append(idx);
    } 
  });
  
  if (noids) {
    this.uuids.fetch_uuids(noids.length, {
      success: function(uuids) {
        noids.forEach(function(idx) {
         docs[idx]._id = uuids.shift();
        });
        self.post("/_bulkdocs", { "docs": docs }, options);
      }
      
    });

  } else {
    self.post("/_bulkdocs", { "docs": docs }, options);
  }
}

Database.prototype.deleteDocs = function(docs, options) {
  docs.forEach(function(doc, idx) {
    docs[idx]['_deleted'] = true;
  });
  this.saveDocs(docs, options);
  
} 

Database.prototype.allDocs = function(options) {
  var options = options || {};
  var params = options.params || {}
  
  if ( params && params.keys) {
    var keys = params.keys;
    delete options.params["keys"];
    this.post("/_all_docs", {keys: keys}, options);
  } else {
    this.get("/_all_docs", options);
  }
}

Database.prototype.view = function(name, options) {
  var options = options || {};
  var params = options.params || {}
  
  [dname, vname] = name.split("/");
  docid = "/_design/" + dname + "/vname";

  if (params && params.keys) {
    var keys = params.keys;
    delete options.params["keys"];
    this.post(docid, {keys: keys}, options);
  } else {
    this.get(docid, options);
  }
  
}

Database.prototype.fetchAttachment = function(docid, name, options) {
  var options = options || {};
  var path = "/" + docid + "/" + name;
  
  options.responseEncoding = "binary";
  this.get(path, options);
}

Database.prototype.putAttachment = function(docid, payload, name, options) {
  var options = options || {};
  var path = "/" + docid + "/" + name;
  var params = options.params || {};
  var self = this;

  var payload = payload
  if (!params.rev) { // put attachment on last rev
    this.lastRev(docid, {
      success: function(rev) {
        params.rev = rev;
        options.params = params;
        self.put(path, payload, options);
      },
      error: function(error, msg, buff) {
        if (options && options.errors) {
          options.error(error, msg, buff)
        }
      }
    });
  } else {
   self.put(path, payload, options);
  }
}

Database.prototype.fputAttachment = function() {
  var args = Array.prototype.slice.call(arguments, 0);
  var self = this;
  
  if (args.length == 4) {
    var docid = args.shift(),
        fpath = args.shift(),
        name = args.shift(),
        options = args.shift() || {},
        headers = options.headers || {};
    
  } else if (args.length == 3) {
    
    var docid = args.shift(),
        fpath = args.shift(),
        options = args.shift() || {},
        fname = path.basename(fpath),
        name = fname,
        headers = options.headers || {};
  } 
  
  fpath = fs.realpathSync(fpath);

  // detect content-type
  if (!headers["content-type"]) {
    ext = rpath.extname(fpath)
    if (ext) ext = ext.substr(1)
    ctype = mime.mime(ext) || 'application/octet-stream';
    headers["content-type"] = ctype;
  }
  
  // get file size
  stats = fs.statSync(fpath)
  headers["content-length"] = stats.size;
  
  options.headers = headers;
  
  var stream = fs.createReadStream(fpath);
  var path = "/" + docid + "/" + name;
  var params = options.params || {};

  stream.addListener("open", function() {
    stream.pause()
    self.putAttachment(docid, stream, name, options)
  });
}


Database.prototype.delAttachment = function(docid, name, options) {
  var options = options || {};
  var path = "/" + docid + "/" + name;
  var params = options.params || {};
  
  if (!params.rev) { // put attachment on last rev
    this.lastRev(docid, {
      success: function(rev) {
        params.rev = rev;
        options.params = params;
        this.del(path, options);
        
      },
      error: function(error, msg, buff) {
        if (options && options.errors) {
          options.error(error, msg, buff)
        }
      }
    });
  } else {
    this.del(path, options);
    
  }
}

Database.prototype.copyDoc = function() {
  var self = this;
  var args = Array.prototype.slice.call(arguments, 0);
  if (args.length == 3) {
    var doc = args.shift(),
        dest = args.shift(),
        options = args.shift() || {},
        headers = options.headers || {};
  } else {
    var doc = args.shift(),
        options = args.shift() || {},
        dest= null,
        headers = options.headers || {};
  }

  if (typeof(doc) == "string") {
    var docid = doc;
  } else {
    var docid = doc['_id'];
  }
  
  if (!docid) throw new Error("copyDoc: docid unknown");
  
  if (!dest) {
    this.uuids.uuid({
      success: function(uuid) {
        headers["destination"] = uuid;
        options.headers= headers;
        self.copy("/" + docid, options);
      },
      error: function() {
        if (options.errors) options.errors(arguments);
      }
    });
  } else if (typeof(dest) == "string") {
    
    try {
      this.exists(dest, function(e, resp) {
        if (e) {
           rev = resp.headers['etag'].replace(/"/g, '');
           dest = dest + "?rev=" + rev;
        } 
        headers["destination"] = dest;
        options.headers= headers;
        self.copy("/" + docid, options);
      })
      
    } catch (e) {
      if (options.errors) options.errors(e[0], e[1], '')
    }
    
  } else {
    headers["destination"] = dest['_id'] + "?rev=" + dest['_rev'];
    options.headers= headers;
    self.copy("/" + docid, options);
  }
  
  
}

var Consumer = function(uri) {
  resource.Resource.call(this, uri);
  
}
sys.inherits(Consumer, resource.Resource);

Consumer.prototype.wait = function(params) {
  var self = this;
  var params = params || {}
  
  params["feed"] = "continuous";

  this.get("_changes", {
    params: params,
    startResponse: function(response) {
      
      var get_line = function(chunk) {
        if (chunk != "\n")
          try {
            var change = JSON.parse(chunk);
            if (!change.id) {
              self.emit("end", change);
              response.removeListener("data", get_line);
            } else {
              self.emit("change", change);
              return
            }
            
          } catch(e) {}
      }
      
      response
        .addListener("data", get_line)
        .addListener("end", function() {
          self.emit("end", "");
          response.removeListener("data", get_line);
        });
    }   
  });
}



exports.Server = Server;
exports.Uuids = Uuids;
exports.Database = Database;
exports.Consumer = Consumer;
