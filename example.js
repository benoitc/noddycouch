/*
 * This file is part of noddycouch released under the MIT license. 
 * See the NOTICE for more information. */

var sys = require("sys"),
    fs = require("fs"),
    noddycouch =require("./lib/noddycouch");
    
    
s = new noddycouch.Server()


s.info({
  success: function(b) {
    sys.puts("server info:" + b.version)
  }
});

s.uuids({
  success: function(b) {
    sys.puts("uuid:" + b.uuids[0])
  }
});

s.all_dbs({
  success: function(b) {
    sys.puts("all_dbs:" + b)
  }
});

s.create_db("testdb")

var db = new noddycouch.Database("http://127.0.0.1:5984/testdb");

db.info({
  responseEncoding: "binary",
  success: function(b) {
    sys.puts("db info:" + b)
  }
});


db.saveDoc({}, {
  success: function(doc) {
    
    sys.puts("empty doc saved:" + doc.id);
  },
  error: function(error) {
    sys.puts("error:" + error)
  }
  
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
      }
    })
    
  }
});

db.allDocs({
  success: function(docs) {
    
    sys.puts("all docs total rows:" + docs.total_rows )
    
  }
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
            sys.puts("fetched attachment :" + content)
          }
        });
      }
    });
  }
});


db.saveDoc({}, {
  success: function(res) {
    var res = res;
    sys.puts("notice doc saved: (" + res.id + "," +  res.rev +")");
    var docid = res.id;
    
    db.fputAttachment(res.id, "./NOTICE", "NOTICE", {
      success: function(res1) {
        db.fetchAttachment(docid, "NOTICE", {
          success: function(content) {
            sys.puts("fetched NOTICE :" + content)
          }
        });
      }
    });
  }
});