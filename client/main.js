//Top canvas: shadow that covers game
var ct = document.getElementById("cantop");
var ctx = ct.getContext("2d");
//Bot canvas: visible portion of room
var cb = document.getElementById("canbot");
var cbx = cb.getContext("2d");
ct.width = cb.width = window.innerWidth;
ct.height = cb.height = window.innerHeight;
ct.focus();

var config = {
  "tileSize": 50,  //side length of tile (tiles are square)
  "radius": 100,   //radius of light
  "pradius": 200, //radius of player light (torch)
  "border": 300,   //border where scrolling begins
  "playerSize": 24, //side length of player (player is square)
  "fireradius": 150 //radius of campfire light
};
var speed = 0.2;

var roomBuffer = document.createElement("canvas"); //canvas of entire room
var rbx = roomBuffer.getContext("2d");
var roomDraw = true; //redraw room (due to changing view)

var lightGradient = ctx.createRadialGradient(0,0,0,0,0,config.radius); //light gradient
lightGradient.addColorStop(0,"white");
lightGradient.addColorStop(1,"transparent");

var socket; //socket connection with server
var lights = []; //lights
var campfires = []; //campfires

//player object
var player = {
  x: 0,        //position coords
  y: 0,
  hue: 0,
  light: 1.0,
  roomWidth: 0,
  roomHeight: 0,
  dead: false
};
var offset = { //offset for view (top-left coords)
  x: 0,
  y: 0
};
var others = [];

var animloopHandle;

var debug = false;
var oldtime = new Date().getTime(), time = new Date().getTime(); //for fps

window.onload = function(){
  document.getElementById("startbtn").onclick = function(){
    // Start game
    if(!socket){
      socket = io();
      setupSocket();
    }
    setupInput();
    if(!animloopHandle) animloop();
    socket.emit("startClient");
  };
}

function setupSocket(){
  socket.on("startServer", function(newPlayer, otherPlayers, roomNum, room, newCampfires){
    Info.setRoom(roomNum);
    player = newPlayer;
    others = otherPlayers;

    calculateOffset();
    updateRoom(room);

    campfires = newCampfires;
    roomDraw = true;

    document.getElementById("menu").style.display = "none";
    ct.focus();

    socket.emit("confirm", window.innerWidth, window.innerHeight);
  });

  socket.on("newNumPlayers", function (numPlayers) {
    Info.setNumPlayer(numPlayers);
  });

  socket.on("update", function(newPlayer, newOthers, newLights){
    if(player.x !== newPlayer.x || player.y !== newPlayer.y) {
      player.x = newPlayer.x;
      player.y = newPlayer.y;
    }
    calculateOffset();
    roomDraw = true;
    player.light = newPlayer.light;
    others = newOthers;
    lights = newLights;
  });

  socket.on("newRoom", function(newPlayer, roomNum, newRoom, newCampfires){
    player = newPlayer;
    Info.setRoom(roomNum);
    updateRoom(newRoom);
    campfires = newCampfires;
  });

  setInterval(function(){
    Info.setFps(Math.round(1000/(time-oldtime)));
    socket.emit("ping", new Date().getTime());
  }, 1000);

  socket.on("pong", function(date){
    Info.setPing(new Date().getTime() - date);
  });

  socket.on("dead", function(){
    player.dead = true;
    setTimeout(function(){
      socket.emit("respawn");
    }, 1000);
  });
}

function calculateOffset() {
  if(offset.x < player.x - window.innerWidth + config.border) {
    offset.x += (player.x - window.innerWidth + config.border - offset.x) * speed;
  }
  else if(offset.x > player.x - config.border) {
    offset.x += (player.x - config.border - offset.x) * speed;
  }

  if(offset.y < player.y - window.innerHeight + config.border) {
    offset.y += (player.y - window.innerHeight + config.border - offset.y) * speed;
  }
  else if(offset.y > player.y - config.border) {
    offset.y += (player.y - config.border - offset.y) * speed;
  }

  // if(offset.x < 0) {
  //   offset.x = 0;
  // }
  // else if(offset.x > player.roomWidth - window.innerWidth - 1) {
  //   offset.x = player.roomWidth - window.innerWidth - 1
  // }
  //
  // if(offset.y < 0) {
  //   offset.y = 0;
  // }
  // else if(offset.y > player.roomHeight - window.innerHeight - 1) {
  //   offset.y = player.roomHeight - window.innerHeight - 1
  // }
}

