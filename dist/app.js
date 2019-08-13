"use strict";

var _http = _interopRequireDefault(require("http"));

var _express = _interopRequireDefault(require("express"));

var _socket = _interopRequireDefault(require("socket.io"));

var _cors = _interopRequireDefault(require("cors"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var PORT = process.env.PORT || 5000;
var app = (0, _express["default"])();
app.use((0, _cors["default"])()); // Temporarily serve fake data, with this variable

var rooms = [];
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

var server = _http["default"].createServer(app);

var io = (0, _socket["default"])(server);
io.on('connection', function (socket) {
  console.log('client connected on websocket');
  socket.on('create room', function (_ref) {
    var roomData = _ref.roomData,
        playerName = _ref.playerName;
    var name = roomData.name,
        side = roomData.side;
    var players = {
      "0": {
        name: null
      },
      "1": {
        name: null
      }
    };
    players[side].name = playerName; // basic validation

    if (name !== undefined && side !== undefined) {
      var room = {
        name: name,
        players: players,
        status: 'waiting'
      }; // temporarily use room index as secret key to verify following requests

      socket.emit('room joined', _objectSpread({}, room, {
        secret: rooms.push(room)
      }));
      socket.broadcast.emit('room created', rooms);
    }
  });
});
server.listen(PORT, function () {
  console.log('server started and listening on port ' + PORT);
});