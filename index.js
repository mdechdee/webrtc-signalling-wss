const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const wss = new WebSocket.Server({ port: 8080 });
const rooms = {}; // Stores room_id -> { host, guests, messages }

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case "host-room":
        const roomId = Math.random().toString(36).substr(2, 5);
        rooms[roomId] = { host: ws, guests: [], messages: [] };
        ws.send(JSON.stringify({ type: "room-created", roomId }));
        break;

      case "join-room":
        if (rooms[data.roomId]) {
          rooms[data.roomId].guests.push(ws);
          ws.send(JSON.stringify({ type: "room-joined", roomId: data.roomId }));
          rooms[data.roomId].host.send(JSON.stringify({ type: "new-guest" }));
        } else {
          ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
        }
        break;

      case "offer":
        if (rooms[data.roomId]) {
          rooms[data.roomId].messages.push({
            type: "offer",
            offer: data.offer,
          });
          rooms[data.roomId].host.send(
            JSON.stringify({ type: "offer", offer: data.offer })
          );
        }
        break;

      case "answer":
        if (rooms[data.roomId]) {
          rooms[data.roomId].messages.push({
            type: "answer",
            answer: data.answer,
          });
          rooms[data.roomId].guests.forEach((guest) => {
            guest.send(JSON.stringify({ type: "answer", answer: data.answer }));
          });
        }
        break;
    }
  });

  ws.on("close", () => {
    for (const roomId in rooms) {
      if (rooms[roomId].host === ws) {
        delete rooms[roomId];
      } else {
        rooms[roomId].guests = rooms[roomId].guests.filter(
          (guest) => guest !== ws
        );
      }
    }
  });
});

console.log("WebRTC signaling server running on ws://localhost:8080");
