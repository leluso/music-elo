'use strict';

const K = 32;

let express = require('express');
let app = express();

let mongoose = require('mongoose');
let async = require('async');
let bodyParser = require('body-parser');

let Song = mongoose.model('Song', new mongoose.Schema({
  title: String,
  artist: String,
  year: Number,
  points: Number,
  first: Date,
}));

mongoose.connect('mongodb://localhost:27017/musicelo');

app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
  console.log('Getting');
  let data = { songs: [] };
  Song.count((e, n) => {
    async.parallel([
      function(song1Cb) {
        let rand = Math.floor(Math.random() * n);
        Song.findOne().skip(rand).exec((e, s) => {
          data.songs.push(s);
          song1Cb(e);
        });
      },
      function(song2Cb) {
        let rand = Math.floor(Math.random() * n);
        Song.findOne().skip(rand).exec((e, s) => {
          data.songs.push(s);
          song2Cb(e);
        });
      },
    ], (err) => {
      if(err) console.error(err);
      console.log('Rendering...');
      data.songs[0].other = data.songs[1];
      data.songs[1].other = data.songs[0];
      res.render('index', data);
    });
  });
});

app.post('/', function(req, res) {
  async.waterfall([
    function(cb) {
      Song.findOne({
        title: req.body.titleWinner,
        artist: req.body.artistWinner,
      }, cb);
    },

    function(w, cb) {
      Song.findOne({
        title: req.body.titleLoser,
        artist: req.body.artistLoser,
      }, (e, s) => {
        cb(e, w, s);
      });
    },
  ], (e, winner, loser) => {
    let winnerNormScore = normalizeScore(winner.points);
    let loserNormScore = normalizeScore(loser.points);

    let winnerExpected = expectedScore(winnerNormScore, loserNormScore);
    let loserExpected = expectedScore(loserNormScore, winnerNormScore);

    winner.points = winner.points + K * (1 - winnerExpected);
    loser.points = loser.points + K * (0 - loserExpected);

    async.parallel([
      winner.save,
      loser.save,
    ], (err) => {
      console.log('Thats that');
      if(err) console.error(err);
      res.redirect('/');
    });
  });
});

app.get('/bod', function(req, res) {
  Song.find({})
    .sort({ points: -(req.query.flipit === undefined) || 1 })
    .select('title artist points')
    .exec((err, results) => {
      if(err) console.error(err);
      res.render('bod', {
        records: results,
        flipit: req.query.flipit === undefined,
      });
    });
});

app.listen(3000, function() {
  console.log('Listening on port 3000!');
});

function normalizeScore(score)
{
  return Math.pow(10, score / 400);
}

function expectedScore(a, b)
{
  return a / (a + b);
}