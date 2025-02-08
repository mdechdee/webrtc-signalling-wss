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
  peers: Map<number, {
    ws: WebSocket;
    offers: Map<WebSocket, OfferData>;
    answers: Map<WebSocket, AnswerData>;
    candidates: Map<WebSocket, CandidateData>;    
  }>
}

const wss = new WebSocketServer({ port: 8080 })
const rooms: Record<RoomId, Room> = {};

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message.toString()) as WsMessage;

    if (data.type === "host-room") {
      const roomId = Math.random().toString(36).substr(2, 5);
      rooms[roomId] = {
        host: ws,
        peers: new Map(),
      };
      ws.send(JSON.stringify({ type: "room-created", roomId }));
    } 
    else if (data.type === "join-room") {
      if (!rooms[data.roomId]) return;
      const peerId = generateUniquePeerId(rooms[data.roomId]);
      rooms[data.roomId].peers.set(peerId, {
        ws: ws,
        offers: new Map(),
        answers: new Map(),
        candidates: new Map(),
      });
      ws.send(JSON.stringify({ type: "room-joined", roomId: data.roomId, peerId: peerId }));
    }
    else if (data.type === "offer" || data.type === "answer" || data.type === "candidate") {
      if (!rooms[data.roomId] || !rooms[data.roomId].peers.has(data.rtcData.dst)) return;
      const peerId = data.rtcData.dst;
      const peer = rooms[data.roomId].peers.get(peerId)!;
      const fieldType = `${data.type}s` as const;
      (peer[fieldType] as Map<WebSocket, typeof data.rtcData>).set(ws, data.rtcData);
    }

    console.log(rooms);
  });

  ws.on("close", () => {
    for (const roomId in rooms) {
      if (rooms[roomId].host === ws) {
        delete rooms[roomId];
      } else {
        for (const [peerId, peer] of rooms[roomId].peers) {
          if (peer.ws === ws) {
            rooms[roomId].peers.delete(peerId);
          }
        }
      }
    }
  });
});

const generateUniquePeerId = (room: Room): number => {
  const peerId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  return room.peers.has(peerId) ? generateUniquePeerId(room) : peerId;
};


console.log("WebRTC signaling server running on ws://localhost:8080");
