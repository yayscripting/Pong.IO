var canvas, context, ball, player = [], score = [0, 0], intro, introPlaying = true, triggerOverlay = false, overlayOpen = false, waitingForRematch = false, endingScreen = false, stillAnimatingOpening = false, waitingForConnection = false, connected = false, foreground = 'white', overlay;
window.addEvent('domready', function(){

	// init
	handShake();

	canvas		= $('canvas');
	context		= canvas.getContext('2d');
	
	ball		= new Ball();
	
	overlay		= new Overlay();
	overlay.done	= function(){ stillAnimatingOpening = false; auth(); overlay.done = function(){} }
	
	intro		= new ImageIntro(['images/intro/screen_3.png', 'images/intro/screen_4.png', 'images/intro/screen_1.png']);
	intro.done	= function(){
	
		introPlaying = false;
		stillAnimatingOpening = true;
		
		overlayOpen = true;
		
	};
	
	player[0]	= new Player(1, ((pongConfig.playerID == 1) ? 'mouse' : 'server'));
	player[1]	= new Player(2, ((pongConfig.playerID == 2) ? 'mouse' : 'server'));
	
	update.periodical(1000 / 60);
	
	// events
	canvas.addEvent('mousemove', function(e){
	
		var canvasPosition  = canvas.getPosition();	
	
		for(var i = 0; i < 2; i++){	
		
			if(player[i].type == 'mouse'){
		
				var mouse = {
				
					'x': e.client.x - canvasPosition.x,
					'y': e.client.y - canvasPosition.y
				
				};
		
				player[i].mouseMove(mouse);	
				
			}
			
		}
	
	});
	
	canvas.addEvent('mousedown', function(e){
	
		if(endingScreen && !waitingForRematch){
		
			rematch();
			
			waitingForRematch = true;
		
		}	
	
	});
	
	// listen
	socket.on('opponentmove', function (data){

		for(var i = 0; i < 2; i++){	
		
			if(player[i].type == 'server'){
			
				player[i].y = data;
			
			}
			
		}		
		
	});
	
	socket.on('ballmove', function (data){
	
		ball.x = data.x;
		ball.y = data.y;
		
		ball.hspeed = data.h;
		ball.vspeed = data.v;	
		
	});
	
	socket.on('startcountdown', function(){
	
		if(waitingForRematch){
		
			startRematch();
			
		}
		
		stillAnimatingOpening	= true;
	
	});
	
	socket.on('score', function(score){
	
		if(score[1] > 9){
		
			if(pongConfig.playerID == 1){
			
				triggerEnd('win');
			
			}else{
			
				triggerEnd('lose');
			
			}
		
		}else
		if(score[2] > 9){
		
			if(pongConfig.playerID == 2){
			
				triggerEnd('win');
			
			}else{
			
				triggerEnd('lose');
			
			}
		
		}else{
	
			$('player_1').set('class', 'score'+score[1]);
			$('player_2').set('class', 'score'+score[2]);
			
		}
	
	});
		

});

var triggerEnd = function(mode){

	overlay.direction	= -1;
	triggerOverlay		= true;
	stillAnimatingOpening	= false;
	
	overlay.done = function(){
	
		triggerOverlay	= false;
		endingScreen	= true;
		
		intro			= new ImageIntro(['images/outro/screen_'+mode+'.png', 'images/outro/waiting.png']);
		intro.stepsPerSlide	= 32; 
		intro.showingImg = function(){
		
			intro.setPause(true);
			
		};
		
		overlay.done = function(){};
	
	}

}

var startRematch = function(){

	waitingForRematch	= false;
	endingScreen		= false;
	ball			= new Ball();
	score 			= [0, 0];
	overlayOpen		= true;
	overlay			= new Overlay();
	overlay.done		= function(){ stillAnimatingOpening = false; overlay.done = function(){} }

}

var rematch = function(){


	socket.emit('rematch');
	intro.setPause(false);

}


