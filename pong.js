// Dependencies
var express = require('express'),
    Game    = require('./game');

var app = module.exports = express.createServer(),
    io  = require('socket.io').listen(app);

// Configuration
app.configure(function () {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
});

app.configure('development', function () {
  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function () {
  var oneYear = 31557600000;
  app.use(express.static(__dirname + '/public', { maxAge: oneYear }));
  app.use(express.errorHandler()); 
});

io.enable('browser client etag');
io.set('log level', 0);
io.set('transports', ['websocket', 'flashsocket']);

var games = [];

app.get('/create.php', function (req, res) {
  // Create new game
  var gameID = generateGameID();
  var game = new Game();

  games[gameID] = game;

  game.on('statechanged', function (state, stateString) { 
    console.log('Game ' + gameID + ' changed state: ' + stateString);
    
    if (state == 5)
      delete games[gameID];
  });

  // Redirect
  res.redirect('http://gmchat.blijbol.nl/gc.php?i=' + gameID);
});

app.get('/join.php', function (req, res) {
  var viewData = {
    'gameID': req.query.i,
    'playerID': req.query.s,
    'player1': req.query.n1,
    'player2': req.query.n2,
    'handshake': '',
  }

  if (typeof games[viewData.gameID] != 'undefined')
    viewData.handshake = games[viewData.gameID].join(viewData);

  res.render('join', viewData);
});

io.sockets.on('connection', function (socket) {
  socket.on('auth', function (auth) {
    if (typeof games[auth.gameID] != 'undefined')
      games[auth.gameID].auth(auth, socket);
  });
});

var generateGameID = function () {
  return 'g' + Math.round(Math.random() * 1234567) +
               Math.round(Math.random() * 1234567) +
               Math.round(Math.random() * 1234567) +
               Math.round(Math.random() * 1234567);
}

app.listen(9001);
