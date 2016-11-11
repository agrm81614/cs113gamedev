//-------------------------------------------------------------------------
// base helper methods
//-------------------------------------------------------------------------

function get(id)        { return document.getElementById(id);  }
function hide(id)       { get(id).style.visibility = 'hidden'; }
function show(id)       { get(id).style.visibility = null;     }
function html(id, html) { get(id).innerHTML = html;            }

function timestamp()           { return new Date().getTime();                             }
function random(min, max)      { return (min + (Math.random() * (max - min)));            }
function randomChoice(choices) { return choices[Math.round(random(0, choices.length-1))]; }

if (!window.requestAnimationFrame) { // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
	window.requestAnimationFrame = window.webkitRequestAnimationFrame ||
																 window.mozRequestAnimationFrame    ||
																 window.oRequestAnimationFrame      ||
																 window.msRequestAnimationFrame     ||
																 function(callback, element) {
																	 window.setTimeout(callback, 1000 / 60);
																 }
}

//-------------------------------------------------------------------------
// game constants
//-------------------------------------------------------------------------

var KEY     = { ESC: 27, SPACE: 32, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, P: 80},
		DIR     = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3, MIN: 0, MAX: 3 },
		// stats   = new Stats(),
		canvas  = get('southCanvas'),
eastCanvas = get('eastCanvas'),
northCanvas = get('northCanvas'),
westCanvas = get('westCanvas'),
		ctx     = canvas.getContext('2d'),
eastCtx     = eastCanvas.getContext('2d'),
northCtx     = northCanvas.getContext('2d'),
westCtx     = westCanvas.getContext('2d'),
		ucanvas = get('upcoming'),
		uctx    = ucanvas.getContext('2d'),
		speed   = { start: 0.6, decrement: 0.005, min: 0.1 }, // how long before piece drops by 1 row (seconds)
		nx      = 10, // width of tetris court (in blocks)
		ny      = 10, // height of tetris court (in blocks)
		nu      = 5,  // width/height of upcoming preview (in blocks)
		currentDirection = 'south';

//-------------------------------------------------------------------------
// game variables (initialized during reset)
//-------------------------------------------------------------------------

var dx, dy,        // pixel size of a single tetris block
		blocks,        // 2 dimensional array (nx*ny) representing tetris court - either empty block or occupied by a 'piece'
		actions,       // queue of user actions (inputs)
		playing,       // true|false - game is in progress
		dt,            // time since starting this game
		current,       // the current piece
		next,          // the next piece
		score,         // the current score
		vscore,        // the currently displayed score (it catches up to score in small chunks - like a spinning slot machine)
		rows,          // number of completed rows in the current game
		step,          // how long before current piece drops by 1 row
		pause,         // true|false - game is paused
		
		//other boards
		eastBlocks, northBlocks, westBlocks,
		currentBlocks = blocks;  
//-------------------------------------------------------------------------
// tetris pieces
//
// blocks: each element represents a rotation of the piece (0, 90, 180, 270)
//         each element is a 16 bit integer where the 16 bits represent
//         a 4x4 set of blocks, e.g. j.blocks[0] = 0x44C0
//
//             0100 = 0x4 << 3 = 0x4000
//             0100 = 0x4 << 2 = 0x0400
//             1100 = 0xC << 1 = 0x00C0
//             0000 = 0x0 << 0 = 0x0000
//                               ------
//                               0x44C0
//
//-------------------------------------------------------------------------

var i = { size: 4, blocks: [0x0F00, 0x2222, 0x00F0, 0x4444], color: '#3498db'   };
var j = { size: 3, blocks: [0x44C0, 0x8E00, 0x6440, 0x0E20], color: '#34495e'   };
var l = { size: 3, blocks: [0x4460, 0x0E80, 0xC440, 0x2E00], color: '#e67e22' };
var o = { size: 2, blocks: [0xCC00, 0xCC00, 0xCC00, 0xCC00], color: '#f1c40f' };
var s = { size: 3, blocks: [0x06C0, 0x8C40, 0x6C00, 0x4620], color: '#27ae60'  };
var t = { size: 3, blocks: [0x0E40, 0x4C40, 0x4E00, 0x4640], color: '#9b59b6' };
var z = { size: 3, blocks: [0x0C60, 0x4C80, 0xC600, 0x2640], color: '#c0392b'    };

//------------------------------------------------
// do the bit manipulation and iterate through each
// occupied block (x,y) for a given piece
//------------------------------------------------
function eachblock(type, x, y, dir, fn) {
	var bit, result, row = 0, col = 0, blocks = type.blocks[dir];
	for(bit = 0x8000 ; bit > 0 ; bit = bit >> 1) {
		if (blocks & bit) {
			fn(x + col, y + row);  //fn(x, y) = setBlock(x, y, current.type)
		}
		if (++col === 4) {
			col = 0;
			++row;
		}
	}
}

