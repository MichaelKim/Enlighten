var express = require("express");
var app     = express();
var comp    = require("compression");
var http    = require("http").createServer(app);
var io      = require("socket.io").listen(http);
var rooms   = require("./room.json");

app.use(comp());
app.use(express.static(__dirname + '/../client'));
var port = process.env.PORT  || 5000;
http.listen(port, function(){
  console.log("listening on:" + port);
});

var config = {
  "tileSize": 50,
  "radius": 100,
  "border": 200,
  "playerSize": 24
};
var speed = 0.05;

var sockets = {};
var players = [];
var lights = [];
for(var i=0;i<rooms.length;i++) lights.push([]);

io.on("connection", function(socket){
  var currPlayer = {
    id: socket.id,
    x: rooms[0].startx * config.tileSize,
    y: rooms[0].starty * config.tileSize,
    xoffset: 0,
    yoffset: 0,
    hue: Math.round(Math.random() * 360),
    move:{
      up: false,
      down: false,
      left: false,
      right: false,
    },
    room: 0,
    roomWidth: rooms[0].grid[0].length * config.tileSize,
    roomHeight: rooms[0].grid.length * config.tileSize,
    dead: false
  };

  socket.on("startClient", function(){
    var index = findID(currPlayer.id);
    if(index > -1) players.splice(index, 1);
    socket.emit("startServer", currPlayer, players, rooms[0].grid);
  });

  socket.on("confirm", function(data){
    currPlayer = data;
    currPlayer.x = rooms[currPlayer.room].startx * config.tileSize;
    currPlayer.y = rooms[currPlayer.room].starty * config.tileSize;
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

  socket.on("respawn", function(){
    currPlayer.x = rooms[currPlayer.room].startx * config.tileSize;
    currPlayer.y = rooms[currPlayer.room].starty * config.tileSize;
    currPlayer.move = {
      up: false,
      down: false,
      left: false,
      right: false
    };
    currPlayer.dead = false;
    socket.emit("startServer", currPlayer, players, rooms[currPlayer.room].grid);
  });

  socket.on("addLight", function(data){ //only used in debug
    newLight(data.x, data.y, currPlayer.room);
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
    //sockets[currPlayer.id] = undefined;
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

function findLight(x, y, room){
  for(var i=0;i<lights[room].length;i++){
    if(lights[room][i].x === x && lights[room][i].y === y) return i;
  }
  return -1;
}

function newLight(xx, yy, room){
  lights[room].push({x: xx, y: yy, fade: 1.0});
  setTimeout(function(){
    var int = setInterval(function(){
      var index = findLight(xx, yy, room);
      if(index > -1){
        lights[room][index].fade -= 0.02;
        if(lights[room][index].fade <= 0){
          lights[room].splice(index, 1);
          clearInterval(int);
        }
      }
    }, 20);
  }, 300000);
}

/*function find(array, element, property){
  for(var i=0;i<array.length;i++){
    if(array[i][property] === element) return i;
  }
  return -1;
}*/

function movePlayers(){
  for(var i=0;i<players.length;i++){
    if(players[i].dead) continue;

    var pRoom = players[i].room;
    if(players[i].move.up) players[i].y -= 5;
    if(players[i].move.down) players[i].y += 5;
    if(players[i].move.left) players[i].x -= 5;
    if(players[i].move.right) players[i].x += 5;

    players[i].x = clamp(players[i].x, config.playerSize/2, players[i].roomWidth-config.playerSize/2-1);
    players[i].y = clamp(players[i].y, config.playerSize/2, players[i].roomHeight-config.playerSize/2-1);

    players[i].xoffset = clamp(players[i].xoffset, players[i].x-players[i].sWidth+config.border, players[i].x-config.border);
    players[i].yoffset = clamp(players[i].yoffset, players[i].y-players[i].sHeight+config.border, players[i].y-config.border);

    players[i].xoffset = clamp(players[i].xoffset, 0, players[i].roomWidth-players[i].sWidth-1);
    players[i].yoffset = clamp(players[i].yoffset, 0, players[i].roomHeight-players[i].sHeight-1);

    var top = (players[i].y-config.playerSize/2)/config.tileSize >> 0;
    var bottom = (players[i].y+config.playerSize/2)/config.tileSize >> 0;
    var left = (players[i].x-config.playerSize/2)/config.tileSize >> 0;
    var right = (players[i].x+config.playerSize/2)/config.tileSize >> 0;

    if(rooms[pRoom].grid[top][left] === "1" || rooms[pRoom].grid[top][right] === "1" || rooms[pRoom].grid[bottom][left] === "1" || rooms[pRoom].grid[bottom][right] === "1"){
      players[i].dead = true;
      sockets[players[i].id].emit("dead", players[i]);
      newLight(players[i].x, players[i].y, pRoom);

      var index = findID(players[i].id);
      if(index > -1) players.splice(index, 1);
    }

    if((left === rooms[pRoom].finishx || right === rooms[pRoom].finishx) && (top === rooms[pRoom].finishy || bottom === rooms[pRoom].finishy)){
      players[i].room++;
      if(players[i].room >= rooms.length) players[i].room = rooms.length - 1;
      players[i].x = rooms[players[i].room].startx * config.tileSize;
      players[i].y = rooms[players[i].room].starty * config.tileSize;
      players[i].roomWidth = rooms[players[i].room].grid[0].length * config.tileSize;
      players[i].roomHeight = rooms[players[i].room].grid.length * config.tileSize;
      sockets[players[i].id].emit("newRoom", players[i], rooms[players[i].room].grid);
    }
  }
}

function update(){
  players.forEach(function(p){
    if(p.dead) return;

    var playersSection = [];
    players.forEach(function(pp){
      if(p.id !== pp.id &&
        pp.x+config.playerSize/2 > p.xoffset &&
        pp.x-config.playerSize/2 < p.xoffset+p.sWidth &&
        pp.y+config.playerSize/2 > p.yoffset &&
        pp.y-config.playerSize/2 < p.yoffset+p.sHeight &&
        p.room === pp.room) playersSection.push({x: pp.x, y: pp.y, hue: pp.hue});
    });
    var player = {x: p.x, y: p.y, xoffset: p.xoffset, yoffset: p.yoffset};
    sockets[p.id].emit("newPosition", player, playersSection, players.length);

    var lightsSection = [];
    for(var j=0;j<lights[p.room].length;j++){
      if(lights[p.room][j].x+config.radius > p.xoffset &&
         lights[p.room][j].x-config.radius < p.xoffset+p.sWidth &&
         lights[p.room][j].y+config.radius > p.yoffset &&
         lights[p.room][j].y-config.radius < p.yoffset+p.sHeight) lightsSection.push(lights[p.room][j]);
    }
    sockets[p.id].emit("newLights", lightsSection);
  });
}

setInterval(movePlayers, 16);
setInterval(update, 16);
