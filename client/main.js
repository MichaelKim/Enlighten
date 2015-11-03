var ct = document.getElementById("cantop");
var ctx = ct.getContext("2d");
var cb = document.getElementById("canbot");
var cbx = cb.getContext("2d");
var screenWidth = ct.width = cb.width = window.innerWidth;
var screenHeight = ct.height = cb.height = window.innerHeight;
ct.focus();

var config = {
  "tileSize": 50,
  "radius": 100,
  "roomWidth": 0,
  "roomHeight": 0,
  "border": 200,
  "playerSize": 24
};

var socket;
var lights = [];

var roomBuffer = document.createElement("canvas");
var rbx = roomBuffer.getContext("2d");
var roomDraw = true;

var player = {
  x: 0,
  y: 0,
  xoffset: 0,
  yoffset: 0
};
var others = [];
var move = {
  up: false,
  down: false,
  left: false,
  right: false
};
var dead = false;
var animloopHandle;
var oldtime = new Date().getTime(), time = new Date().getTime();

var lightGradient = ctx.createRadialGradient(0,0,0,0,0,config.radius);
lightGradient.addColorStop(0,"white");
lightGradient.addColorStop(1,"transparent");

var debug = false;

window.onload = function(){
  startGame();

  if(debug){
    ct.addEventListener("mousedown", function(event){
      socket.emit("addLight", {x: event.pageX + player.xoffset, y: event.pageY + player.yoffset});
    });
  }

  ct.addEventListener("keydown", function(event){
    var key = event.which || event.keyCode;
    if(key === 87 || key == 38) move.up = true;
    if(key === 83 || key === 40) move.down = true;
    if(key === 65 || key === 37) move.left = true;
    if(key === 68 || key === 39) move.right = true;
    socket.emit("playerMove", moveEncode());
  });

  ct.addEventListener("keyup", function(event){
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

function moveEncode(){
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
    player.sWidth = screenWidth;
    player.sHeight = screenHeight;
    others = otherPlayers;

    roomBuffer.width = config.roomWidth = room[0].length*config.tileSize;
    roomBuffer.height = config.roomHeight = room.length*config.tileSize;
    for(var i=0;i<room.length;i++){
      for(var j=0;j<room[i].length;j++){
        if(room[i][j] === "1") rbx.fillStyle = "#ff0000";
        else rbx.fillStyle = "#00ff00";
        rbx.fillRect(j*config.tileSize, i*config.tileSize, config.tileSize, config.tileSize);
      }
    }
    roomDraw = true;
    socket.emit("confirm", player);
  });

  socket.on("newLights", function(newLights){
    lights = newLights;
  });

  socket.on("newPosition", function(newPlayer, newOthers){
    player.x = newPlayer.x;
    player.y = newPlayer.y;
    if(player.xoffset !== newPlayer.xoffset || player.yoffset !== newPlayer.yoffset) roomDraw = true;
    player.xoffset = newPlayer.xoffset;
    player.yoffset = newPlayer.yoffset;
    others = newOthers;
  });

  socket.on("finish", function(){
    //do something
  });

  socket.on("pong", function(date){
    document.getElementById("ping").innerHTML = "Ping: "+ (new Date().getTime() - date);
  });

  socket.on("dead", function(){
    dead = true;
    window.setTimeout(function(){
      dead = false;
      /*if(animloopHandle){
          window.cancelAnimationFrame(animloopHandle);
          animloopHandle = undefined;
      }*/
      startGame();
    }, 1000);
  });
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
  ctx.fillRect(0, 0, screenWidth, screenHeight);
  drawLights();
  drawOthers();
  if(!dead) drawPlayer();

  oldtime = time;
  time = new Date().getTime();
}

function drawRoom(){
  cbx.drawImage(roomBuffer, -player.xoffset, -player.yoffset);
  //cbx.drawImage(roomBuffer, player.xoffset, player.yoffset, screenWidth, screenHeight, 0, 0, screenWidth, screenHeight);
}

function drawLights(){
  ctx.globalCompositeOperation = "destination-out";
  if(debug){
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, screenWidth, screenHeight);
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
  screenWidth = ct.width = cb.width = window.innerWidth;
  screenHeight = ct.height = cb.height = window.innerHeight;
  roomDraw = true;
  socket.emit("resize", screenWidth, screenHeight);
});

setInterval(function(){
  document.getElementById("fps").innerHTML = "FPS: "+Math.round(1000/(time-oldtime));
  socket.emit("ping", new Date().getTime());
}, 1000);
