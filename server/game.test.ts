import { describe, expect, it } from "vitest";
import { addPlayer, castVote, createRoom, roomView, startRound, submitAnswers } from "./game.js";

function submitFor(room: ReturnType<typeof createRoom>, playerId: string) {
  const prompts = roomView(room, playerId).prompts;
  const answers = Object.fromEntries(prompts.map((prompt, index) => [prompt.id, `Answer ${playerId} ${index}`]));
  return submitAnswers(room, playerId, answers);
}

describe("Quick Wit game", () => {
  it("requires three players and assigns two prompts to everyone", () => {
    const room = createRoom("WITT", "p1", "Ada");
    expect(startRound(room)).toContain("3 players");
    expect(addPlayer(room, "p2", "Grace")).toBeUndefined();
    expect(addPlayer(room, "p3", "Linus")).toBeUndefined();
    expect(startRound(room)).toBeUndefined();
    expect(room.stage).toBe("answering");
    expect(roomView(room, "p1").prompts).toHaveLength(2);
    expect(roomView(room, "p2").prompts).toHaveLength(2);
  });

  it("moves from answers through anonymous voting to scores", () => {
    const room = createRoom("FAST", "p1", "Ada");
    addPlayer(room, "p2", "Grace");
    addPlayer(room, "p3", "Linus");
    startRound(room);

    expect(submitFor(room, "p1")).toBeUndefined();
    expect(submitFor(room, "p2")).toBeUndefined();
    expect(room.stage).toBe("answering");
    expect(submitFor(room, "p3")).toBeUndefined();
    expect(room.stage).toBe("voting");

    while (room.stage === "voting") {
      const voterId = room.players.find((player) => roomView(room, player.id).matchup?.canVote)!.id;
      const view = roomView(room, voterId);
      expect(view.matchup?.answers[0]).not.toHaveProperty("playerId");
      expect(castVote(room, voterId, view.matchup!.answers[0].id)).toBeUndefined();
    }

    expect(room.stage).toBe("leaderboard");
    expect(room.players.reduce((sum, player) => sum + player.score, 0)).toBe(3000);
  });

  it("rejects duplicate names and voting on your own answer", () => {
    const room = createRoom("NOPE", "p1", "Ada");
    expect(addPlayer(room, "p2", " ada ")).toContain("already taken");
    addPlayer(room, "p2", "Grace"); addPlayer(room, "p3", "Linus"); startRound(room);
    submitFor(room, "p1"); submitFor(room, "p2"); submitFor(room, "p3");
    const author = room.players.find((player) => !roomView(room, player.id).matchup?.canVote)!;
    const answerId = roomView(room, author.id).matchup!.answers[0].id;
    expect(castVote(room, author.id, answerId)).toContain("own matchup");
  });
});
