"use strict";

var _http = _interopRequireDefault(require("http"));

var _express = _interopRequireDefault(require("express"));

var _socket = _interopRequireDefault(require("socket.io"));

var _cors = _interopRequireDefault(require("cors"));

var _sqlite = _interopRequireDefault(require("sqlite3"));

var _dotenv = _interopRequireDefault(require("dotenv"));

var _bodyParser = _interopRequireDefault(require("body-parser"));

var _bcryptjs = _interopRequireDefault(require("bcryptjs"));

var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// Use .env config
_dotenv["default"].config(); // Database initialization


var databaseDir = process.env.DATABASE || 'db.sqlite3';

var sqlite = _sqlite["default"].verbose();

var db = new sqlite.Database(databaseDir, function (error) {
  if (error === null) console.log('Successfully connected to DB');else console.error(error, 'Cannot connect to database!');
});
db.serialize(function () {
  db.run("\n    CREATE TABLE IF NOT EXISTS Users (\n      id INTEGER PRIMARY KEY AUTOINCREMENT,\n      first_name TEXT,\n      last_name TEXT,\n      username TEXT NOT NULL,\n      password TEXT NOT NULL,\n      wins_blue INTEGER DEFAULT 0 NOT NULL,\n      wins_white INTEGER DEFAULT 0 NOT NULL,\n      losses_blue INTEGER DEFAULT 0 NOT NULL,\n      losses_white INTEGER DEFAULT 0 NOT NULL,\n      is_admin INTEGER DEFAULT 0 NOT NULL,\n      date_created DEFAULT CURRENT_DATE NOT NULL\n    )\n  ");
}); // Express setup

var PORT = process.env.PORT || 5000;
var app = (0, _express["default"])(); // body-parser middleware

app.use(_bodyParser["default"].json());
app.use(_bodyParser["default"].urlencoded({
  extended: false
})); // CORS middleware

app.use((0, _cors["default"])()); // Room data is stored in memory

var rooms = [];
var socketMap = {};
var playingRooms = [];
app.get('/', function (req, res) {
  return res.json({
    msg: 'API is working!'
  });
});
app.get('/rooms', function (req, res) {
  return res.json({
    rooms: rooms
  });
});
app.get('/users', function (req, res) {
  db.all("SELECT * FROM Users", function (error, users) {
    // do not return password
    var returnData = users.map(function (user) {
      return _objectSpread({}, user, {
        password: undefined
      });
    });
    res.json(returnData);
  });
});
app.get('/users/:username', function (req, res, next) {
  db.get("SELECT * FROM Users WHERE username = '".concat(req.params.username, "'"), function (error, user) {
    if (user === undefined) {
      return res.status(404).json({
        error: 'User not found',
        key: 'userNotFound'
      });
    } // do not return password


    user.password = undefined;
    res.json(_objectSpread({}, user));
  });
}); // Authentication endpoints