function updateRoom(room){
  roomBuffer.width = room[0].length*config.tileSize;
  roomBuffer.height = room.length*config.tileSize;
  for(var i=0;i<room.length;i++){
    for(var j=0;j<room[i].length;j++){
      if(room[i][j] === "1") rbx.fillStyle = "#410"; // wall
      else if(room[i][j] === "2") rbx.fillStyle = "#7f7"; // end
      else rbx.fillStyle = "#ffd"; // floor
      rbx.fillRect(j*config.tileSize, i*config.tileSize, config.tileSize, config.tileSize);
    }
  }
  roomDraw = true;
}

function animloop(){
  animloopHandle = window.requestAnimationFrame(animloop);
  gameLoop();
}

function gameLoop(){
  if(roomDraw){
    drawRoom();
    roomDraw = false;
  }

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  drawLights();
  drawOthers();
  if(!player.dead) drawPlayer();

  oldtime = time;
  time = new Date().getTime();
}

function drawRoom(){
  cbx.drawImage(roomBuffer, -offset.x, -offset.y);
}

function drawLights(){
  ctx.globalCompositeOperation = "destination-out";
  if(debug){ //make maze visible
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  }

  ctx.fillStyle = lightGradient;
  for(var i=0;i<lights.length;i++){
    if(lights[i].fade === 1.0){ //full sized light
      ctx.translate(lights[i].x-offset.x, lights[i].y-offset.y);
      ctx.fillRect(-config.radius, -config.radius, 2*config.radius, 2*config.radius);
      ctx.translate(-lights[i].x+offset.x, -lights[i].y+offset.y);
    }
    else{ //waning light
      var grd = ctx.createRadialGradient(lights[i].x-offset.x,lights[i].y-offset.y,0,lights[i].x-offset.x,lights[i].y-offset.y,config.radius);
      grd.addColorStop(0,"black");
      grd.addColorStop(lights[i].fade,"transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(lights[i].x-config.radius-offset.x,lights[i].y-config.radius-offset.y,2*config.radius,2*config.radius);
      ctx.fillStyle = lightGradient;
    }
  }

  for(var j=0;j<campfires.length;j++){
    drawSingleLight(campfires[j].x * config.tileSize - offset.x, campfires[j].y * config.tileSize - offset.y, config.fireradius, 1);
  }

  //draw player lights
  drawSingleLight(player.x - offset.x, player.y - offset.y, config.pradius, player.light);

  //draw enemy lights
  for(var k=0;k<others.length;k++){
    drawSingleLight(others[k].x - offset.x, others[k].y - offset.y, config.pradius, others[k].light);
  }

  ctx.globalCompositeOperation = "source-over";
}

function drawSingleLight(x, y, radius, dim){
  var lightStyle = ctx.createRadialGradient(x, y, 0, x, y, radius);
  lightStyle.addColorStop(0, "black");
  lightStyle.addColorStop(dim, "transparent");
  ctx.fillStyle = lightStyle;
  ctx.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
  ctx.fillStyle = lightGradient;
}

function drawOthers(){
  for(var i=0;i<others.length;i++){
    ctx.fillStyle = "hsl(" + others[i].hue + ", 70%, 50%)";
    ctx.fillRect(others[i].x-config.playerSize/2-offset.x, others[i].y-config.playerSize/2-offset.y, config.playerSize, config.playerSize);
  }
}

function drawPlayer(){
  //ctx.strokeStyle = 'hsl(' + player.hue + ', 80%, 40%)';
  ctx.fillStyle = "hsl(" + player.hue + ", 70%, 50%)";
  ctx.fillRect(player.x-config.playerSize/2-offset.x, player.y-config.playerSize/2-offset.y, config.playerSize, config.playerSize);
}

window.addEventListener('resize', function() {
  ct.width = cb.width = window.innerWidth;
  ct.height = cb.height = window.innerHeight;
  roomDraw = true;
  socket.emit("resize", window.innerWidth, window.innerHeight);
});
