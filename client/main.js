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
  "roomWidth": 2500,
  "roomHeight": 1000,
  "border": 200,
  "playerSize": 24
};

var socket;
var lights = [];
var room = [];
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

window.onload = function(){
  startGame();

  ct.addEventListener("mousedown", function(event){
    socket.emit("addLight", {x: event.pageX + player.xoffset, y: event.pageY + player.yoffset});
  });

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

function chunkString(str, len){
  var size = str.length / len >> 0,
      ret  = new Array(size),
      offset = 0;

  for(var i=0;i<size;++i,offset+=len){
    ret[i] = str.substring(offset, offset + len);
  }
  return ret;
}

function zeroPad(num, numZero){
	for(var i=num.length;i<numZero;i++) num = "0"+num;
	return num;
}

function decodeRoom(packed, roomWidth){
    var values = "";
    var asdf = "";
    for(var i=0;i<packed.length;i++){
        asdf += packed.charCodeAt(i)+" ";
        if(i === packed.length-1){
          var temp = i*16;
          values += zeroPad(packed.charCodeAt(i).toString(2), ((temp/roomWidth+1)>>0)*roomWidth-temp);
        }
        else{
          values += zeroPad(packed.charCodeAt(i).toString(2), 16);
        }
    }
    return values;
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
  socket.on("startServer", function(newPlayer, otherPlayers){
    player = newPlayer;
    player.sWidth = screenWidth;
    player.sHeight = screenHeight;
    others = otherPlayers;

    socket.emit("confirm", player);
  });

  socket.on("newLights", function(newLights){
    lights = newLights;
  });

  socket.on("newPosition", function(newPlayer, newOthers){
    player.x = newPlayer.x;
    player.y = newPlayer.y;
    player.xoffset = newPlayer.xoffset;
    player.yoffset = newPlayer.yoffset;
    others = newOthers;
  });

  socket.on("newRoom", function(newRoom){
    var leftTile = player.xoffset/config.tileSize >> 0;
    var rightTile = (player.xoffset+player.sWidth)/config.tileSize >> 0;
    var roomWidth = rightTile-leftTile+1;
    room = chunkString(decodeRoom(newRoom, roomWidth), roomWidth);
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
  drawRoom();

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, screenWidth, screenHeight);
  drawLights();
  drawOthers();
  if(!dead) drawPlayer();

  oldtime = time;
  time = new Date().getTime();
}

function drawRoom(){
  var buffer = document.createElement("canvas");
  buffer.width = screenWidth;
  buffer.height = screenHeight;
  var bfx = buffer.getContext("2d");


  var xshift = player.xoffset % config.tileSize;
  var yshift = player.yoffset % config.tileSize;
  bfx.fillStyle = "#00ffff";
  for(var i=0;i<room.length;i++){
    for(var j=0;j<room[i].length;j++){
      //if(room[i][j] === "1") cbx.fillStyle = "#ff0000";
      //else cbx.fillStyle = "#00ff00";
      if(room[i][j] === "1") bfx.fillRect(-xshift+j*config.tileSize, -yshift+i*config.tileSize, config.tileSize, config.tileSize);
    }
  }

  cbx.drawImage(buffer, 0, 0);
}

function drawLights(){
  ctx.globalCompositeOperation = "destination-out";

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
  socket.emit("resize", screenWidth, screenHeight);
});

setInterval(function(){
  document.getElementById("fps").innerHTML = "FPS: "+Math.round(1000/(time-oldtime));
  socket.emit("ping", new Date().getTime());
}, 1000);