//-----------------------------------------------------
// check if a piece can fit into a position in the grid
//-----------------------------------------------------
function occupied(type, x, y, dir) {
	var result = false
	eachblock(type, x, y, dir, function(x, y) {
		if ((x < 0) || (x >= nx) || (y < 0) || (y >= ny) || getBlock(x,y))
			result = true;
	});
	return result;
}

function unoccupied(type, x, y, dir) {
	return !occupied(type, x, y, dir);
}

//-----------------------------------------
// start with 4 instances of each piece and
// pick randomly until the 'bag is empty'
//-----------------------------------------
var pieces = [];
function randomPiece() {
	if (pieces.length == 0)
		pieces = [i,i,i,i,j,j,j,j,l,l,l,l,o,o,o,o,s,s,s,s,t,t,t,t,z,z,z,z];
	var type = pieces.splice(random(0, pieces.length-1), 1)[0];
	return { type: type, dir: DIR.UP, x: Math.round(random(0, nx - type.size)), y: 0 };
}


//-------------------------------------------------------------------------
// GAME LOOP
//-------------------------------------------------------------------------

function run() {

	// showStats(); // initialize FPS counter
	addEvents(); // attach keydown and resize events

	var last = now = timestamp();
	function frame() {
		now = timestamp();
		update(Math.min(1, (now - last) / 1000.0)); // using requestAnimationFrame have to be able to handle large delta's caused when it 'hibernates' in a background or non-visible tab
		draw();
		// stats.update();
		last = now;
		requestAnimationFrame(frame, canvas);
	}

	resize(); // setup all our sizing information
	reset();  // reset the per-game variables
	frame();  // start the first frame

}

// function showStats() {
// 	stats.domElement.id = 'stats';
// 	get('menu').appendChild(stats.domElement);
// }

function addEvents() {
	document.addEventListener('keydown', keydown, false);
	window.addEventListener('resize', resize, false);
}

function resize(event) {
	canvas.width   = canvas.clientWidth;  // set canvas logical size equal to its physical size
	canvas.height  = canvas.clientHeight; // (ditto)
	ucanvas.width  = ucanvas.clientWidth;
	ucanvas.height = ucanvas.clientHeight;
	dx = canvas.width  / nx; // pixel size of a single tetris block
	dy = canvas.height / ny; // (ditto)
	invalidate();
	invalidateNext();
}

function keydown(ev) {
	var handled = false;
	if (!pause) {
		if (playing) {
			switch(ev.keyCode) {
				case KEY.LEFT:   actions.push(DIR.LEFT);  handled = true; break;
				case KEY.RIGHT:  actions.push(DIR.RIGHT); handled = true; break;
				case KEY.UP:     actions.push(DIR.UP);    handled = true; break;
				case KEY.DOWN:   actions.push(DIR.DOWN);  handled = true; break;
				case KEY.ESC:    lose();                  handled = true; break;
				case KEY.P:      pause = !pause;          handled = true; show('pause'); break;
			}
		}
		else if (ev.keyCode == KEY.SPACE) {
			play();
			handled = true;
		}
	}
	else if (ev.keyCode == KEY.P) {
		pause = !pause;
		hide('pause');
	}
	if (handled)
			ev.preventDefault(); // prevent arrow keys from scrolling the page (supported in IE9+ and all other browsers)
}

//-------------------------------------------------------------------------
// GAME LOGIC
//-------------------------------------------------------------------------

function play() { hide('start'); reset();          playing = true;  }
function lose() { show('start'); setVisualScore(); playing = false; }

function setVisualScore(n)      { vscore = n || score; invalidateScore(); }
function setScore(n)            { score = n; setVisualScore(n);  }
function addScore(n)            { score = score + n;   }
function clearScore()           { setScore(0); }
function clearRows()            { setRows(0); }
function setRows(n)             { rows = n; step = Math.max(speed.min, speed.start - (speed.decrement*rows)); invalidateRows(); }
function addRows(n)             { setRows(rows + n); }
function getBlock(x,y)          { return (currentBlocks && currentBlocks[x] ? currentBlocks[x][y] : null); }
function setBlock(x,y,type)     { currentBlocks[x] = currentBlocks[x] || []; currentBlocks[x][y] = type; invalidate(); }
function clearBlocks()          { currentBlocks = []; invalidate(); }
function clearActions()         { actions = []; }
function setCurrentPiece(piece) { current = piece || randomPiece(); invalidate();     }
function setNextPiece(piece)    { next    = piece || randomPiece(); invalidateNext(); }

function reset() {
	dt = 0;
	clearActions();
	clearBlocks();
	clearRows();
	clearScore();
	setCurrentPiece(next);
	setNextPiece();
	pause = false;
}

function update(idt) {
	if (!pause) {
		if (playing) {
			if (vscore < score)
				setVisualScore(vscore + 1);
			handle(actions.shift());
			dt = dt + idt;
			if (dt > step) {
				dt = dt - step;
				drop();
			}
		}
	}
}

function handle(action) {
	switch(action) {
		case DIR.LEFT:  move(DIR.LEFT);  break;
		case DIR.RIGHT: move(DIR.RIGHT); break;
		case DIR.UP:    rotate();        break;
		case DIR.DOWN:  drop();          break;
	}
}

