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

export interface Game {
  playerXId: string;
  playerOId: string;

  playerXSocketId: string | null;
  playerOSocketId: string | null;

  disconnectedPlayerId: string | null;
  disconnectTimeout: NodeJS.Timeout | null;

  state: GameState;
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

export function createGame(
  playerXId: string,
  playerXSocketId: string,
  playerOId: string,
  playerOSocketId: string,
): Game {
  return {
    playerXId,
    playerOId,
    playerXSocketId,
    playerOSocketId,
    disconnectedPlayerId: null,
    disconnectTimeout: null,
    state: {
      board: Array<Cell>(9).fill(null),
      currentPlayer: "X",
      winner: null,
      winningCombination: [],
      isDraw: false,
      gameOver: false,
    },
  };
}

function checkWinner(board: Cell[]) {
  for (const line of LINES) {
    const [a, b, c] = line;

    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        winner: board[a],
        line,
      };
    }
  }

  return null;
}

export function makeMove(game: GameState, position: number): GameState {
  if (game.gameOver) {
    return game;
  }

  if (game.board[position] !== null) {
    return game;
  }

  const board = [...game.board];

  board[position] = game.currentPlayer;

  const win = checkWinner(board);

  const isDraw = !win && board.every((cell) => cell !== null);

  return {
    board,
    currentPlayer:
      win || isDraw
        ? game.currentPlayer
        : game.currentPlayer === "X"
          ? "O"
          : "X",
    winner: win?.winner ?? null,
    winningCombination: win?.line ?? [],
    isDraw,
    gameOver: Boolean(win) || isDraw,
  };
}
