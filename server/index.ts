import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, ActionResult } from "../shared/types.js";
import { addPlayer, castVote, createRoom, resetRoom, roomView, startRound, submitAnswers, type Room } from "./game.js";

const app = express();
const server = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: process.env.CLIENT_URL ?? "http://localhost:5173" },
});
const rooms = new Map<string, Room>();
const roomBySocket = new Map<string, string>();

const makeCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  do {
    code = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
};

function broadcast(room: Room) {
  for (const player of room.players) io.to(player.id).emit("roomState", roomView(room, player.id));
}

function currentRoom(socketId: string): Room | undefined {
  const code = roomBySocket.get(socketId);
  return code ? rooms.get(code) : undefined;
}

function guardedAction(socketId: string, reply: (result: ActionResult) => void, action: (room: Room) => string | undefined) {
  const room = currentRoom(socketId);
  if (!room) return reply({ ok: false, error: "Join a room first." });
  const error = action(room);
  if (error) return reply({ ok: false, error });
  broadcast(room);
  reply({ ok: true });
}

io.on("connection", (socket) => {
  socket.on("createRoom", (name, reply) => {
    if (!name.trim()) return reply({ ok: false, error: "Enter a display name." });
    const code = makeCode();
    const room = createRoom(code, socket.id, name);
    rooms.set(code, room);
    roomBySocket.set(socket.id, code);
    broadcast(room);
    reply({ ok: true, code });
  });

  socket.on("joinRoom", (rawCode, name, reply) => {
    const code = rawCode.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return reply({ ok: false, error: "Room not found. Check the code and try again." });
    const error = addPlayer(room, socket.id, name);
    if (error) return reply({ ok: false, error });
    roomBySocket.set(socket.id, code);
    broadcast(room);
    reply({ ok: true, code });
  });

  socket.on("startGame", (reply) => guardedAction(socket.id, reply, (room) => {
    if (room.hostId !== socket.id) return "Only the host can start the game.";
    if (room.stage !== "lobby") return "The game has already started.";
    return startRound(room);
  }));

  socket.on("submitAnswers", (answers, reply) => guardedAction(socket.id, reply, (room) => submitAnswers(room, socket.id, answers)));
  socket.on("castVote", (answerId, reply) => guardedAction(socket.id, reply, (room) => castVote(room, socket.id, answerId)));

  socket.on("nextRound", (reply) => guardedAction(socket.id, reply, (room) => {
    if (room.hostId !== socket.id) return "Only the host can continue.";
    if (room.stage !== "leaderboard") return "The round isn't over yet.";
    return startRound(room);
  }));

  socket.on("playAgain", (reply) => guardedAction(socket.id, reply, (room) => {
    if (room.hostId !== socket.id) return "Only the host can restart.";
    if (room.stage !== "finished") return "Finish this game first.";
    resetRoom(room);
    return undefined;
  }));

  socket.on("disconnect", () => {
    const room = currentRoom(socket.id);
    roomBySocket.delete(socket.id);
    if (!room) return;
    const player = room.players.find((candidate) => candidate.id === socket.id);
    if (player) player.connected = false;
    if (room.stage === "lobby") room.players = room.players.filter((candidate) => candidate.id !== socket.id);
    if (room.players.length === 0) rooms.delete(room.code);
    else {
      if (room.hostId === socket.id) room.hostId = room.players.find((candidate) => candidate.connected)?.id ?? room.players[0].id;
      broadcast(room);
    }
  });
});

app.get("/api/health", (_request, response) => response.json({ ok: true, rooms: rooms.size }));

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, "../../dist");
app.use(express.static(clientDist));
app.get("*", (_request, response) => response.sendFile(path.join(clientDist, "index.html")));

const port = Number(process.env.PORT ?? 3001);
server.listen(port, () => console.log(`Quickwit server running on http://localhost:${port}`));
