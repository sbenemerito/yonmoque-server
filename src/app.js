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
        isMultiplayer: true
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

  socket.on('disconnect', () => {
    console.log('client disconnected');

    // insert declaring remaining player as winner, for games(s) socket left
  });
});

server.listen(PORT, () => {
  console.log('server started and listening on port ' + PORT);
});
