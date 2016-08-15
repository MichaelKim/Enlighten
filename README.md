# Enlighten

Check it out at https://enlighten-game.herokuapp.com/

Enlighten is a collaborative multiplayer webgame. You are a little square, navigating a dark maze with only a small torch.

## Gameplay

Use WASD or Arrow keys to move around the maze. If you collide with the walls of the maze, you leave a small light showing where you died, and return to the start of the maze. Find the way out by learning from your and others' mistakes.

To help shed some light, you carry a small torch, which illuminates a small area around you. However, the torch is weak, and dwindles slowly over time.

There are also campfires: permanent light sources scattered across the maze. Walk over them to refuel your decaying torch.

You can see other players' lights, and they can see yours too. The more players online, the easier it is to complete a level.

## Requirements

Enlighten needs the following dependencies:

- Node.js with NPM
- Socket.io
- Express

Clone the repository, and run `npm install` to install all the dependencies.

To start the server, run `npm start`.

The game will be available at `localhost:5000`, or wherever it's installed.