var handShake = function(){

	socket = io.connect('games.jessedegger.nl:9001');
	
	socket.on('connect', function (){
	
		connected = true;
		
		if(waitingForConnection){
		
			auth();
		
		}
		
	});

}

var auth = function(){

	if(connected){
	
		waitingForConnection = false;
		
		socket.emit('auth', {
			gameID: pongConfig.gameID,
			handshake: pongConfig.handshake
		});
		
	}else{
	
		waitingForConnection = true;
	
	}

}

var update = function(){

	context.clearRect(0, 0, canvas.width, canvas.height);
	
	drawField();
	
	if(!(introPlaying || endingScreen)){
	
		ball.update();
		player[0].update();
		player[1].update();
	
	}

}

var drawField = function(){

	if(introPlaying || endingScreen){
		
		if(endingScreen){
		
			var steps = 7;
			for(var i = 0; i < steps; i++){
			
				context.fillRect(((canvas.width / 2) - 1), 5 + (canvas.height / steps) * i, 5, (canvas.height / steps) - 10);
			
			}
		
		
		}
		
		intro.update();
		intro.draw();
	
	}else{
	

		context.fillStyle = foreground;
		
		if(stillAnimatingOpening || triggerOverlay){
		
			overlay.draw();
			
			if(overlayOpen){
			
				overlay.update();
				
			}
		
		
		}
			
		var steps = 7;
		for(var i = 0; i < steps; i++){
		
			context.fillRect(((canvas.width / 2) - 1), 5 + (canvas.height / steps) * i, 5, (canvas.height / steps) - 10);
		
		}
	
	}	

}

/*
 * @class: Ball
 *
 */
{
	var Ball = function(){
		
		this.width 	= 5;
		this.height	= 5;
		
		this.x        = canvas.width  / 2 - 1;
		this.y        = canvas.height / 2 - 1;
		
		this.hspeed	= 0;
		this.vspeed	= 0;
		
		this.framerate	= 1000 / 60;
		this.lastTime	= null;
	
	}

	Ball.prototype.update = function(){
	
		
		var t = new Date();
	
		if(this.lastTime != null){
			
			this.framerate = t - this.lastTime;
		
		}
		
		this.lastTime = t;
	
		this.x += (this.framerate / (1000 / 60 )) * this.hspeed;
		this.y += (this.framerate / (1000 / 60 )) * this.vspeed;
			
		this.draw();
	
	}
	
	Ball.prototype.draw = function(){
	
		context.fillStyle = foreground;
		context.fillRect(Math.round(this.x), Math.round(this.y), this.width, this.height);
	
	}
	
}

/*
 * @class: Overlay
 *
 */
{
	var Overlay = function(){
		
		this.step	= 0;
		this.direction	= 1;
		
		this.done	= function(){};
		
	}

	Overlay.prototype.update = function(){
	
		this.step += this.direction;
		
		if(this.step >= ((canvas.height / 2) - 1) || this.step < 0){
		
			this.done();
		
		}
	
	}
	
	Overlay.prototype.draw = function(){
	
		context.fillStyle = foreground;
		
		context.fillRect(0, 0, canvas.width, (canvas.height / 2) - this.step);
		context.fillRect(0, (canvas.height / 2) + this.step, canvas.width, (canvas.height / 2) - this.step);
	
	}
	
}

