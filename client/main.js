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
  "border": 200,   //border where scrolling begins
  "playerSize": 24 //side length of player (player is square)
};

var socket; //socket connection with server
var lights = []; //lights

var roomBuffer = document.createElement("canvas"); //canvas of entire room
var rbx = roomBuffer.getContext("2d");
var roomDraw = true; //redraw room (due to changing view)

//var lightBuffer = document.createElement("canvas");
//var lbx = lightBuffer.getContext("2d");

//player object
var player = {
  x: 0,        //position coords
  y: 0,
  xoffset: 0,  //offset for view (top-left coords)
  yoffset: 0
};
var others = [];
var move = {
  up: false,
  down: false,
  left: false,
  right: false
};

var animloopHandle;
var oldtime = new Date().getTime(), time = new Date().getTime(); //for fps

var lightGradient = ctx.createRadialGradient(0,0,0,0,0,config.radius); //light gradient
lightGradient.addColorStop(0,"white");
lightGradient.addColorStop(1,"transparent");

var debug = false;

window.onload = function(){
  var startBtn = document.getElementById("startbtn");
  startBtn.onclick = function(){
    startGame();
  };

  if(debug){
    ct.addEventListener("mousedown", function(event){
      socket.emit("addLight", {x: event.pageX + player.xoffset, y: event.pageY + player.yoffset});
    });
  }

  ct.addEventListener("keydown", function(event){ //press key down
    var key = event.which || event.keyCode;
    if(key === 87 || key == 38) move.up = true;
    if(key === 83 || key === 40) move.down = true;
    if(key === 65 || key === 37) move.left = true;
    if(key === 68 || key === 39) move.right = true;
    socket.emit("playerMove", moveEncode());
  });

  ct.addEventListener("keyup", function(event){ //depress key
    var key = event.which || event.keyCode;
    if(key === 87 || key == 38) move.up = false;
    if(key === 83 || key === 40) move.down = false;
    if(key === 65 || key === 37) move.left = false;
    if(key === 68 || key === 39) move.right = false;
    socket.emit("playerMove", moveEncode());
  });
};

window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function(callback){
            window.setTimeout(callback, 1000 / 60);
          };
})();

window.cancelAnimFrame = (function(handle) {
    return  window.cancelAnimationFrame       ||
            window.webkitCancelAnimationFrame ||
            window.mozCancelAnimationFrame;
})();

function startGame(){
  if(!socket){
    socket = io();
    setupSocket();
  }
  if(!animloopHandle) animloop();
  socket.emit("startClient");
}

function moveEncode(){ //convert move into 4-bit binary
  var result = 0;
  if(move.up) result += 1;
  if(move.down) result += 2;
  if(move.left) result += 4;
  if(move.right) result += 8;
  return result;
}

function setupSocket(){
  socket.on("startServer", function(newPlayer, otherPlayers, room){
    player = newPlayer;
    document.getElementById("room").innerHTML = "Room: " + player.room;
    player.sWidth = window.innerWidth;
    player.sHeight = window.innerHeight;
    others = otherPlayers;

    updateRoom(room);

    document.getElementById("startbtn").style.display = "none";
    ct.focus();

    socket.emit("confirm", player);
  });

  socket.on("newLights", function(newLights){
    lights = newLights;
  });

  socket.on("newPosition", function(newPlayer, newOthers, numPlayers){
    player.x = newPlayer.x;
    player.y = newPlayer.y;
    if(player.xoffset !== newPlayer.xoffset || player.yoffset !== newPlayer.yoffset) roomDraw = true;
    player.xoffset = newPlayer.xoffset;
    player.yoffset = newPlayer.yoffset;
    others = newOthers;

    document.getElementById("numPlayer").innerHTML = "Players: " + numPlayers;
  });

  socket.on("newRoom", function(newPlayer, newRoom){
    player = newPlayer;
    document.getElementById("room").innerHTML = "Room: " + player.room;
    updateRoom(newRoom);
  });

  setInterval(function(){
    document.getElementById("fps").innerHTML = "FPS: "+Math.round(1000/(time-oldtime));
    socket.emit("ping", new Date().getTime());
  }, 1000);

  socket.on("pong", function(date){
    document.getElementById("ping").innerHTML = "Ping: "+ (new Date().getTime() - date);
  });

  socket.on("dead", function(newPlayer){
    player = newPlayer;
    window.setTimeout(function(){
      /*if(animloopHandle){
          window.cancelAnimationFrame(animloopHandle);
          animloopHandle = undefined;
      }*/
      //startGame();
      socket.emit("respawn");
    }, 1000);
  });
}

