import { useEffect, useState } from "react";

import "./game.css";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import type { Cell, GameState } from "./game/ticTacToe";
const newSocket = io(import.meta.env.VITE_API_URL);
const API = import.meta.env.VITE_API_URL;

type HistoryGame = {
  id: string;
  playerXId: string;
  playerOId: string;
  winnerId: string | null;
  result: "X_WON" | "O_WON" | "DRAW";
  board: Cell[];
  winningCombination: number[];
  endedAt: string;
  playerX: { id: string; username: string };
  playerO: { id: string; username: string };
};

export default function App() {
  const [username, setUsername] = useState("");
  const [acceptedUsername, setAcceptedUsername] = useState("");
  const [gameEndedReason, setGameEndedReason] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [history, setHistory] = useState<HistoryGame[]>([]);
  const [game, setGame] = useState<GameState | null>(null);

  const [waiting, setWaiting] = useState(false);
  const [match, setMatch] = useState<{
    opponent: string;
    player: "X" | "O";
    gameId: string;
  } | null>(null);

  // Refetch on game over too: a finished game is only in the DB after the server writes it.
  const finishedGameId = game?.gameOver ? match?.gameId : null;
  useEffect(() => {
    if (!userId) return;
    fetch(`${API}/api/games/users/${userId}`)
      .then((r) => r.json())
      .then((data) => setHistory(data.games ?? []))
      .catch(() => toast.error("Could not load match history"));
  }, [userId, finishedGameId]);

  useEffect(() => {
    const logConnect = () => console.log("Connected:", newSocket.id);
    newSocket.on("connect", logConnect);

    newSocket.on("welcome", (data) => {
      console.log(data);
    });

    newSocket.on("username_accepted", (data) => {
      setAcceptedUsername(data.username);
      setUsername("");
      setUserId(data.userId);
    });

    newSocket.on("waiting_for_opponent", () => {
      setWaiting(true);
    });

    newSocket.on("match_found", (data) => {
      setMatch(data);
      setWaiting(false);
    });
    newSocket.on("game_state", (gameState) => {
      setGame(gameState);
    });

    newSocket.on("error", (data) => {
      toast.error(data.message);
      // Server doesn't know us (e.g. DB reset): drop back to the join form.
      if (data.message === "User not found") {
        setAcceptedUsername("");
        setUserId("");
      }
    });

    newSocket.on("opponent_disconnected", (data) => {
      toast.warning(data.message);
      setGameEndedReason("Opponent disconnected. Waiting for reconnection...");
    });

    newSocket.on("opponent_reconnected", () => {
      toast.success("Opponent reconnected");
      setGameEndedReason(null);
    });

    newSocket.on("game_ended", (data) => {
      toast.error(data.message);
      setGameEndedReason("Opponent did not reconnect. Game ended.");
    });

    // Reconnected, but the server had no game for us — clear any stale board.
    newSocket.on("reconnect_complete", () => {
      setGame(null);
      setMatch(null);
      setWaiting(false);
      setGameEndedReason(null);
    });

    return () => {
      newSocket.off("connect", logConnect);
      newSocket.off("welcome");
      newSocket.off("username_accepted");
      newSocket.off("waiting_for_opponent");
      newSocket.off("match_found");
      newSocket.off("game_state");
      newSocket.off("error");
      newSocket.off("opponent_disconnected");
      newSocket.off("opponent_reconnected");
      newSocket.off("game_ended");
      newSocket.off("reconnect_complete");
    };
  }, []);

  useEffect(() => {
    if (!acceptedUsername) return;

    const handleConnect = () => {
      console.log("Connected:", newSocket.id);

      newSocket.emit("reconnect_user", {
        username: acceptedUsername,
      });
    };

    if (newSocket.connected) {
      handleConnect();
    }

    newSocket.on("connect", handleConnect);

    return () => {
      newSocket.off("connect", handleConnect);
    };
  }, [acceptedUsername]);

  const handleSubmit = () => {
    if (!username) {
      toast.error("Username is required");
      return;
    }

    newSocket.emit("set_username", username);
  };

  const findMatch = () => {
    setWaiting(true);

    newSocket.emit("find_match");
  };

  const play = (position: number) => {
    if (!match) return;

    newSocket.emit("make_move", {
      gameId: match?.gameId,
      position,
    });
  };

  const newGame = () => {
    setGame(null);
    setMatch(null);
    setWaiting(false);
    setGameEndedReason(null);
  };

  return (
    <main className="page">
      <Toaster position="top-center" />

      {!acceptedUsername ? (
        <div className="panel">
          <h1 className="title">Tic-Tac-Toe</h1>
          <p className="status">Pick a username to start playing.</p>
          <div className="join">
            <input
              className="field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
            />
            <button className="restart" onClick={handleSubmit}>
              Continue
            </button>
          </div>
        </div>
      ) : (
        <>
          <header className="panel">
            <h1 className="title">Welcome, {acceptedUsername}!</h1>
            {match ? (
              <p className="status">
                vs <strong>{match.opponent}</strong> — you are {match.player}
              </p>
            ) : waiting ? (
              <p className="status">Waiting for opponent...</p>
            ) : (
              <button className="restart" onClick={findMatch}>
                Find Match
              </button>
            )}
          </header>

          {game && (
            <section className="panel">
              <div
                className={game.gameOver ? "board board-over" : "board"}
                role="grid"
                aria-label="Tic-Tac-Toe board"
              >
                {game.board.map((cell, i) => (
                  <button
                    key={i}
                    onClick={() => play(i)}
                    disabled={game.gameOver || cell !== null}
                    aria-label={
                      cell ? `Cell ${i + 1}, ${cell}` : `Cell ${i + 1}, empty`
                    }
                    className={
                      game.winningCombination.includes(i)
                        ? "cell cell-win"
                        : "cell"
                    }
                  >
                    {cell}
                  </button>
                ))}
              </div>

              <p
                className={game.gameOver ? "status status-over" : "status"}
                aria-live="polite"
              >
                {gameEndedReason
                  ? gameEndedReason
                  : game.winner
                    ? `Player ${game.winner} wins!`
                    : game.isDraw
                      ? "Draw!"
                      : game.currentPlayer === match?.player
                        ? "Your turn"
                        : `${game.currentPlayer}'s turn`}
              </p>

              {(gameEndedReason || game.gameOver) && (
                <button className="restart" onClick={newGame}>
                  New Game
                </button>
              )}
            </section>
          )}

          {!game && (
            <section className="panel">
              <h2 className="subtitle">Match History</h2>

              {history.length === 0 ? (
                <p className="status">No games played yet.</p>
              ) : (
                <ul className="history">
                  {history.map((h) => {
                    const iAmX = h.playerXId === userId;
                    const opponent = iAmX
                      ? h.playerO.username
                      : h.playerX.username;
                    const outcome =
                      h.result === "DRAW"
                        ? "draw"
                        : h.winnerId === userId
                          ? "win"
                          : "loss";

                    return (
                      <li key={h.id} className="history-row">
                        <div className="history-meta">
                          <span className="history-opponent">
                            vs {opponent}
                          </span>
                          <span className="history-date">
                            {new Date(h.endedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>

                        <div
                          className="mini-board"
                          role="img"
                          aria-label={`Final board, ${outcome} against ${opponent}`}
                        >
                          {h.board.map((cell, i) => (
                            <span
                              key={i}
                              className={
                                h.winningCombination.includes(i)
                                  ? "mini-cell mini-cell-win"
                                  : "mini-cell"
                              }
                            >
                              {cell}
                            </span>
                          ))}
                        </div>

                        <span className={`badge badge-${outcome}`}>
                          {outcome === "win"
                            ? "Won"
                            : outcome === "loss"
                              ? "Lost"
                              : "Draw"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
