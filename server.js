var unirest = require("unirest");
var express = require("express");
var events = require("events");

var getFromApi = function(endpoint, args) {
  var emitter = new events.EventEmitter();

  unirest.get("https://api.spotify.com/v1/" + endpoint)
    .qs(args)
    .end(function(response) {
      if (response.ok) {
        emitter.emit("end", response.body);
      }
      else {
        emitter.emit("error", response.code);
      }
    });

  return emitter;
};

var app = express();
app.use(express.static("public"));

app.get("/search/:name", function(req, res) {
  var searchReq = getFromApi("search", {
    q: req.params.name,
    limit: 1,
    type: "artist"
  });

  searchReq.on("end", function(item) {
    var artist = item.artists.items[0];

    if (artist && artist.id) {
      var relatedArtistsReq = getFromApi("artists/" + artist.id + "/related-artists");

      // Get related artists.
      relatedArtistsReq.on("end", function(item) {
        var completed = 0;

        artist.related = item.artists;

        var checkComplete = function() {
          if (completed === item.artists.length) {
            res.json(artist);
          }
        }

        // Get top tracks for each related artist.
        item.artists.forEach(function(relatedArtist) {
          var topTracksReq = getFromApi("artists/" + relatedArtist.id + "/top-tracks", {
            country: "CA"
          });

          topTracksReq.on("end", function(item) {
            relatedArtist.tracks = item.tracks;
            completed++;
            checkComplete();
          });

          topTracksReq.on("error", function(item) {
            completed++;
            checkComplete();
          });
        });
      });

      relatedArtistsReq.on("error", function(item) {
        res.sendStatus(404);
      });
    }
    else {
      res.json(artist);
    }
  });

  searchReq.on("error", function(code) {
    res.sendStatus(code);
  });
});

app.listen(8080);