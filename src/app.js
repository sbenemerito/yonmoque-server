import http from 'http';
import express from 'express';
import socketIO from 'socket.io';
import cors from 'cors';


const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors())

// Temporarily serve fake data, with this variable
let rooms = [];

app.get('/', (req, res) => res.json({ msg: 'API is working!' }));
app.get('/rooms', (req, res) => res.json({ rooms }));

const server = http.createServer(app);

const io = socketIO(server);
io.on('connection', socket => {
  console.log('client connected on websocket');

  // insert adding online players count?

  socket.on('create room', ({ roomData, playerName }) => {
    const { name, side } = roomData;
    let players = {
      "0": {
        name: null,
        socket: null,
        skin: null
      },
      "1": {
        name: null,
        socket: null,
        skin: null
      }
    };
    players[side].name = playerName;
    players[side].socket = socket.id;

    // basic validation
    if (name !== undefined && side !== undefined) {
      // auto increment room ID
      const id = rooms.length === 0 ? 0 : rooms[rooms.length-1].id + 1;

      const room = {
        id,
        name,
        players,
        secret: id, // temporarily use room id as secret key to verify following requests
        status: 'waiting',
        isMultiplayer: true,
        turn: 0
      };

      rooms.push(room);
      socket.join(id);

      socket.emit('room joined', room);
      io.emit('room created', rooms);
    }
  });

  socket.on('join room', ({ id, playerName }) => {
    // findIndex returns -1 when no match is found
    const roomIndex = rooms.findIndex(room => room.id === id);

    // only do something when a matching room is found
    if (roomIndex > -1 && playerName) {
      socket.join(id);

      // update room object
      let room = rooms[roomIndex];
      room.status = 'playing';

      const playerSide = room.players[0].name === null ? "0" : "1";
      room.players[playerSide].name = playerName;
      room.players[playerSide].socket = socket.id;

      rooms[roomIndex] = room;

      socket.to(id).emit('player joined', room);
      socket.emit('room joined', room);
      io.emit('room started', rooms);
    }
  });

  socket.on('make move', ({ id, type, src, dest }) => {
    // findIndex returns -1 when no match is found
    const roomIndex = rooms.findIndex(room => room.id === id);

    // only do something when a matching room is found
    if (roomIndex > -1) {
      const gameRoom = rooms[roomIndex];
      const roomSockets = [gameRoom.players[0].socket, gameRoom.players[1].socket];
      // indexOf returns -1 when no match is found
      const playerIndex = roomSockets.indexOf(socket.id);

      // only continue when player belongs to the room and his turn
      if (playerIndex > -1 && gameRoom.turn === playerIndex) {
        // emit move data to room
        socket.to(id).emit('opponent moved', { id, type, src, dest });
        // update current turn in game room
        rooms[roomIndex].turn = (rooms[roomIndex].turn - 1) * -1;
      } else {
        socket.emit('move rejected');
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('client disconnected');

    // insert declaring remaining player as winner, for games(s) socket left
  });
});

server.listen(PORT, () => {
  console.log('server started and listening on port ' + PORT);
});
