var sys = require("sys"),
    Consumer = require('../couchdb').Consumer;

var c = new Consumer("http://127.0.0.1:5984/testdb");

c.addListener("change", function(change) {
  sys.puts("Got change "
          + "seq: " + change.seq
          + " on docid: " + change.id
          + " rev: " + change.changes[0].rev);
})

c.wait({heartbeat: true})