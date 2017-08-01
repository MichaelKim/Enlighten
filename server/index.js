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
  "tileSize": 50,  //side length of tile (tiles are square)
  "radius": 100,   //radius of light
  "pradius": 200, //radius of player light
  "border": 300,   //border where scrolling begins
  "playerSize": 24 //side length of player (player is square)
};
var lightLength = 5*60*1000; //5 minutes
var plightDecay = 0.0005;

var sockets = {};
var players = [];
var lights = [];
var campfires = [];
for(var i=0;i<rooms.length;i++){
  lights.push([]);
  campfires.push(rooms[i].campfire);
  rooms[i].width = rooms[i].grid[0].length * config.tileSize;
  rooms[i].height = rooms[i].grid.length * config.tileSize;
}

io.on("connection", function(socket){
  var currPlayer = {
    id: socket.id,
    x: rooms[0].startx * config.tileSize,
    y: rooms[0].starty * config.tileSize,
    hue: Math.round(Math.random() * 360),
    light: 1.0,
    move: {
      up: false,
      down: false,
      left: false,
      right: false,
    },
    room: 0,
    screenWidth: 0,
    screenWidth: 0,
    dead: false
  };

  socket.on("startClient", function(){
    var index = findID(currPlayer.id);
    if(index > -1) players.splice(index, 1);

    socket.emit("startServer", {
      x: currPlayer.x,
      y: currPlayer.y,
      light: currPlayer.light,
      hue: currPlayer.hue,
      roomWidth: rooms[0].width,
      roomHeight: rooms[0].height,
      dead: currPlayer.dead
    }, getOthers(currPlayer.id), currPlayer.room, rooms[0].grid, campfires[0]);
  });

  socket.on("confirm", function(screenWidth, screenHeight){
    currPlayer.screenWidth = screenWidth;
    currPlayer.screenHeight = screenHeight;
    players.push(currPlayer);
    sockets[currPlayer.id] = socket;
    console.log("New Player: " + currPlayer.id);

    io.emit("newNumPlayers", players.length);
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

    socket.emit("startServer", {
      x: currPlayer.x,
      y: currPlayer.y,
      light: currPlayer.light,
      hue: currPlayer.hue,
      roomWidth: rooms[currPlayer.room].width,
      roomHeight: rooms[currPlayer.room].height,
      dead: currPlayer.dead
    }, getOthers(currPlayer.id), currPlayer.room, rooms[currPlayer.room].grid, campfires[currPlayer.room]);
  });

  socket.on("playerMove", function(data){
    currPlayer.move.up = data & 1;
    currPlayer.move.down = data & 2;
    currPlayer.move.left = data & 4;
    currPlayer.move.right = data & 8;
  });

  socket.on("resize", function(screenWidth, screenHeight){
    currPlayer.screenWidth = screenWidth;
    currPlayer.screenHeight = screenHeight;
  });

  socket.on("ping", function(date){
    socket.emit("pong", date);
  });

  socket.on('disconnect', function(){
    var index = findID(currPlayer.id);
    if(index > -1) players.splice(index, 1);
    console.log("Player dc: " + currPlayer.id);
    socket.broadcast.emit("newNumPlayers", players.length);
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

function findLight(id, room){
  for(var i=0;i<lights[room].length;i++){
    if(id === lights[room].id) return i;
  }
  return -1;
}

function newLight(xx, yy, room){
  var newid = (xx + yy) * (xx + yy + 1) / 2 + yy;
  lights[room].push({x: xx, y: yy, id: newid, fade: 1.0});
  setTimeout(function(){
    var int = setInterval(function(){
      var index = findLight(newid, room);
      if(index > -1){
        lights[room][index].fade -= 0.02;
        if(lights[room][index].fade <= 0){
          lights[room].splice(index, 1);
          clearInterval(int);
        }
      }
    }, 20);
  }, lightLength);
}

function getOthers(currId) {
  var others = [];
  players.forEach(function(p) {
    if(p.id !== currId) {
      others.push({
        x: p.x,
        y: p.y,
        light: p.light,
        hue: p.hue
      });
    }
  });
  return others;
}

function loadNextLevel(player){
  player.room++;
  if(player.room >= rooms.length) player.room = rooms.length - 1;
  player.x = rooms[player.room].startx * config.tileSize;
  player.y = rooms[player.room].starty * config.tileSize;
  player.light = 1.0;

  sockets[player.id].emit("newRoom", {
    x: player.x,
    y: player.y,
    light: player.light,
    hue: player.hue,
    roomWidth: rooms[player.room].width,
    roomHeight: rooms[player.room].height,
    dead: player.dead
  }, player.room, rooms[player.room].grid, campfires[player.room]);
}

function movePlayers(){
  for(var i=0;i<players.length;i++){
    if(players[i].dead) continue;

    //decay player light
    if(players[i].light > 0) players[i].light -= plightDecay;
    if(players[i].light < 0) players[i].light = 0;

    //move player
    var pRoom = players[i].room;
    if(players[i].move.up) players[i].y -= 5;
    if(players[i].move.down) players[i].y += 5;
    if(players[i].move.left) players[i].x -= 5;
    if(players[i].move.right) players[i].x += 5;

    players[i].x = clamp(players[i].x, config.playerSize/2, rooms[pRoom].width-config.playerSize/2-1);
    players[i].y = clamp(players[i].y, config.playerSize/2, rooms[pRoom].height-config.playerSize/2-1);

    var top = (players[i].y-config.playerSize/2)/config.tileSize >> 0;
    var bottom = (players[i].y+config.playerSize/2)/config.tileSize >> 0;
    var left = (players[i].x-config.playerSize/2)/config.tileSize >> 0;
    var right = (players[i].x+config.playerSize/2)/config.tileSize >> 0;

    if(rooms[pRoom].grid[top][left] === "1" || rooms[pRoom].grid[top][right] === "1" || rooms[pRoom].grid[bottom][left] === "1" || rooms[pRoom].grid[bottom][right] === "1"){
      players[i].dead = true;
      sockets[players[i].id].emit("dead");
      newLight(players[i].x, players[i].y, pRoom);

      var index = findID(players[i].id);
      if(index > -1) players.splice(index, 1);

      return;
    }

    if(rooms[pRoom].grid[top][left] === "2" || rooms[pRoom].grid[top][right] === "2" || rooms[pRoom].grid[bottom][left] === "2" || rooms[pRoom].grid[bottom][right] === "2"){
      loadNextLevel(players[i]);

      return;
    }

    for(var j=0;j<campfires[pRoom].length;j++){ //refresh player light
      if((left === campfires[pRoom][j].x || right === campfires[pRoom][j].x) &&  (top === campfires[pRoom][j].y || bottom === campfires[pRoom][j].y)){
        players[i].light = 1.0;
      }
    }
  }
}

function update(){
  players.forEach(function(p){
    if(p.dead) return;

    var others = [];
    players.forEach(function(pp){
      if(p.id !== pp.id &&
        p.room === pp.room &&
        pp.x+config.pradius > p.x-p.screenWidth &&
        pp.x-config.pradius < p.x+p.screenWidth &&
        pp.y+config.pradius > p.y-p.screenHeight &&
        pp.y-config.pradius < p.y+p.screenHeight) others.push({x: pp.x, y: pp.y, hue: pp.hue, light: pp.light});
    });
    var player = {x: p.x, y: p.y, light: p.light};
    sockets[p.id].emit("newPosition", player, others);

    var lightsSection = [];
    for(var j=0;j<lights[p.room].length;j++){
      if(lights[p.room][j].x+config.radius > p.x-p.screenWidth &&
         lights[p.room][j].x-config.radius < p.x+p.screenWidth &&
         lights[p.room][j].y+config.radius > p.y-p.screenHeight &&
         lights[p.room][j].y-config.radius < p.y+p.screenHeight) lightsSection.push(lights[p.room][j]);
    }
    sockets[p.id].emit("newLights", lightsSection);
  });
}

setInterval(movePlayers, 16);
setInterval(update, 16);
