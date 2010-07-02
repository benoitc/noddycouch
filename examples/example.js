/*
 * This file is part of noddycouch released under the MIT license. 
 * See the NOTICE for more information. */

var sys = require("sys"),
    fs = require("fs"),
    couchdb =require("../couchdb");

function reportError(label) {
  return function(error) {
    sys.puts("ERROR: " + label + ": " + error);
  }
}


s = new couchdb.Server()


s.info({
  success: function(b) {
    sys.puts("server info:" + b.version)
  },
  error: reportError("server info")
});

s.uuids({
  success: function(b) {
    sys.puts("uuid:" + b.uuids[0])
  },
  error: reportError("uuids")
});

s.all_dbs({
  success: function(b) {
    sys.puts("all_dbs:" + b)
  },
  error: reportError("all_dbs")
});

s.create_db("testdb")

var db = new couchdb.Database("http://127.0.0.1:5984/testdb");

db.info({
  responseEncoding: "binary",
  success: function(b) {
    sys.puts("db info:" + b)
  },
  error: reportError("db info")

});


db.saveDoc({}, {
  success: function(doc) {
    
    sys.puts("empty doc saved:" + doc.id);
  },
  error: reportError("saving empty doc")
  
});

var doc = {
  "test": "essai"
}
db.saveDoc(doc, {
  success: function(doc) {
    sys.puts("doc saved: (" + doc.id + "," +  doc.rev +")");
    db.openDoc(doc.id, {
      success: function(doc1) {
        sys.puts("test = " + doc1.test);
        sys.puts("rev: " + doc.rev + " == " + doc1._rev);
      },
      error: reportError("opening test doc")
    })
    
  },
  error: reportError("saving test doc")
});

db.allDocs({
  success: function(docs) {
    
    sys.puts("all docs total rows:" + docs.total_rows )
    
  },
  error: reportError("retrieving all docs")
})


db.saveDoc({}, {
  success: function(res) {
    var res = res;
    sys.puts("doc saved: (" + res.id + "," +  res.rev +")");
    var docid = res.id;
    
    db.putAttachment(res.id, "test content", "test", {
      success: function(res1) {
        db.fetchAttachment(docid, "test", {
          success: function(content) {
            sys.puts("fetched attachment:" + content)
          },
          error: reportError("fetching hardcoded attachment")
        });
      },
      error: reportError("putting hardcoded attachment")
    });
  },
  error: reportError("saving empty doc for hardcoded attachment")
});


db.saveDoc({"for": "NOTICE"}, {
  success: function(res) {
    var res = res;
    sys.puts("NOTICE doc saved: (" + res.id + "," +  res.rev +")");
    var docid = res.id;
    
    db.fputAttachment(res.id, "./NOTICE", "NOTICE", {
      headers: {"content-type": "text/plain"},
      success: function(res1) {
        sys.puts("NOTICE file attached");
        db.fetchAttachment(docid, "NOTICE", {
          success: function(content) {
            sys.puts("fetched NOTICE :" + content)
          },
          error: reportError("fetching file attachment")
        });
      },
      error: reportError("putting file attachment")
    });
  },
  error: reportError("saving empty doc for file attachment")
});