app.post('/login', function (req, res, next) {
  var _req$body = req.body,
      username = _req$body.username,
      password = _req$body.password;

  if (!username) {
    return res.status(400).json({
      error: 'Username is required',
      key: 'usernameMissing'
    });
  }

  if (!password) {
    return res.status(400).json({
      error: 'Password is required',
      key: 'passwordMissing'
    });
  }

  db.serialize(function () {
    db.get("SELECT * FROM Users WHERE username = '".concat(username, "'"), function (error, user) {
      if (user === undefined) {
        return res.status(400).json({
          error: 'There is no account with the given username',
          key: 'wrongUsername'
        });
      }

      _bcryptjs["default"].compare(password, user.password, function (err, isEqual) {
        if (!isEqual) {
          return res.status(400).json({
            error: 'Invalid password',
            key: 'wrongPassword'
          });
        }

        if (socketMap["uid".concat(user.id)] !== undefined) {
          return res.status(400).json({
            error: 'The account is already online.',
            key: 'duplicateLogin'
          });
        }

        var token = _jsonwebtoken["default"].sign({
          id: user.id
        }, process.env.SECRET, {
          expiresIn: '24h'
        }); // do not return password


        user.password = undefined;
        res.json({
          user: user,
          token: token
        });
      });
    });
  });
});
app.post('/signup', function (req, res, next) {
  var _req$body2 = req.body,
      first_name = _req$body2.first_name,
      last_name = _req$body2.last_name,
      username = _req$body2.username,
      password = _req$body2.password,
      password2 = _req$body2.password2;

  if (!username) {
    return res.status(400).json({
      error: 'Username is required',
      key: 'usernameMissing'
    });
  }

  if (username.length > 16) {
    return res.status(400).json({
      error: 'Username exceeded max length: 16',
      key: 'usernameTooLong'
    });
  }

  if (!password) {
    return res.status(400).json({
      error: 'Password is required',
      key: 'passwordMissing'
    });
  }

  if (password !== password2) {
    return res.status(400).json({
      error: 'Passwords do not match',
      key: 'passwordsNotMatching'
    });
  }

  db.serialize(function () {
    db.get("SELECT * FROM Users WHERE username = '".concat(username, "'"), function (error, user) {
      if (user !== undefined) {
        return res.status(400).json({
          error: 'Username is already taken',
          key: 'takenUsername'
        });
      }

      var hashedPassword = _bcryptjs["default"].hashSync(password, _bcryptjs["default"].genSaltSync(10));

      var insertQuery = "\n        INSERT INTO Users(first_name, last_name, username, password)\n        VALUES ('".concat(first_name || '', "', '").concat(last_name || '', "', '").concat(username, "', '").concat(hashedPassword, "')\n      ");
      db.run(insertQuery, function (error, user) {
        if (error) {
          return res.status(500).json({
            error: 'Unexpected error',
            details: error
          });
        }

        db.get("SELECT * FROM Users WHERE username = '".concat(username, "'"), function (error, user) {
          var token = _jsonwebtoken["default"].sign({
            id: user.id
          }, process.env.SECRET, {
            expiresIn: '24h'
          }); // do not return password


          user.password = undefined;
          res.json({
            user: user,
            token: token
          });
        });
      });
    });
  });
});
app.post('/toggle-admin/:id', function (req, res, next) {
  // verify that client is an admin
  if (req.hasOwnProperty('headers') && req.headers.hasOwnProperty('authorization')) {
    try {
      /*
       * Try to decode & verify the JWT token
       * The token contains user's id ( it can contain more informations )
       * and this is saved in req.user object
       */
      req.user = _jsonwebtoken["default"].verify(req.headers['authorization'], process.env.SECRET);
      db.serialize(function () {
        db.get("SELECT * FROM Users WHERE id = ".concat(req.user.id), function (error, user) {
          if (user.is_admin) next();else return res.status(403).json({
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
}, function (req, res, next) {
  // proceed if client is admin
  var id = req.params.id;
  db.serialize(function () {
    db.get("SELECT * FROM Users WHERE id = ".concat(id), function (error, user) {
      if (user === undefined) {
        return res.status(404).json({
          error: 'User not found',
          key: 'userNotFound'
        });
      }

      var isAdmin = user.is_admin ? 0 : 1;
      db.run("UPDATE Users SET is_admin = ".concat(isAdmin, " WHERE id = ").concat(id), function (error) {
        if (error) {
          return res.status(500).json({
            error: 'Unexpected error',
            details: error
          });
        }

        res.json(_objectSpread({}, user, {
          password: undefined,
          is_admin: isAdmin
        }));
      });
    });
  });
}); // Yonmoque sockets handler

var getSecret = function getSecret() {
  return _toConsumableArray(Array(30)).map(function () {
    return Math.random().toString(36)[2];
  }).join('');
};

var getUserFromToken = function getUserFromToken(token) {
  return new Promise(function (resolve, reject) {
    if (!token) resolve(null);

    try {
      /*
       * Try to decode & verify the JWT token
       * The token contains user's id ( it can contain more informations )
       * and this is saved in req.user object
       */
      var userFromToken = _jsonwebtoken["default"].verify(token, process.env.SECRET);

      db.serialize(function () {
        db.get("SELECT * FROM Users WHERE id = ".concat(userFromToken.id), function (error, user) {
          if (user !== undefined) resolve(_objectSpread({}, user, {
            password: undefined
          }));
          resolve(null);
        });
      });
    } catch (err) {
      resolve(null);
    }
  });
};

var server = _http["default"].createServer(app);

var io = (0, _socket["default"])(server);
io.on('connection', function (socket) {
  console.log('client connected on websocket'); // insert adding online players count?

  socket.on('bind token',
  /*#__PURE__*/
  function () {
    var _ref2 = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee(_ref) {
      var token, userFromToken;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              token = _ref.token;
              _context.next = 3;
              return getUserFromToken(token);

            case 3:
              userFromToken = _context.sent;

              if (userFromToken !== null && !socketMap["uid".concat(userFromToken.id)]) {
                socketMap["uid".concat(userFromToken.id)] = socket.id;
              }

            case 5:
            case "end":
              return _context.stop();
          }
        }
      }, _callee);
    }));

    return function (_x) {
      return _ref2.apply(this, arguments);
    };
  }());
  socket.on('create room',
  /*#__PURE__*/
  function () {
    var _ref4 = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee2(_ref3) {
      var roomData, token, userFromToken, side, players, id, room;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              roomData = _ref3.roomData, token = _ref3.token;
              _context2.next = 3;
              return getUserFromToken(token);

            case 3:
              userFromToken = _context2.sent;
              side = roomData.side; // basic validation

              if (side !== undefined && userFromToken !== null && socketMap["uid".concat(userFromToken.id)] !== undefined) {
                players = {
                  "0": {
                    user: null,
                    socket: null,
                    skin: null
                  },
                  "1": {
                    user: null,
                    socket: null,
                    skin: null
                  }
                };
                players[side].user = userFromToken;
                players[side].socket = socket.id; // auto increment room ID

                id = rooms.length === 0 ? 0 : rooms[rooms.length - 1].id + 1;
                room = {
                  id: id,
                  name: socket.id.substring(0, 6),
                  players: players,
                  secret: getSecret(),
                  // will be used as socket room
                  isMultiplayer: true,
                  turn: 0,
                  declaredWinner: [null, null],
                  startedTimestamp: null
                };
                rooms.push(room);
                socket.join(room.secret);
                socket.emit('room joined', room);
                io.emit('room created', rooms);
              }

            case 6:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2);
    }));

    return function (_x2) {
      return _ref4.apply(this, arguments);
    };
  }());
  socket.on('join room',
  /*#__PURE__*/
  function () {
    var _ref6 = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee3(_ref5) {
      var id, token, roomIndex, userFromToken, room, playerSide;
      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              id = _ref5.id, token = _ref5.token;
              // findIndex returns -1 when no match is found
              roomIndex = rooms.findIndex(function (room) {
                return room.id === id;
              });
              _context3.next = 4;
              return getUserFromToken(token);

            case 4:
              userFromToken = _context3.sent;

              // only do something when a matching room is found
              if (roomIndex > -1 && userFromToken !== null && socketMap["uid".concat(userFromToken.id)] !== undefined) {
                room = rooms[roomIndex];
                socket.join(room.secret); // update room object

                playerSide = room.players[0].user === null ? 0 : 1;
                room.players[playerSide].user = userFromToken;
                room.players[playerSide].socket = socket.id;
                room.startedTimestamp = new Date(); // Move specific room to playingRooms

                rooms = rooms.filter(function (gameRoom) {
                  return gameRoom.id !== id;
                });
                playingRooms.push(room);
                socket.to(room.secret).emit('player joined', room);
                socket.emit('room joined', room);
                io.emit('room started', rooms);
              }

            case 6:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3);
    }));

    return function (_x3) {
      return _ref6.apply(this, arguments);
    };
  }());
  socket.on('make move',
  /*#__PURE__*/
  function () {
    var _ref8 = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee4(_ref7) {
      var id, type, src, dest, token, roomIndex, userFromToken, gameRoom, roomSockets, playerIndex;
      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              id = _ref7.id, type = _ref7.type, src = _ref7.src, dest = _ref7.dest, token = _ref7.token;
              // findIndex returns -1 when no match is found
              roomIndex = playingRooms.findIndex(function (room) {
                return room.id === id;
              });
              _context4.next = 4;
              return getUserFromToken(token);

            case 4:
              userFromToken = _context4.sent;

              // only do something when a matching room is found
              if (roomIndex > -1 && userFromToken !== null && socketMap["uid".concat(userFromToken.id)] !== undefined) {
                gameRoom = playingRooms[roomIndex];
                roomSockets = [gameRoom.players[0].socket, gameRoom.players[1].socket]; // indexOf returns -1 when no match is found

                playerIndex = roomSockets.indexOf(socket.id); // only continue when player belongs to the room and his turn

                if (playerIndex > -1 && gameRoom.turn === playerIndex) {
                  // emit move data to room
                  socket.to(gameRoom.secret).emit('opponent moved', {
                    id: id,
                    type: type,
                    src: src,
                    dest: dest
                  }); // update current turn in game room

                  playingRooms[roomIndex].turn = (playingRooms[roomIndex].turn - 1) * -1;
                } else {
                  socket.emit('move rejected');
                }
              }

            case 6:
            case "end":
              return _context4.stop();
          }
        }
      }, _callee4);
    }));

    return function (_x4) {
      return _ref8.apply(this, arguments);
    };
  }());
  socket.on('endgame',
  /*#__PURE__*/
  function () {
    var _ref10 = _asyncToGenerator(
    /*#__PURE__*/
    regeneratorRuntime.mark(function _callee5(_ref9) {
      var id, winner, token, roomIndex, userFromToken, gameRoom, roomSockets, playerIndex, _playingRooms$roomInd, firstWinner, secondWinner, loser, winnerObj, loserObj, colorMap;

      return regeneratorRuntime.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              id = _ref9.id, winner = _ref9.winner, token = _ref9.token;
              // findIndex returns -1 when no match is found
              roomIndex = playingRooms.findIndex(function (room) {
                return room.id === id;
              });
              _context5.next = 4;
              return getUserFromToken(token);

            case 4:
              userFromToken = _context5.sent;

              // only do something when a matching room is found
              if (roomIndex > -1 && userFromToken !== null && socketMap["uid".concat(userFromToken.id)] !== undefined) {
                gameRoom = playingRooms[roomIndex];
                roomSockets = [gameRoom.players[0].socket, gameRoom.players[1].socket]; // indexOf returns -1 when no match is found

                playerIndex = roomSockets.indexOf(socket.id); // only continue when player belongs to the room and his turn

                if (playerIndex > -1) {
                  playingRooms[roomIndex].declaredWinner[playerIndex] = winner;
                  _playingRooms$roomInd = _slicedToArray(playingRooms[roomIndex].declaredWinner, 2), firstWinner = _playingRooms$roomInd[0], secondWinner = _playingRooms$roomInd[1];

                  if (!playingRooms[roomIndex].declaredWinner.includes(null) && firstWinner === secondWinner) {
                    loser = winner * -1 + 1;
                    winnerObj = gameRoom.players[winner].user;
                    loserObj = gameRoom.players[loser].user;
                    colorMap = ['blue', 'white'];
                    db.serialize(function () {
                      db.get("SELECT * FROM Users WHERE id = '".concat(winnerObj.id, "'"), function (error, user) {
                        if (user !== undefined) {
                          var addWinQuery = "\n                  UPDATE Users SET wins_".concat(colorMap[winner], " = ").concat(winner === 0 ? user.wins_blue + 1 : user.wins_white + 1, "\n                  WHERE id = ").concat(user.id, "\n                ");
                          db.run(addWinQuery, function (error, _) {
                            return console.log("win added for ".concat(winnerObj.username));
                          });
                        }
                      });
                      db.get("SELECT * FROM Users WHERE id = '".concat(loserObj.id, "'"), function (error, user) {
                        if (user !== undefined) {
                          var addLossQuery = "\n                  UPDATE Users SET losses_".concat(colorMap[loser], " = ").concat(loser === 0 ? user.losses_blue + 1 : user.losses_white + 1, "\n                  WHERE id = ").concat(user.id, "\n                ");
                          db.run(addLossQuery, function (error, _) {
                            return console.log("win added for ".concat(loserObj.username));
                          });
                        }
                      });
                    });
                  }
                }
              }

            case 6:
            case "end":
              return _context5.stop();
          }
        }
      }, _callee5);
    }));

    return function (_x5) {
      return _ref10.apply(this, arguments);
    };
  }());
  socket.on('disconnect', function () {
    Object.keys(socketMap).forEach(function (key) {
      if (socketMap[key] === socket.id) socketMap[key] = undefined;
    }); // declare opponent as winner, for ongoing games disconnected player was in

    var playingRoom = playingRooms.find(function (room) {
      var roomSockets = [room.players[0].socket, room.players[1].socket];
      return roomSockets.includes(socket.id);
    });

    if (playingRoom !== undefined) {
      var index = [playingRoom.players[0].socket, playingRoom.players[1].socket].indexOf(socket.id);
      var disconnectedMeta = {
        player: index
      };
      socket.to(playingRoom.secret).emit('opponent left', disconnectedMeta);
      playingRooms = playingRooms.filter(function (room) {
        return room.id !== playingRoom.id;
      });
      var loser = index;
      var winner = loser * -1 + 1;
      var winnerObj = playingRoom.players[winner].user;
      var loserObj = playingRoom.players[loser].user;
      var colorMap = ['blue', 'white'];
      db.serialize(function () {
        db.get("SELECT * FROM Users WHERE id = '".concat(winnerObj.id, "'"), function (error, user) {
          if (user !== undefined) {
            var addWinQuery = "\n              UPDATE Users SET wins_".concat(colorMap[winner], " = ").concat(winner === 0 ? user.wins_blue + 1 : user.wins_white + 1, "\n              WHERE id = ").concat(user.id, "\n            ");
            db.run(addWinQuery, function (error, _) {
              return console.log("win added for ".concat(winnerObj.username));
            });
          }
        });
        db.get("SELECT * FROM Users WHERE id = '".concat(loserObj.id, "'"), function (error, user) {
          if (user !== undefined) {
            var addLossQuery = "\n                  UPDATE Users SET losses_".concat(colorMap[loser], " = ").concat(loser === 0 ? user.losses_blue + 1 : user.losses_white + 1, "\n                  WHERE id = ").concat(user.id, "\n                ");
            db.run(addLossQuery, function (error, _) {
              return console.log("win added for ".concat(loserObj.username));
            });
          }
        });
      });
    } // remove waiting games disconnected player was in


    var waitingRoom = rooms.find(function (room) {
      var roomSockets = [room.players[0].socket, room.players[1].socket];
      return roomSockets.includes(socket.id);
    });

    if (waitingRoom !== undefined) {
      rooms = rooms.filter(function (room) {
        return room.id !== waitingRoom.id;
      });
      io.emit('room ended', rooms);
    }
  });
}); // Remove playing rooms that have lasted for more than an hour

var hourInMilliseconds = 3600000;
var cleanRooms = setInterval(function () {
  var currentTimestamp = new Date().getTime();
  playingRooms = playingRooms.filter(function (room) {
    return currentTimestamp - room.startedTimestamp < hourInMilliseconds;
  });
}, hourInMilliseconds); // Serve

server.listen(PORT, function () {
  console.log('server started and listening on port ' + PORT);
});