/*
 * @class: Player
 *
 */
{
	var Player = function(id, type){
	
		this.type	= type;
		this.id		= id;
		
		this.width 	= 3;
		this.height	= 30;
		
		this.x		= ((this.id == 1) ? 5 : (canvas.width - this.width -  5));
		this.y		= canvas.height / 2 - this.height / 2;
		
		this.speedX	= 0;
		this.speedY	= 0;
		
		this.mouse	= {};

		this.lastSendY	= -1;
	
	}
	
	

	Player.prototype.update = function(){
	
		if(this.type == 'mouse'){
		
			this.setPositionViaMouse();
			
			if(this.y != this.lastSendY){
			
				socket.emit('move', this.y);
				this.lastSendY = this.y;
				
			}
			
		}
		
		
		this.draw();
	
	}
	
	Player.prototype.draw = function(){
	
		context.fillStyle = foreground;
		context.fillRect(this.x, this.y, this.width, this.height);
		
	
	}
	
	Player.prototype.mouseMove = function(mouse){
	
		this.mouse.x = mouse.x - this.width  / 2;
		this.mouse.y = mouse.y - this.height / 2;
	
	}
	
	Player.prototype.setPositionViaMouse = function(){
		
		
		var	direction = this.pointDirection(0, this.y, 0, this.mouse.y),
			mousey	  = ((this.mouse.y > canvas.height) ? canvas.height : ((this.mouse.y < 0) ? 0 : this.mouse.y)),
			distance  = this.distance(this.y, this.mouse.y),
			maxSpeed  = (distance / 15);
		
		this.speedY = maxSpeed * Math.sin(direction);
			
		if (Math.abs(this.speedY) > Math.abs(Math.round(this.y) - this.mouse.y)) {
		
			var newTop = this.mouse.y;
			
		} else {
		
			var newTop = this.y + this.speedY;
			
		}
		
		this.y = ((newTop  < (canvas.height - this.height)) ? ((newTop < 0) ? 0 : newTop)  : (canvas.height - this.height));
		
	}
	
	Player.prototype.pointDirection = function(x1, y1, x2, y2){
				
		return Math.atan2(y2 - y1, x2 - x1);
			
	}
	
	Player.prototype.distance = function(y1, y2){
		
		var x1 = 0;
		var x2 = 0;
		
		var	a = Math.pow((x2 - x1), 2),
			b = Math.pow((y2 - y1), 2),
			c = a + b;
		
		return	Math.sqrt(c);
	
	}
	
	
}

/*
 * @class: ImageIntro
 *
 */
{
	var ImageIntro = function(images){
		
		this.images		= images;
		this.imageObjects	= [];
		
		this.slide		= -1;
		this.step		= 0;
		
		this.stepsPerSlide	= 100;
		this.alphaPerSlide	= 30;
		
		this.pause		= false;
		
		this.done		= function(){};
		this.showingImg		= function(){};
	
		this.start();
		
	}
	
	ImageIntro.prototype.start = function(){
	
		this.step	= 0;
		this.slide	= -1;
		this.pause	= false;
	
		for(var i = 0; i < this.images.length; i ++){
		
			this.imageObjects[i] = new Image();
			this.imageObjects[i].src = this.images[i];
			
			if(i == 0){
			
				this.imageObjects[0].onload = this.nextSlide();
			
			}
		
		}
	
	}
	
	ImageIntro.prototype.setPause = function(value){
	
		this.pause = value;
	
	}
	
	ImageIntro.prototype.nextSlide = function(){
	
		this.step	 = 0;
		this.slide	+= 1;
		
		if(this.slide == this.images.length){
		
			this.done();
		
		}else{
		
			this.slideImage = this.imageObjects[this.slide];
			
		}
	
	}

	ImageIntro.prototype.update = function(){
	
	
		if(this.pause === true) return;
		
	
		this.step++;
	
		if(this.step == this.stepsPerSlide){
		
			this.nextSlide();
		
		
		}
	
		if(this.step <= this.alphaPerSlide){
		
			this.alpha = (1 / this.alphaPerSlide) * (this.alphaPerSlide - this.step);
			this.alpha = Math.round(this.alpha*10)/10;
			
		}else
		if(this.step == (this.alphaPerSlide + 1)){
		
			this.showingImg();
		
		}
			
	
	}
	
	ImageIntro.prototype.draw = function(){
		
		
		if(typeof this.slideImage == 'object'){
			
			context.drawImage(this.slideImage, 0, 0);
			
			context.fillStyle = 'rgba(255, 255, 255, '+this.alpha+')';	
			context.fillRect(0, 0, canvas.width, canvas.height);
			
		}
	
	}
	
}