import { WebSocket, WebSocketServer } from "ws";

type WsMessage =
  | HostRoomMessage
  | JoinRoomMessage
  | OfferMessage
  | AnswerMessage
  | CandidateMessage;

interface RtcData {
  src: number;
  dst: number;
  sdp: string;
}

interface OfferData extends RtcData {}
interface AnswerData extends RtcData {}
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
  peers: Map<number, WebSocket>;
}

const wss = new WebSocketServer({ port: 8080 });
const rooms: Record<RoomId, Room> = {};

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message.toString()) as WsMessage;

    if (data.type === "host-room") {
      const roomId = Math.random().toString(36).substr(2, 5);
      rooms[roomId] = {
        peers: new Map(),
      };
      rooms[roomId].peers.set(0, ws);
      ws.send(JSON.stringify({ type: "room-created", roomId }));
    } else if (data.type === "join-room") {
      if (!rooms[data.roomId]) return;
      const peerId = generateUniquePeerId(rooms[data.roomId]);
      rooms[data.roomId].peers.set(peerId, ws);
      ws.send(
        JSON.stringify({
          type: "room-joined",
          roomId: data.roomId,
          peerId: peerId,
        })
      );
    } else if (
      data.type === "offer" ||
      data.type === "answer" ||
      data.type === "candidate"
    ) {
      if (
        !rooms[data.roomId] ||
        !rooms[data.roomId].peers.has(data.rtcData.dst)
      )
        return;
      const peerId = data.rtcData.dst;
      const dstWs = rooms[data.roomId].peers.get(peerId)!;
      dstWs.send(JSON.stringify({ type: data.type, rtcData: data.rtcData }));
    }
  });

  ws.on("close", () => {
    for (const roomId in rooms) {
      if (rooms[roomId].peers.get(0) === ws) {
        delete rooms[roomId];
      } else {
        for (const [peerId, peer] of rooms[roomId].peers) {
          if (peer === ws) {
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
