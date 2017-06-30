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
  wins: Number,
  losses: Number,
}));

mongoose.connect('mongodb://do:doinstance@ds035543.mlab.com:35543/elo');

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

    winner.wins = winner.wins + 1 || 1;
    loser.losses = loser.losses + 1 || 1;
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

let lastBod = [];
let lastBodUpdate = null;

app.get('/bod', function(req, res) {
  let now = new Date();
  let freshPeriod = new Date().setHours(now.getHours() - 24);
  if(!lastBodUpdate || freshPeriod > lastBodUpdate)
  {
    Song.find({})
      .sort({ points: -1 })
      .select('title artist points')
      .exec((err, results) => {
        lastBod = results;
        lastBodUpdate = now;
        if(err) console.error(err);
        res.render('bod', {
          records: results.sort((a, b) => {
            if(req.query.flipit !== undefined) return a.points - b.points;
            else return b.points - a.points;
          }),
          flipit: req.query.flipit === undefined,
          lastUpdate: lastBodUpdate,
        });
      });
  }

  else {
    res.render('bod', {
      records: lastBod.sort((a, b) => {
        if(req.query.flipit !== undefined) return a.points - b.points;
        else return b.points - a.points;
      }),
      flipit: req.query.flipit === undefined,
      lastUpdate: lastBodUpdate,
    });
  }
});

app.get('/rebizzle', function(req, res) { 
  res.send('I hope you realize what this is. It should only be done in important situations.');
  process.exit(0); 
});

app.listen(3002, function() {
  console.log('Listening on port 3002!');
});

function normalizeScore(score)
{
  return Math.pow(10, score / 400);
}

function expectedScore(a, b)
{
  return a / (a + b);
}