function move(dir) {
	var x = current.x, y = current.y;
	switch(dir) {
		case DIR.RIGHT: x = x + 1; break;
		case DIR.LEFT:  x = x - 1; break;
		case DIR.DOWN:  y = y + 1; break;
	}
	if (unoccupied(current.type, x, y, current.dir)) {
		current.x = x;
		current.y = y;
		invalidate();
		return true;
	}
	else {
		return false;
	}
}

function rotate() {
	var newdir = (current.dir == DIR.MAX ? DIR.MIN : current.dir + 1);
	if (unoccupied(current.type, current.x, current.y, newdir)) {
		current.dir = newdir;
		invalidate();
	}
}

function drop() {
	if (!move(DIR.DOWN)) {
		addScore(10);
		dropPiece();
		removeLines();
		setCurrentPiece(next);
		setNextPiece(randomPiece());
		clearActions();
		if (occupied(current.type, current.x, current.y, current.dir)) {
			lose();
		}
	}
	// set next ctx
}

function dropPiece() {
	eachblock(current.type, current.x, current.y, current.dir, function(x, y) {
		setBlock(x, y, current.type);
	});
	
	//set next direction, based on current directions
	switch (currentDirection){
		case 'south':
			ctx = eastCtx;
			currentBlocks = eastBlocks;
			currentDirection = 'east';
			break;
		case 'east':
			ctx = northCtx;
			currentBlocks = northBlocks;
			currentDirection = 'north';
			break;
		case 'north':
			ctx = westCtx;
			currentBlocks = westBlocks;
			currentDirection = 'west';
			break;
		case 'west':
			ctx = canvas.getContext('2d');
			currentBlocks = blocks;
			currentDirection = 'south';
			break;
	}
	//ctx = eastCtx;
}

function removeLines() {
	var x, y, complete, n = 0;
	for(y = ny ; y > 0 ; --y) {
		complete = true;
		for(x = 0 ; x < nx ; ++x) {
			if (!getBlock(x, y))
				complete = false;
		}
		if (complete) {
			removeLine(y);
			y = y + 1; // recheck same line
			n++;
		}
	}
	if (n > 0) {
		addRows(n);
		addScore(100*Math.pow(2,n-1)); // 1: 100, 2: 200, 3: 400, 4: 800
	}
}

function removeLine(n) {
	var x, y;
	for(y = n ; y >= 0 ; --y) {
		for(x = 0 ; x < nx ; ++x)
			setBlock(x, y, (y == 0) ? null : getBlock(x, y-1));
	}
}

//-------------------------------------------------------------------------
// RENDERING
//-------------------------------------------------------------------------

var invalid = {};

function invalidate()         { invalid.court  = true; }
function invalidateNext()     { invalid.next   = true; }
function invalidateScore()    { invalid.score  = true; }
function invalidateRows()     { invalid.rows   = true; }

function draw() {
	ctx.save();
	ctx.lineWidth = 1;
	ctx.translate(0.5, 0.5); // for crisp 1px black lines
	drawCourt();
	drawNext();
	drawScore();
	drawRows();
	ctx.restore();
}

function drawCourt() {
	if (invalid.court) {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		if (playing)
			drawPiece(ctx, current.type, current.x, current.y, current.dir);
		var x, y, block;
		for(y = 0 ; y < ny ; y++) {
			for (x = 0 ; x < nx ; x++) {
				if (block = getBlock(x,y))
					drawBlock(ctx, x, y, block.color);
			}
		}
		ctx.strokeRect(0, 0, nx*dx - 1, ny*dy - 1); // court boundary
		invalid.court = false;
	}
}

function drawNext() {
	if (invalid.next) {
		var padding = (nu - next.type.size) / 2; // half-arsed attempt at centering next piece display
		uctx.save();
		uctx.translate(0.5, 0.5);
		uctx.clearRect(0, 0, nu*dx, nu*dy);
		drawPiece(uctx, next.type, padding, padding, next.dir);
		uctx.strokeStyle = 'black';
		uctx.strokeRect(0, 0, nu*dx - 1, nu*dy - 1);
		uctx.restore();
		invalid.next = false;
	}
}

function drawScore() {
	if (invalid.score) {
		html('score', ("00000" + Math.floor(vscore)).slice(-5));
		invalid.score = false;
	}
}

function drawRows() {
	if (invalid.rows) {
		html('rows', rows);
		invalid.rows = false;
	}
}

function drawPiece(ctx, type, x, y, dir) {
	eachblock(type, x, y, dir, function(x, y) {
		drawBlock(ctx, x, y, type.color);
	});
}

function drawBlock(ctx, x, y, color) {
	ctx.fillStyle = color;
	ctx.fillRect(x*dx, y*dy, dx, dy);
	ctx.strokeRect(x*dx, y*dy, dx, dy)
}

//-------------------------------------------------------------------------
// FINALLY, lets run the game
//-------------------------------------------------------------------------

run(); hide('pause');
