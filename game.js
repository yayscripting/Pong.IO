// Dependencies
var EventEmitter = process.EventEmitter;

// Exports the constructor
exports = module.exports = Game;


// Gamestates
var gameState = [
	'Waiting for players',
	'Waiting for Socket.IO connections',
	'Counting down',
	'Playing',
	'Waiting for rematch',
	'Finished'
];

// Generates almost unique player ID
var generatePlayerID = function () {
  return 'p' + Math.round(Math.random() * 1234567) +
               Math.round(Math.random() * 1234567) +
               Math.round(Math.random() * 1234567) +
               Math.round(Math.random() * 1234567);
}

// Constructor
function Game () {
	this.players = [];
	this.playersMax = 2;
	this.playersAuthed = 0;
	this.playersRematch = 0;
	this.setGameState(0);

	this.gameFieldWidth = 300;
	this.gameFieldHeight = 150;
	this.playerBatHeight = 30;
}

// Inherit from EventEmitter
Game.prototype.__proto__ = EventEmitter.prototype;

// Changes the state of the game
Game.prototype.setGameState = function (state) {
	this.state = gameState[state];
	this.emit('statechanged', state, gameState[state]);

	if (state == 2) {
		this.startCountdown();
	}
	else if (state == 3) {
		this.startPlaying();
	}
}

// Add player to game
Game.prototype.join = function (data) {
	var player = {
		'handshake': generatePlayerID(),
		'name':      (data.playerID == 1 ? data.player1 : data.player2),
		'side':      data.playerID - 1,
		'authed':    false,
		'rematch':   false,
		'socket':    {},
		'x':         (data.playerID == 1 ? 8 : 292),
		'y':         this.gameFieldHeight / 2 - this.playerBatHeight / 2,
		'score':     0
	}

	this.players.push(player);

	if (this.players.length == this.playersMax) {
		this.setGameState(1);
	}

	return player.handshake;
}

// Auth
Game.prototype.auth = function (auth, socket) {
	var self = this;

	this.players.forEach(function (player) {
		if (player.handshake == auth.handshake && !player.authed) {
			player.socket = socket;
			player.authed = true;
			self.playersAuthed++;

			if (self.playersAuthed == self.playersMax) {
				self.setGameState(2);
				self.listenPlayers();
			}
		}
	});
}

// Broadcast message to all players [optional: except that one]
Game.prototype.broadcast = function (event, data, except) {
	this.players.forEach(function (player) {
		if (player != except && player.authed)
			if (typeof data == 'undefined') {
				player.socket.emit(event);
			}
			else {
				player.socket.emit(event, data);
			}
	});
}

// Listens to all events the players emit
Game.prototype.listenPlayers = function () {
	var self = this;
	this.players.forEach(function (player) {
		player.socket.on('move', function (y) {
			player.y = y;
			self.broadcast('opponentmove', y, player);
		});

		player.socket.on('rematch', function () {
			if (self.state == gameState[4] && !player.rematch) {
				player.rematch = true;
				player.score = 0;
				self.playersRematch++;

				if (self.playersRematch == self.playersMax) {
					self.playersRematch = 0;
					self.setGameState(2);
				}
			}
		});

		player.socket.on('disconnect', function () {
			self.setGameState(5);
		});
	});
}

// Starts countdown
Game.prototype.startCountdown = function () {
	this.getPlayerBySide(0).rematch = false;
	this.getPlayerBySide(1).rematch = false;

	if (typeof this.updateIntervalID != 'undefined')
		clearInterval(this.updateIntervalID);

	this.broadcastScore();

	if (this.getPlayerBySide(0).score > 9 || this.getPlayerBySide(1).score > 9) {
		this.setGameState(4);
		return;
	}

	this.broadcast('startcountdown');

	// Start the coundown
	var self = this;
	setTimeout(function () {
		self.setGameState(3);
	}, 3000);

	// Reset ball position
	this.ball = {
		x:      this.gameFieldWidth / 2 - 2.5,
		y:      this.gameFieldHeight / 2 - 2.5,
		width:  5,
		height: 5,
		hspeed: (Math.round(Math.random()) == 1 ? 2 : -2),
		vspeed: (Math.round(Math.random()) == 1 ? 2 : -2),
		accel:  0.1
	}
}

// Starts the game
Game.prototype.startPlaying = function () {
	var self = this;

	this.broadcast('ballmove', this.getBall());
	self.update();

	this.updateIntervalID = setInterval(function () {
		self.update();
	}, 1000 / 60);
}

// Update positions
Game.prototype.update = function () {
	this.moveBall();
}

// Gets player on side playerSide
Game.prototype.getPlayerBySide = function (playerSide) {
	var playerToReturn;

	this.players.forEach(function (player) {
		if (player.side == playerSide)
			playerToReturn = player;
			return;
	});

	return playerToReturn;
}

// Moves the ball
Game.prototype.moveBall = function () {
	// Collision with left and right walls
	if (this.ball.x + this.ball.hspeed < 0) {
		this.getPlayerBySide(1).score++;
		this.setGameState(2);
	}
	else if (this.ball.x + this.ball.width + this.ball.hspeed > this.gameFieldWidth) {
		this.getPlayerBySide(0).score++;
		this.setGameState(2);
	}

	// Collision with top and bottom walls
	if (this.ball.y + this.ball.vspeed < 0 || 
		this.ball.y + this.ball.height + this.ball.vspeed > this.gameFieldHeight) {
		this.ball.vspeed = -this.ball.vspeed;
		this.broadcast('ballmove', this.getBall());
	}

	// Collision with left player
	var player = this.getPlayerBySide(0);
	if (this.ball.x >= player.x && this.ball.x + this.ball.hspeed < player.x) {
		if (this.ball.y + this.ball.height > player.y && this.ball.y < player.y + this.playerBatHeight) {
			this.ball.hspeed = -this.ball.hspeed;
			this.accelerateBall();
			this.broadcast('ballmove', this.getBall());
		}
	}

	// Collision with right player
	player = this.getPlayerBySide(1);
	if (this.ball.x + this.ball.width <= player.x && this.ball.x + this.ball.width + this.ball.hspeed > player.x) {
		if (this.ball.y + this.ball.height > player.y && this.ball.y < player.y + this.playerBatHeight) {
			this.ball.hspeed = -this.ball.hspeed;
			this.accelerateBall();
			this.broadcast('ballmove', this.getBall());
		}
	}

	// Move the ball
	this.ball.x += this.ball.hspeed;
	this.ball.y += this.ball.vspeed;
}

// Accelerates the ball
Game.prototype.accelerateBall = function () {
	this.ball.vspeed = (this.ball.vspeed > 0 ? this.ball.vspeed + this.ball.accel : this.ball.vspeed - this.ball.accel);
	this.ball.hspeed = (this.ball.hspeed > 0 ? this.ball.hspeed + this.ball.accel : this.ball.hspeed - this.ball.accel);
}

// Rounds ball x and y
Game.prototype.getBall = function () {
	return {
		x: this.ball.x,
		y: this.ball.y,
		h: this.ball.hspeed,
		v: this.ball.vspeed
	}
}

// Broadcasts the score
Game.prototype.broadcastScore = function () {
	this.broadcast('score', {
		'1': this.getPlayerBySide(0).score,
		'2': this.getPlayerBySide(1).score
	});
}