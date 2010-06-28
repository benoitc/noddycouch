/*
 * This file is part of noddycouch released under the MIT license. 
 * See the NOTICE for more information. */

var events = require('events'),
    sys = require('sys'),
    resource = require('./noddycouch/resource'),
    url = require('url');
    
    
var Server = function(uri) {
  resource.Resource.call(this, uri)
}        
sys.inherits(Server, resource.Resource)

Server.prototype.info = function(options) {
  req = this.get()
  this.wait_response(req, options);
};

Server.prototype.create_db = function(dbname, options) {
  req = this.put("/" + dbname);
  this.wait_response(req, options);
};

Server.prototype.delete_db = function(dbname, options) {
  req = this.del("/" + dbname);
  this.wait_response(req, options);
}

Server.prototype.all_dbs = function(options) { 
  req = this.get("/_all_dbs", null, {}, options.params);
  this.wait_response(req, options);
}

Server.prototype.replicate = function(options) {
  req = this.post("/_replicate", options.params);
  this.wait_response(req, options);
}

Server.prototype.uuids = function(options) {
  req = this.get("/_uuids", null, {}, options.params);
  this.wait_response(req, options);
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
  req = this.get("", null, {}, {"count": count});
  this.wait_response(req, options);
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
  req = this.get();
  this.wait_response(req, options)
  
}

Database.prototype.saveDoc = function(doc, options) {
  var self = this;
  
  function save_doc(doc, options) {
    req = self.put("/" + doc['_id'], doc);
    self.wait_response(req, options);
  }

  if (!doc._id || typeof(doc._id) == "undefined") {
    this.uuids.uuid({
      success: function(uuid) {
        doc['_id'] = uuid;
        sys.log(doc)
        save_doc(doc, options);
      }
    });
    return;
  }
  save_doc(doc, options);
  
}

Database.prototype.openDoc = function(doc_or_id, options) {
  if (typeof(doc_or_id) == "string") {
    var docid = doc_or_id._id;
  } else {
    var docid = doc._id;
  }

  req = this.get("/" + docid, null, {}, options.params);
  this.wait_response(req, options);
}

Database.prototype.last_rev = function(docid, options) {
  req = this.head(docid);
  req.addListener("response", function(response) {
    
    if (response.statusCode >= 400) {
      if (options.error) {
        error = httpError(response.statusCode)
        return options.error(error, status);
      }
      return
    }
    rev = headers['etag'].trim('"')
    if (options && options.success) {
      return options.success(rev);
    }
    
  })
}

Database.prototype.deleteDoc = function(doc_or_docid, options) {
  var self = this;
  
  if (typeof(doc_or_id) == "string") {
    var docid = doc_or_id._id;
    var rev = doc_or_id._rev || null;
  } else {
    var docid = doc._id;
    var rev = null;
  }
  
  function delete_doc(docid, rev) {
    options.params["rev"] = rev
    req = self.del(docid, null, {}, options.params);
    self.wait_response(options);
    
  }
  
  if (!rev) {
    this.last_rev(docid, {
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

exports.Server = Server;
exports.Uuids = Uuids;
exports.Database = Database;
