import http from 'http';
import express from 'express';
import socketIO from 'socket.io';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';


// Use .env config
dotenv.config();

// Database initialization
const databaseDir = process.env.DATABASE || 'db.sqlite3';
const sqlite = sqlite3.verbose();
const db = new sqlite.Database(databaseDir, error => {
  if (error === null) console.log('Successfully connected to DB');
  else console.error(error, 'Cannot connect to database!');
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT,
      last_name TEXT,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      wins_blue INTEGER DEFAULT 0 NOT NULL,
      wins_white INTEGER DEFAULT 0 NOT NULL,
      losses_blue INTEGER DEFAULT 0 NOT NULL,
      losses_white INTEGER DEFAULT 0 NOT NULL,
      is_admin INTEGER DEFAULT 0 NOT NULL,
      date_created DEFAULT CURRENT_DATE NOT NULL
    )
  `);
});

// Express setup
const PORT = process.env.PORT || 5000;

const app = express();

// body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:false }));

// CORS middleware
app.use(cors())

// Room data is stored in memory
let rooms = [];
let playingRooms = [];

app.get('/', (req, res) => res.json({ msg: 'API is working!' }));
app.get('/rooms', (req, res) => res.json({ rooms }));
app.get('/users', (req, res) => {
  db.all(`SELECT * FROM Users`, (error, users) => {
    // do not return password
    const returnData = users.map(user => ({ ...user, password: undefined }));
    res.json(returnData);
  });
});
app.get('/users/:username', (req, res, next) => {
  db.get(`SELECT * FROM Users WHERE username = '${req.params.username}'`, (error, user) => {
    if (user === undefined) {
      return res.status(404).json({ error: 'User not found', key: 'userNotFound' });
    }

    // do not return password
    user.password = undefined;

    res.json({ ...user });
  });
});

// Authentication endpoints
app.post('/login', (req, res, next) => {
  const { username, password } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required', key: 'usernameMissing' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password is required', key: 'passwordMissing' });
  }

  db.serialize(() => {
    db.get(`SELECT * FROM Users WHERE username = '${username}'`, (error, user) => {
      if (user === undefined) {
        return res.status(400).json({
          error: 'There is no account with the given username',
          key: 'wrongUsername'
        });
      }

      bcrypt.compare(password, user.password, (err, isEqual) => {
        if (!isEqual) {
          return res.status(400).json({ error: 'Invalid password', key: 'wrongPassword' });
        }

        const token = jwt.sign(
          { id: user.id },
          process.env.SECRET,
          { expiresIn: '24h' }
        );

        // do not return password
        user.password = undefined;

        res.json({ user, token });
      });
    });
  });
});

app.post('/signup', (req, res, next) => {
  const { first_name, last_name, username, password, password2 } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required', key: 'usernameMissing' });
  }

  if (username.length > 16) {
    return res.status(400).json({ error: 'Username exceeded max length: 16', key: 'usernameTooLong' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password is required', key: 'passwordMissing' });
  }

  if (password !== password2) {
    return res.status(400).json({ error: 'Passwords do not match', key: 'passwordsNotMatching' });
  }

  db.serialize(() => {
    db.get(`SELECT * FROM Users WHERE username = '${username}'`, (error, user) => {
      if (user !== undefined) {
        return res.status(400).json({ error: 'Username is already taken', key: 'takenUsername'});
      }

      const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
      const insertQuery = `
        INSERT INTO Users(first_name, last_name, username, password)
        VALUES ('${first_name || ''}', '${last_name || ''}', '${username}', '${hashedPassword}')
      `;

      db.run(insertQuery, (error, user) => {
        if (error) {
          return res.status(500).json({ error: 'Unexpected error', details: error });
        }

        db.get(`SELECT * FROM Users WHERE username = '${username}'`, (error, user) => {
          const token = jwt.sign(
            { id: user.id },
            process.env.SECRET,
            { expiresIn: '24h' }
          );

          // do not return password
          user.password = undefined;

          res.json({ user, token });
        });
      });
    });
  });
});

app.post('/toggle-admin/:id', (req, res, next) => {
  // verify that client is an admin
  if (req.hasOwnProperty('headers') && req.headers.hasOwnProperty('authorization')) {
    try {
      /*
       * Try to decode & verify the JWT token
       * The token contains user's id ( it can contain more informations )
       * and this is saved in req.user object
       */
      req.user = jwt.verify(req.headers['authorization'], process.env.SECRET);
      db.serialize(() => {
        db.get(`SELECT * FROM Users WHERE id = ${req.user.id}`, (error, user) => {
          if (user.is_admin) next();
          else
            return res.status(403).json({
              error: 'You are not allowed to perform this operation',
              key: 'notAllowed'
            });
        });
      });
    } catch (err) {
      /*
       * If the authorization header is corrupted, it throws exception
       * So return 401 status code with JSON error message
       */
      return res.status(401).json({
        error: 'Failed to authenticate token',
        key: 'authenticationFailed'
      });
    }
  } else {
    return res.status(403).json({
      error: 'You are not allowed to perform this operation',
      key: 'notAllowed'
    });
  }
}, (req, res, next) => {
  // proceed if client is admin
  const { id } = req.params;

  db.serialize(() => {
    db.get(`SELECT * FROM Users WHERE id = ${id}`, (error, user) => {
      if (user === undefined) {
        return res.status(404).json({ error: 'User not found', key: 'userNotFound'});
      }

      const isAdmin = user.is_admin ? 0 : 1;
      db.run(`UPDATE Users SET is_admin = ${isAdmin} WHERE id = ${id}`, (error) => {
        if (error) {
          return res.status(500).json({ error: 'Unexpected error', details: error });
        }

        res.json({ ...user, password: undefined, is_admin: isAdmin });
      });
    });
  });
});
// Yonmoque sockets handler
const getSecret = () => [...Array(30)].map(() => Math.random().toString(36)[2]).join('');
const server = http.createServer(app);

const io = socketIO(server);
io.on('connection', socket => {
  console.log('client connected on websocket');

  // insert adding online players count?

  socket.on('create room', ({ roomData, playerName }) => {
    const { side } = roomData;

    // basic validation
    if (side !== undefined) {
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
      players[side].name = `Player ${side + 1}`;
      players[side].socket = socket.id;

      // auto increment room ID
      const id = rooms.length === 0 ? 0 : rooms[rooms.length-1].id + 1;

      const room = {
        id,
        name: socket.id.substring(0, 6),
        players,
        secret: getSecret(), // will be used as socket room
        isMultiplayer: true,
        turn: 0,
        playersEnded: [false, false],
        startedTimestamp: null
      };

      rooms.push(room);
      socket.join(room.secret);

      socket.emit('room joined', room);
      io.emit('room created', rooms);
    }
  });

  socket.on('join room', ({ id, playerName }) => {
    // findIndex returns -1 when no match is found
    const roomIndex = rooms.findIndex(room => room.id === id);

    // only do something when a matching room is found
    if (roomIndex > -1) {
      let room = rooms[roomIndex];

      socket.join(room.secret);

      // update room object
      const playerSide = room.players[0].name === null ? 0 : 1;
      room.players[playerSide].name = `Player ${playerSide + 1}`;
      room.players[playerSide].socket = socket.id;
      room.startedTimestamp = new Date();

      // Move specific room to playingRooms
      rooms = rooms.filter(gameRoom => gameRoom.id !== id);
      playingRooms.push(room);

      socket.to(room.secret).emit('player joined', room);
      socket.emit('room joined', room);
      io.emit('room started', rooms);
    }
  });

  socket.on('make move', ({ id, type, src, dest }) => {
    // findIndex returns -1 when no match is found
    const roomIndex = playingRooms.findIndex(room => room.id === id);

    // only do something when a matching room is found
    if (roomIndex > -1) {
      const gameRoom = playingRooms[roomIndex];
      const roomSockets = [gameRoom.players[0].socket, gameRoom.players[1].socket];
      // indexOf returns -1 when no match is found
      const playerIndex = roomSockets.indexOf(socket.id);

      // only continue when player belongs to the room and his turn
      if (playerIndex > -1 && gameRoom.turn === playerIndex) {
        // emit move data to room
        socket.to(gameRoom.secret).emit('opponent moved', { id, type, src, dest });
        // update current turn in game room
        playingRooms[roomIndex].turn = (playingRooms[roomIndex].turn - 1) * -1;
      } else {
        socket.emit('move rejected');
      }
    }
  });

  socket.on('disconnect', () => {
    // declare opponent as winner, for ongoing games disconnected player was in
    const playingRoom = playingRooms.find(room => {
      const roomSockets = [room.players[0].socket, room.players[1].socket];
      return roomSockets.includes(socket.id);
    });

    if (playingRoom !== undefined) {
      const disconnectedMeta = {
        player: [playingRoom.players[0].socket, playingRoom.players[1].socket].indexOf(socket.id)
      };

      socket.to(playingRoom.secret).emit('opponent left', disconnectedMeta);
      playingRooms = playingRooms.filter(room => room.id !== playingRoom.id);
    }

    // remove waiting games disconnected player was in
    const waitingRoom = rooms.find(room => {
      const roomSockets = [room.players[0].socket, room.players[1].socket];
      return roomSockets.includes(socket.id);
    });

    if (waitingRoom !== undefined) {
      rooms = rooms.filter(room => room.id !== waitingRoom.id);
      io.emit('room ended', rooms);
    }
  });
});

// Remove playing rooms that have lasted for more than an hour
const hourInMilliseconds = 3600000;
const cleanRooms = setInterval(() => {
  const currentTimestamp = (new Date()).getTime();

  playingRooms = playingRooms.filter(room => {
    return currentTimestamp - room.startedTimestamp < hourInMilliseconds;
  });
}, hourInMilliseconds);

// Serve
server.listen(PORT, () => {
  console.log('server started and listening on port ' + PORT);
});
