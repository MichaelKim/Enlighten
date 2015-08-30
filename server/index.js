var express = require("express");
var app     = express();
var http    = require("http").Server(app);
var io      = require("socket.io")(http);
var room    = require("./room.json");

var config = {
  "tileSize": 50,
  "radius": 100,
  "roomWidth": 2500,
  "roomHeight": 1000,
  "border": 200,
  "playerSize": 24
};

var speed = 0.05;

var sockets = {};
var players = [];
var lights = [];

var oldTime = new Date().getTime(), time = new Date().getTime();

app.use(express.static(__dirname + '/../client'));

io.on("connection", function(socket){
  var currPlayer = {
    id: socket.id,
    x: 100,
    y: 100,
    xoffset: 0,
    yoffset: 0,
    hue: Math.round(Math.random() * 360),
    move:{
      up: false,
      down: false,
      left: false,
      right: false,
    }
  };

  socket.on("startClient", function(){
    var index = findID(currPlayer.id);
    if(index > -1) players.splice(index, 1);
    socket.emit("startServer", currPlayer, players);
  });

  socket.on("confirm", function(data){
    currPlayer = data;
    currPlayer.x = 100;
    currPlayer.y = 100;
    currPlayer.move = {
      up: false,
      down: false,
      left: false,
      right: false
    };
    players.push(currPlayer);
    sockets[currPlayer.id] = socket;
    console.log("New Player: " + currPlayer.id);
  });

  socket.on("addLight", function(data){
    newLight(data.x, data.y);
  });

  socket.on("playerMove", function(data){
    currPlayer.move.up = data & 1;
    currPlayer.move.down = data & 2;
    currPlayer.move.left = data & 4;
    currPlayer.move.right = data & 8;
  });

  socket.on("resize", function(sWidth, sHeight){
    currPlayer.sWidth = sWidth;
    currPlayer.sHeight = sHeight;
  });

  socket.on("ping", function(date){
    socket.emit("pong", date);
  });

  socket.on('disconnect', function(){
    var index = findID(currPlayer.id);
    if(index > -1) players.splice(index, 1);
    console.log("Player dc: " + currPlayer.id);
  });
});

function clamp(num, min, max){
  return Math.min(Math.max(num, min), max);
}

function findID(id){
  for(var i=0;i<players.length;i++){
    if(players[i].id === id) return i;
  }
  return -1;
}

function findLight(x){
  for(var i=0;i<lights.length;i++){
    if(lights[i].x === x) return i;
  }
  return -1;
};

function newLight(xx, yy){
  lights.push({x: xx, y: yy, fade: 1.0});
  setTimeout(function(){
    var int = setInterval(function(){
      var index = findLight(xx);
      if(index > -1){
        lights[index].fade -= .02;
        if(lights[index].fade <= 0){
          lights.splice(index, 1);
          clearInterval(int);
        }
      }
    }, 20);
  }, 60000);
}

