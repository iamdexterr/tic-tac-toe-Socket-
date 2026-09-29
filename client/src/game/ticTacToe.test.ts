// Run: npx tsx src/game/ticTacToe.test.ts   (or paste into any runner later)
import assert from "node:assert/strict";
import { createGame, makeMove, checkDraw, type GameState } from "./ticTacToe";

const playAll = (moves: number[]): GameState => moves.reduce(makeMove, createGame());

// X starts, turns alternate
let g = makeMove(createGame(), 0);
assert.equal(g.board[0], "X");
assert.equal(g.currentPlayer, "O");

// occupied cell is rejected, state unchanged
assert.equal(makeMove(g, 0), g);

// row win
g = playAll([0, 3, 1, 4, 2]);
assert.equal(g.winner, "X");
assert.deepEqual(g.winningCombination, [0, 1, 2]);
assert.ok(g.gameOver && !g.isDraw);

// no moves after game over
assert.equal(makeMove(g, 5), g);

// column + diagonal
assert.equal(playAll([0, 1, 3, 2, 6]).winner, "X");
assert.equal(playAll([0, 1, 4, 2, 8]).winner, "X");
assert.deepEqual(playAll([0, 2, 8, 4, 1, 6]).winningCombination, [2, 4, 6]);

// draw
g = playAll([0, 1, 2, 4, 3, 5, 7, 6, 8]);
assert.ok(g.isDraw && g.gameOver && g.winner === null);
assert.ok(checkDraw(g.board));

// full board with a winner is not a draw
assert.equal(checkDraw(["X", "X", "X", "O", "O", "X", "X", "O", "O"]), false);

console.log("all game logic checks passed");
