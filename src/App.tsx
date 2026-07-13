import { FormEvent, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ActionResult, ClientToServerEvents, RoomView, ServerToClientEvents } from "../shared/types";

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo ${compact ? "logo--compact" : ""}`} aria-label="Quickwit">
      <span className="logo__bolt">↯</span>
      <span>quickwit</span>
    </div>
  );
}

function AppShell({ room, children }: { room: RoomView; children: React.ReactNode }) {
  return (
    <main className="game-shell">
      <header className="game-header">
        <Logo compact />
        <div className="room-chip"><span>ROOM</span>{room.code}</div>
      </header>
      {children}
    </main>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return message ? <p className="error" role="alert">{message}</p> : null;
}

function Welcome({ onJoined }: { onJoined: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const create = () => {
    setError(""); setBusy(true);
    socket.emit("createRoom", name, (result) => {
      setBusy(false);
      if (!result.ok) return setError(result.error);
      onJoined();
    });
  };

  const join = (event: FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    socket.emit("joinRoom", code, name, (result) => {
      setBusy(false);
      if (!result.ok) return setError(result.error);
      onJoined();
    });
  };

  return (
    <main className="welcome">
      <nav className="welcome__nav"><Logo compact /><span>PARTY GAMES FOR QUICK THINKERS</span></nav>
      <section className="hero">
        <div className="hero__eyebrow"><span />READY WHEN YOU ARE</div>
        <h1>Think fast.<br /><em>Laugh faster.</em></h1>
        <p className="hero__copy">Grab your favorite people and turn any screen into game night. No downloads. No explaining the rules for twenty minutes.</p>
        <form className="join-card" onSubmit={join}>
          <label>
            <span>YOUR NAME</span>
            <input maxLength={18} value={name} onChange={(event) => setName(event.target.value)} placeholder="The funny one" autoComplete="nickname" />
          </label>
          <label>
            <span>ROOM CODE</span>
            <input className="code-input" maxLength={4} value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} placeholder="ABCD" autoCapitalize="characters" />
          </label>
          <button className="button button--primary" disabled={busy || !name.trim() || code.length !== 4}>Join game <span>→</span></button>
          <div className="divider"><span>or</span></div>
          <button className="button button--ghost" type="button" disabled={busy || !name.trim()} onClick={create}>Host a new game</button>
          <ErrorMessage message={error} />
        </form>
      </section>
      <aside className="doodle doodle--one">?</aside>
      <aside className="doodle doodle--two">!</aside>
      <footer className="welcome__footer"><span>01</span><div /><p>QUICK WIT<br /><small>WRITE • VOTE • WIN</small></p><span>TRIVIA<br /><small>COMING NEXT</small></span></footer>
    </main>
  );
}

function Lobby({ room }: { room: RoomView }) {
  const [error, setError] = useState("");
  const start = () => socket.emit("startGame", (result) => !result.ok && setError(result.error));
  return (
    <AppShell room={room}>
      <section className="center-panel lobby">
        <p className="kicker">THE ROOM IS OPEN</p>
        <h1>Bring in the <em>funny people.</em></h1>
        <p>Share the room code. Everyone joins from this page.</p>
        <div className="big-code" aria-label={`Room code ${room.code}`}>{room.code}</div>
        <div className="player-grid">
          {room.players.map((player, index) => <div className="player-card" key={player.id}><span>{index + 1}</span><strong>{player.name}</strong>{player.isHost && <small>HOST</small>}</div>)}
          {Array.from({ length: Math.max(0, 3 - room.players.length) }, (_, index) => <div className="player-card player-card--empty" key={index}>Waiting…</div>)}
        </div>
        {room.me.isHost ? <button className="button button--primary lobby__button" onClick={start} disabled={room.players.length < 3}>Start game <span>→</span></button> : <div className="waiting"><i /> Waiting for the host</div>}
        {room.me.isHost && room.players.length < 3 && <p className="hint">You need {3 - room.players.length} more {3 - room.players.length === 1 ? "player" : "players"}.</p>}
        <ErrorMessage message={error} />
      </section>
    </AppShell>
  );
}

function Answering({ room }: { room: RoomView }) {
  const initial = useMemo(() => Object.fromEntries(room.prompts.map((prompt) => [prompt.id, prompt.answer ?? ""])), [room.prompts]);
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const [error, setError] = useState("");
  const submitted = room.me.hasSubmitted;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    socket.emit("submitAnswers", answers, (result) => !result.ok && setError(result.error));
  };
  if (submitted) return <WaitingRoom room={room} title="Sharp work." detail="Your answers are locked in. Now pretend not to look nervous." />;
  return (
    <AppShell room={room}>
      <section className="play-panel">
        <div className="round-label">ROUND {room.round} <span>•</span> ANSWER</div>
        <h1>Your move, <em>{room.me.name}.</em></h1>
        <p>Answer both prompts. Short, strange, and specific usually wins.</p>
        <form onSubmit={submit} className="prompt-list">
          {room.prompts.map((prompt, index) => <label className="prompt-card" key={prompt.id}><span className="prompt-card__number">0{index + 1}</span><strong>{prompt.text}</strong><textarea maxLength={120} rows={2} value={answers[prompt.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [prompt.id]: event.target.value }))} placeholder="Type something brilliant-ish…" /><small>{(answers[prompt.id] ?? "").length}/120</small></label>)}
          <button className="button button--primary" disabled={room.prompts.some((prompt) => !answers[prompt.id]?.trim())}>Lock in answers <span>→</span></button>
          <ErrorMessage message={error} />
        </form>
      </section>
    </AppShell>
  );
}

function WaitingRoom({ room, title, detail }: { room: RoomView; title: string; detail: string }) {
  const done = room.players.filter((player) => player.hasSubmitted).length;
  return <AppShell room={room}><section className="center-panel waiting-panel"><div className="scribble-check">✓</div><p className="kicker">ANSWERS LOCKED</p><h1>{title}</h1><p>{detail}</p><div className="progress"><div style={{ width: `${(done / room.players.length) * 100}%` }} /></div><small>{done} OF {room.players.length} PLAYERS READY</small></section></AppShell>;
}

function Voting({ room }: { room: RoomView }) {
  const [error, setError] = useState("");
  const vote = (id: string) => socket.emit("castVote", id, (result) => !result.ok && setError(result.error));
  return (
    <AppShell room={room}>
      <section className="play-panel vote-panel">
        <div className="round-label">ROUND {room.round} <span>•</span> VOTE</div>
        <p className="kicker">THE PROMPT</p>
        <h1>“{room.matchup?.prompt}”</h1>
        {room.matchup?.canVote ? <><p>Tap the answer that deserves the points.</p><div className="answer-grid">{room.matchup.answers.map((answer, index) => <button className={`answer-card answer-card--${index + 1}`} onClick={() => vote(answer.id)} key={answer.id}><span>ANSWER {String.fromCharCode(65 + index)}</span><strong>{answer.text}</strong><i>Pick this one →</i></button>)}</div></> : <div className="spectating"><span>◉</span><h2>{room.me.hasVoted ? "Vote locked in." : "You're in this matchup."}</h2><p>{room.me.hasVoted ? "Waiting for the rest of the room…" : "Sit back and watch the room judge your work."}</p></div>}
        <ErrorMessage message={error} />
      </section>
    </AppShell>
  );
}

function Scores({ room }: { room: RoomView }) {
  const [error, setError] = useState("");
  const finished = room.stage === "finished";
  const action = () => socket.emit(finished ? "playAgain" : "nextRound", (result) => !result.ok && setError(result.error));
  return (
    <AppShell room={room}>
      <section className="center-panel scores">
        <p className="kicker">{finished ? "FINAL SCORE" : `ROUND ${room.round} COMPLETE`}</p>
        <h1>{finished ? <>Crown the <em>quickest wit.</em></> : <>Here’s where we <em>stand.</em></>}</h1>
        <div className="scoreboard">{room.players.map((player, index) => <div className={`score-row ${index === 0 ? "score-row--winner" : ""}`} key={player.id}><span className="score-rank">{String(index + 1).padStart(2, "0")}</span><strong>{player.name}{player.id === room.me.id && <small> YOU</small>}</strong><span>{player.score.toLocaleString()} <small>PTS</small></span></div>)}</div>
        {room.me.isHost ? <button className="button button--primary" onClick={action}>{finished ? "Play again" : "Next round"} <span>→</span></button> : <div className="waiting"><i /> Waiting for the host</div>}
        <ErrorMessage message={error} />
      </section>
    </AppShell>
  );
}

export function App() {
  const [room, setRoom] = useState<RoomView>();
  const [, forceConnected] = useState(0);
  useEffect(() => {
    const update = (next: RoomView) => setRoom(next);
    const reconnect = () => forceConnected((value) => value + 1);
    socket.on("roomState", update); socket.on("connect", reconnect);
    return () => { socket.off("roomState", update); socket.off("connect", reconnect); };
  }, []);

  if (!room) return <Welcome onJoined={() => undefined} />;
  if (room.stage === "lobby") return <Lobby room={room} />;
  if (room.stage === "answering") return <Answering room={room} />;
  if (room.stage === "voting") return <Voting room={room} />;
  return <Scores room={room} />;
}