function encode(values){
  var size = values.length / 16 + 1 >> 0,
      offset = 0,
      packed = "";

  for(var i=0;i<size;i++,offset+=16){
    packed += String.fromCharCode(parseInt(values.substring(offset, offset + 16), 2));
  }
  return packed;
}
/*function find(array, element, property){
  for(var i=0;i<array.length;i++){
    if(array[i][property] === element) return i;
  }
  return -1;
}*/
function movePlayers(){
  for(var i=0;i<players.length;i++){
    if(players[i] === "undefined") return;
    if(players[i].move.up) players[i].y -= 5;
    if(players[i].move.down) players[i].y += 5;
    if(players[i].move.left) players[i].x -= 5;
    if(players[i].move.right) players[i].x += 5;

    if(players[i].x < config.playerSize/2) players[i].x = config.playerSize/2;
    else if(players[i].x > config.roomWidth-config.playerSize/2-1) players[i].x = config.roomWidth-config.playerSize/2-1;
    if(players[i].y < config.playerSize/2) players[i].y = config.playerSize/2;
    else if(players[i].y > config.roomHeight-config.playerSize/2-1) players[i].y = config.roomHeight-config.playerSize/2-1;

    if(players[i].x-players[i].xoffset < config.border) players[i].xoffset = players[i].x-config.border;
    else if(players[i].x-players[i].xoffset > players[i].sWidth-config.border) players[i].xoffset = players[i].x-players[i].sWidth+config.border;
    if(players[i].y-players[i].yoffset < config.border) players[i].yoffset = players[i].y-config.border;
    else if(players[i].y-players[i].yoffset > players[i].sHeight-config.border) players[i].yoffset = players[i].y-players[i].sHeight+config.border;

    if(players[i].xoffset < 0) players[i].xoffset = 0;
    else if(players[i].xoffset > config.roomWidth-players[i].sWidth-1) players[i].xoffset = config.roomWidth-players[i].sWidth-1;
    if(players[i].yoffset < 0) players[i].yoffset = 0;
    else if(players[i].yoffset > config.roomHeight-players[i].sHeight-1) players[i].yoffset = config.roomHeight-players[i].sHeight-1;


    var top = (players[i].y-config.playerSize/2)/config.tileSize >> 0;
    var bottom = (players[i].y+config.playerSize/2)/config.tileSize >> 0;
    var left = (players[i].x-config.playerSize/2)/config.tileSize >> 0;
    var right = (players[i].x+config.playerSize/2)/config.tileSize >> 0;

    if(room[top][left] === "1" || room[top][right] === "1" || room[bottom][left] === "1" || room[bottom][right] === "1"){
      sockets[players[i].id].emit("dead");
      newLight(players[i].x, players[i].y);

      var index = findID(players[i].id);
      if(index > -1) players.splice(index, 1);
    }
  }
}

function update(){
  oldTime = time;
  time = new Date().getTime();
  for(var i=0;i<players.length;i++){
    if(players[i] === "undefined") return;
    var playersSection = [];
    for(var j=0;j<players.length;j++){
      if(j !== i &&
         players[j].x+config.playerSize/2 > players[i].xoffset &&
         players[j].x-config.playerSize/2 < players[i].xoffset+players[i].sWidth &&
         players[j].y+config.playerSize/2 > players[i].yoffset &&
         players[j].y-config.playerSize/2 < players[i].yoffset+players[i].sHeight) playersSection.push({x: players[j].x, y: players[j].y, hue: players[j].hue});
    }
    var player = {x: players[i].x, y: players[i].y, xoffset: players[i].xoffset, yoffset: players[i].yoffset};
    sockets[players[i].id].emit("newPosition", player, playersSection);

    if(players[i] === "undefined") return;
    var topTile = players[i].yoffset/config.tileSize >> 0;
    var bottomTile = (players[i].yoffset+players[i].sHeight)/config.tileSize >> 0;
    var leftTile = players[i].xoffset/config.tileSize >> 0;
    var rightTile = (players[i].xoffset+players[i].sWidth)/config.tileSize >> 0;
    var roomSection = "";
    for(var j=0;j<bottomTile-topTile+1;j++){
      roomSection += room[j+topTile].slice(leftTile, rightTile+1);
    }
    sockets[players[i].id].emit("newRoom", encode(roomSection));

    var lightsSection = [];
    for(var j=0;j<lights.length;j++){
      if(lights[j].x+config.radius > players[i].xoffset &&
         lights[j].x-config.radius < players[i].xoffset+players[i].sWidth &&
         lights[j].y+config.radius > players[i].yoffset &&
         lights[j].y-config.radius < players[i].yoffset+players[i].sHeight) lightsSection.push(lights[j]);
    }
    sockets[players[i].id].emit("newLights", lightsSection);
  }
}

setInterval(movePlayers, 16);
setInterval(update, 16);
setInterval(function(){
    console.log("FPS: " + Math.round(1000/(time-oldTime)));
}, 500);

var ipaddress = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
var port = process.env.OPENSHIFT_NODEJS_PORT  || 8080;
http.listen(port, ipaddress, function(){
  console.log("listening on " + ipaddress + ":" + port);
});
