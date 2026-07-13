import type { RoomView } from "../shared/types.js";
import { PROMPTS } from "./prompts.js";

export interface Player {
  id: string;
  name: string;
  score: number;
  connected: boolean;
}

interface Answer {
  id: string;
  playerId: string;
  text: string;
}

interface Matchup {
  id: string;
  prompt: string;
  playerIds: [string, string];
  answers: Answer[];
  votes: Map<string, string>;
}

export interface Room {
  code: string;
  hostId: string;
  stage: "lobby" | "answering" | "voting" | "leaderboard" | "finished";
  round: number;
  totalRounds: number;
  players: Player[];
  matchups: Matchup[];
  matchupIndex: number;
}

const cleanName = (name: string) => name.trim().replace(/\s+/g, " ").slice(0, 18);

export function createRoom(code: string, playerId: string, name: string): Room {
  return {
    code,
    hostId: playerId,
    stage: "lobby",
    round: 0,
    totalRounds: 2,
    players: [{ id: playerId, name: cleanName(name), score: 0, connected: true }],
    matchups: [],
    matchupIndex: 0,
  };
}

export function addPlayer(room: Room, id: string, name: string): string | undefined {
  const normalized = cleanName(name);
  if (room.stage !== "lobby") return "That game has already started.";
  if (!normalized) return "Enter a display name.";
  if (room.players.length >= 8) return "That room is full.";
  if (room.players.some((player) => player.name.toLowerCase() === normalized.toLowerCase())) {
    return "That name is already taken in this room.";
  }
  room.players.push({ id, name: normalized, score: 0, connected: true });
  return undefined;
}

function shuffled<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export function startRound(room: Room): string | undefined {
  if (room.players.length < 3) return "You need at least 3 players.";
  room.round += 1;
  room.stage = "answering";
  room.matchupIndex = 0;
  const prompts = shuffled(PROMPTS).slice(0, room.players.length);
  room.matchups = room.players.map((player, index) => ({
    id: `${room.round}-${index}`,
    prompt: prompts[index],
    playerIds: [player.id, room.players[(index + 1) % room.players.length].id],
    answers: [],
    votes: new Map(),
  }));
  return undefined;
}

export function submitAnswers(room: Room, playerId: string, submitted: Record<string, string>): string | undefined {
  if (room.stage !== "answering") return "Answers are closed.";
  const assigned = room.matchups.filter((matchup) => matchup.playerIds.includes(playerId));
  if (assigned.every((matchup) => matchup.answers.some((answer) => answer.playerId === playerId))) {
    return "Your answers are already in.";
  }
  for (const matchup of assigned) {
    const text = submitted[matchup.id]?.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!text) return "Answer every prompt before submitting.";
  }
  for (const matchup of assigned) {
    matchup.answers.push({ id: `${matchup.id}-${playerId}`, playerId, text: submitted[matchup.id].trim() });
  }
  if (room.matchups.every((matchup) => matchup.answers.length === 2)) room.stage = "voting";
  return undefined;
}

export function castVote(room: Room, playerId: string, answerId: string): string | undefined {
  if (room.stage !== "voting") return "Voting is closed.";
  const matchup = room.matchups[room.matchupIndex];
  if (matchup.playerIds.includes(playerId)) return "You can't vote on your own matchup.";
  if (matchup.votes.has(playerId)) return "Your vote is already in.";
  if (!matchup.answers.some((answer) => answer.id === answerId)) return "Choose one of these answers.";
  matchup.votes.set(playerId, answerId);

  const eligibleVoters = room.players.filter((player) => !matchup.playerIds.includes(player.id) && player.connected);
  if (matchup.votes.size >= eligibleVoters.length) finishMatchup(room, matchup);
  return undefined;
}

function finishMatchup(room: Room, matchup: Matchup) {
  const multiplier = room.round;
  const totalVotes = matchup.votes.size;
  for (const answer of matchup.answers) {
    const votes = [...matchup.votes.values()].filter((id) => id === answer.id).length;
    const points = totalVotes === 0 ? 500 * multiplier : Math.round((votes / totalVotes) * 1000 * multiplier);
    const player = room.players.find((candidate) => candidate.id === answer.playerId);
    if (player) player.score += points;
  }
  if (room.matchupIndex < room.matchups.length - 1) room.matchupIndex += 1;
  else room.stage = room.round >= room.totalRounds ? "finished" : "leaderboard";
}

export function hasSubmitted(room: Room, playerId: string): boolean {
  const assigned = room.matchups.filter((matchup) => matchup.playerIds.includes(playerId));
  return assigned.length > 0 && assigned.every((matchup) => matchup.answers.some((answer) => answer.playerId === playerId));
}

export function roomView(room: Room, playerId: string): RoomView {
  const current = room.matchups[room.matchupIndex];
  const me = room.players.find((player) => player.id === playerId)!;
  const isAuthor = current?.playerIds.includes(playerId) ?? false;
  const voted = current?.votes.has(playerId) ?? false;
  const players = room.players
    .map((player) => ({
      ...player,
      isHost: player.id === room.hostId,
      hasSubmitted: hasSubmitted(room, player.id),
      hasVoted: current?.votes.has(player.id) ?? false,
    }))
    .sort((a, b) => b.score - a.score);

  const statuses: Record<Room["stage"], string> = {
    lobby: "Waiting for the host to start",
    answering: hasSubmitted(room, playerId) ? "Answers locked in — hang tight" : "Write your quickest, funniest answers",
    voting: isAuthor ? "Your answers are up — no voting this time" : voted ? "Vote locked in" : "Pick the answer that made you laugh",
    leaderboard: "Round complete",
    finished: "That's the game!",
  };

  return {
    code: room.code,
    stage: room.stage,
    round: room.round,
    totalRounds: room.totalRounds,
    players,
    me: players.find((player) => player.id === me.id)!,
    prompts: room.stage === "answering"
      ? room.matchups
          .filter((matchup) => matchup.playerIds.includes(playerId))
          .map((matchup) => ({
            id: matchup.id,
            text: matchup.prompt,
            answer: matchup.answers.find((answer) => answer.playerId === playerId)?.text,
          }))
      : [],
    matchup: room.stage === "voting" && current
      ? {
          prompt: current.prompt,
          answers: current.answers.map(({ id, text }) => ({ id, text })),
          canVote: !isAuthor && !voted,
        }
      : undefined,
    statusText: statuses[room.stage],
  };
}

export function resetRoom(room: Room) {
  room.stage = "lobby";
  room.round = 0;
  room.matchups = [];
  room.matchupIndex = 0;
  room.players.forEach((player) => { player.score = 0; });
}