function updateRoom(room){
  roomBuffer.width = room[0].length*config.tileSize;
  roomBuffer.height = room.length*config.tileSize;
  for(var i=0;i<room.length;i++){
    for(var j=0;j<room[i].length;j++){
      if(room[i][j] === "1") rbx.fillStyle = "#ff0000";
      else rbx.fillStyle = "#00ff00";
      rbx.fillRect(j*config.tileSize, i*config.tileSize, config.tileSize, config.tileSize);
    }
  }
  roomDraw = true;
}

function animloop(){
  animloopHandle = requestAnimFrame(animloop);
  gameLoop();
}

function gameLoop(){
  if(roomDraw){
    drawRoom();
    roomDraw = false;
  }

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, player.sWidth, player.sHeight);
  drawLights();
  drawOthers();
  if(!player.dead) drawPlayer();

  oldtime = time;
  time = new Date().getTime();
}

function drawRoom(){
  cbx.drawImage(roomBuffer, -player.xoffset, -player.yoffset);
  //cbx.drawImage(roomBuffer, player.xoffset, player.yoffset, player.sWidth, player.sHeight, 0, 0, player.sWidth, player.sHeight);
}

function drawLights(){
  ctx.globalCompositeOperation = "destination-out";
  if(debug){
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, player.sWidth, player.sHeight);
  }

  ctx.fillStyle = lightGradient;
  for(var i=0;i<lights.length;i++){
    if(lights[i].fade === 1.0){
      ctx.translate(lights[i].x-player.xoffset, lights[i].y-player.yoffset);
      ctx.fillRect(-config.radius, -config.radius, 2*config.radius, 2*config.radius);
      ctx.translate(-lights[i].x+player.xoffset, -lights[i].y+player.yoffset);
    }
    else{
      var grd = ctx.createRadialGradient(lights[i].x-player.xoffset,lights[i].y-player.yoffset,0,lights[i].x-player.xoffset,lights[i].y-player.yoffset,config.radius);
      grd.addColorStop(0,"black");
      grd.addColorStop(lights[i].fade,"transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(lights[i].x-config.radius-player.xoffset,lights[i].y-config.radius-player.yoffset,2*config.radius,2*config.radius);
      ctx.fillStyle = lightGradient;
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawOthers(){
  for(var i=0;i<others.length;i++){
    ctx.fillStyle = "hsl(" + others[i].hue + ", 70%, 50%)";
    ctx.fillRect(others[i].x-config.playerSize/2-player.xoffset, others[i].y-config.playerSize/2-player.yoffset, config.playerSize, config.playerSize);
  }
}

function drawPlayer(){
  //ctx.strokeStyle = 'hsl(' + player.hue + ', 80%, 40%)';
  ctx.fillStyle = "hsl(" + player.hue + ", 70%, 50%)";
  ctx.fillRect(player.x-config.playerSize/2-player.xoffset, player.y-config.playerSize/2-player.yoffset, config.playerSize, config.playerSize);
}

window.addEventListener('resize', function() {
  player.sWidth = ct.width = cb.width = window.innerWidth;
  player.sHeight = ct.height = cb.height = window.innerHeight;
  roomDraw = true;
  socket.emit("resize", player.sWidth, player.sHeight);
});
