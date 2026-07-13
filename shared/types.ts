export type GameStage = "lobby" | "answering" | "voting" | "leaderboard" | "finished";

export interface PlayerView {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  hasSubmitted: boolean;
  hasVoted: boolean;
}

export interface PromptView {
  id: string;
  text: string;
  answer?: string;
}

export interface AnswerView {
  id: string;
  text: string;
}

export interface MatchupView {
  prompt: string;
  answers: AnswerView[];
  canVote: boolean;
}

export interface RoomView {
  code: string;
  stage: GameStage;
  round: number;
  totalRounds: number;
  players: PlayerView[];
  me: PlayerView;
  prompts: PromptView[];
  matchup?: MatchupView;
  statusText: string;
}

export interface ClientToServerEvents {
  createRoom: (name: string, reply: (result: JoinResult) => void) => void;
  joinRoom: (code: string, name: string, reply: (result: JoinResult) => void) => void;
  startGame: (reply: (result: ActionResult) => void) => void;
  submitAnswers: (answers: Record<string, string>, reply: (result: ActionResult) => void) => void;
  castVote: (answerId: string, reply: (result: ActionResult) => void) => void;
  nextRound: (reply: (result: ActionResult) => void) => void;
  playAgain: (reply: (result: ActionResult) => void) => void;
}

export interface ServerToClientEvents {
  roomState: (room: RoomView) => void;
}

export type ActionResult = { ok: true } | { ok: false; error: string };
export type JoinResult = { ok: true; code: string } | { ok: false; error: string };
