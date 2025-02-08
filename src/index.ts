import { v4 as uuidv4 } from 'uuid';
import { WebSocket, WebSocketServer } from 'ws';

type WsMessage =
  | HostRoomMessage
  | JoinRoomMessage
  | OfferMessage
  | AnswerMessage
  | CandidateMessage

interface RtcData {
  src: number;
  dst: number;
  sdp: string;
}

interface OfferData extends RtcData { }
interface AnswerData extends RtcData { }
interface CandidateData extends RtcData {
  media: number;
  idx: number;
}

interface HostRoomMessage {
  type: "host-room";
  roomId: string;
}
interface JoinRoomMessage {
  type: "join-room";
  roomId: string;
}
interface OfferMessage {
  type: "offer";
  roomId: string;
  rtcData: OfferData;
}
interface AnswerMessage {
  type: "answer";
  roomId: string;
  rtcData: AnswerData;
}
interface CandidateMessage {
  type: "candidate";
  roomId: string;
  rtcData: CandidateData;
}


type RoomId = string;

interface Room {
  host: WebSocket;
  guests: WebSocket[];
  offers: Map<WebSocket, OfferData>;
  answers: Map<WebSocket, AnswerData>;
  candidates: Map<WebSocket, CandidateData>;
}


const wss = new WebSocketServer({ port: 8080 })
const rooms: Record<RoomId, Room> = {};

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message.toString()) as WsMessage;

    switch (data.type) {
      case "host-room":
        const roomId = Math.random().toString(36).substr(2, 5);
        rooms[roomId] = {
          host: ws,
          guests: [],
          offers: new Map(),
          answers: new Map(),
          candidates: new Map()
        };
        ws.send(JSON.stringify({ type: "room-created", roomId }));
        break;
      case "join-room":
        if (!rooms[data.roomId]) break;
        rooms[data.roomId].guests.push(ws);
        ws.send(JSON.stringify({ type: "room-joined", roomId: data.roomId }));
        break;

      case "offer":
      case "answer":
      case "candidate":
        if (!rooms[data.roomId]) break;
        const fieldType = `${data.type}s` as const;
        (rooms[data.roomId][fieldType] as Map<WebSocket, typeof data.rtcData>).set(ws, data.rtcData);
        break;
    }

    console.log(rooms);
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
