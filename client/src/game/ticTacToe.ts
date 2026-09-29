export type Player = "X" | "O";
export type Cell = Player | null;

export interface GameState {
  board: Cell[];
  currentPlayer: Player;
  winner: Player | null;
  winningCombination: number[];
  isDraw: boolean;
  gameOver: boolean;
}

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function createGame(): GameState {
  return {
    board: Array<Cell>(9).fill(null),
    currentPlayer: "X",
    winner: null,
    winningCombination: [],
    isDraw: false,
    gameOver: false,
  };
}

export const resetGame = createGame;

export function checkWinner(
  board: Cell[],
): { winner: Player; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return null;
}

/** Returns the next state. Invalid moves return the same state unchanged. */
export function makeMove(state: GameState, position: number): GameState {
  if (state.gameOver || state.board[position] !== null) return state;

  const board = [...state.board];
  board[position] = state.currentPlayer;

  const win = checkWinner(board);
  const isDraw = !win && board.every((cell) => cell !== null);

  return {
    board,
    currentPlayer:
      win || isDraw
        ? state.currentPlayer
        : state.currentPlayer === "X"
          ? "O"
          : "X",
    winner: win?.winner ?? null,
    winningCombination: win?.line ?? [],
    isDraw,
    gameOver: Boolean(win) || isDraw,
  };
}
