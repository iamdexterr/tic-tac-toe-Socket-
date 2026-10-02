import express from "express";
import http from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import {
  Cell,
  createGame,
  Game,
  GameState,
  makeMove,
  Player,
} from "./gameLogic.js";
import { prisma } from "../lib/prisma.js";
import gamesRoutes from "./routes/games.routes.js";
import cors from "cors";

const clientUrl = process.env.CLIENT_URL;
interface ConnectedUser {
  id: string;
  username: string;
}

const users = new Map<string, ConnectedUser>();
const games = new Map<string, Game>();
const waitingPlayers: string[] = [];

const app = express();

app.use(cors({ origin: clientUrl, credentials: true }));
app.use(express.json());

const server = http.createServer(app);

app.get("/", (req, res) => {
  res.send("The server is running!");
});

app.use("/api/games", gamesRoutes);

const io = new Server(server, {
  cors: {
    origin: clientUrl,
  },
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.emit("welcome", {
    message: "Welcome to the server!",
  });

  socket.on("reconnect_user", async ({ username }) => {
    if (!username) {
      socket.emit("error", {
        message: "Username is required",
      });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: {
          username,
        },
      });

      if (!user) {
        socket.emit("error", {
          message: "User not found",
        });
        return;
      }

      users.set(socket.id, {
        id: user.id,
        username: user.username,
      });

      for (const [gameId, game] of games) {
        const isX = game.playerXId === user.id;
        const isO = game.playerOId === user.id;
        if (!isX && !isO) continue;

        const player: Player = isX ? "X" : "O";
        const opponentId = isX ? game.playerOId : game.playerXId;

        if (isX) {
          game.playerXSocketId = socket.id;
        } else {
          game.playerOSocketId = socket.id;
        }

        // The player is back: cancel the pending "game ended" timer, otherwise the
        // game is deleted 30s after a successful reconnect.
        if (game.disconnectedPlayerId === user.id) {
          if (game.disconnectTimeout) {
            clearTimeout(game.disconnectTimeout);
            game.disconnectTimeout = null;
          }
          game.disconnectedPlayerId = null;
        }

        socket.join(gameId);

        const opponent = await prisma.user.findUnique({
          where: { id: opponentId },
        });

        socket.emit("match_found", {
          gameId,
          opponent: opponent?.username,
          player,
        });

        io.to(gameId).emit("game_state", game.state);
        socket.to(gameId).emit("opponent_reconnected");

        return;
      }

      socket.emit("reconnect_complete");
    } catch (error) {
      console.error("Failed to reconnect user:", error);

      socket.emit("error", {
        message: "Failed to reconnect",
      });
    }
  });
  socket.on("set_username", async (username) => {
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      socket.emit("error", {
        message: "Username is required",
      });
      return;
    }

    try {
      let user = await prisma.user.findUnique({
        where: {
          username: trimmedUsername,
        },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            username: trimmedUsername,
          },
        });
      }
      users.set(socket.id, {
        id: user.id,
        username: user.username,
      });

      socket.emit("username_accepted", {
        username: user.username,
        userId: user.id,
        message: "Username accepted",
      });
      console.log("Username set:", trimmedUsername);
    } catch (error) {
      console.error("Failed to set username:", error);

      socket.emit("error", {
        message: "Something went wrong",
      });
    }
  });

  socket.on("find_match", () => {
    const user = users.get(socket.id);
    if (!user) {
      socket.emit("error", {
        message: "Please set your username first",
      });
      return;
    }

    if (waitingPlayers.includes(socket.id)) {
      socket.emit("error", {
        message: "You are already waiting for an opponent",
      });
      return;
    }

    if (waitingPlayers.length === 0) {
      waitingPlayers.push(socket.id);
      socket.emit("waiting_for_opponent");
      return;
    }

    const opponentId = waitingPlayers.shift();

    if (!opponentId) {
      return;
    }

    const opponent = users.get(opponentId);

    if (!opponent) {
      return;
    }

    const gameId = crypto.randomUUID();

    socket.join(gameId);
    const opponentSocket = io.sockets.sockets.get(opponentId);
    if (!opponentSocket) {
      return;
    }

    opponentSocket.join(gameId);

    const game: Game = createGame(opponent.id, opponentId, user.id, socket.id);
    games.set(gameId, game);

    socket.emit("match_found", {
      opponent: opponent.username,
      gameId,
      player: "O",
    });
    io.to(opponentId).emit("match_found", {
      gameId,
      opponent: user.username,
      player: "X",
    });
    io.to(gameId).emit("game_state", game.state);
  });

  socket.on("make_move", async ({ gameId, position }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit("error", {
        message: "Game not found",
      });
      return;
    }
    let player: Player;

    if (game.playerXSocketId === socket.id) {
      player = "X";
    } else if (socket.id === game.playerOSocketId) {
      player = "O";
    } else {
      socket.emit("error", {
        message: "You are not a player in this game",
      });
      return;
    }

    if (game.state.currentPlayer !== player) {
      socket.emit("error", {
        message: "It's not your turn",
      });
      return;
    }
    if (!Number.isInteger(position) || position < 0 || position > 8) {
      socket.emit("error", {
        message: "Invalid position",
      });
      return;
    }
    if (game.state.board[position] !== null) {
      socket.emit("error", {
        message: "Cell is already occupied",
      });
      return;
    }

    game.state = makeMove(game.state, position);
    if (game.state.gameOver) {
      let winnerId: string | null = null;

      if (game.state.winner === "X") {
        winnerId = game.playerXId;
      } else if (game.state.winner === "O") {
        winnerId = game.playerOId;
      }

      const result =
        game.state.winner === "X"
          ? "X_WON"
          : game.state.winner === "O"
            ? "O_WON"
            : "DRAW";

      await prisma.game.create({
        data: {
          playerXId: game.playerXId,
          playerOId: game.playerOId,

          winnerId,
          result,
          board: game.state.board,
          winningCombination: game.state.winningCombination,
        },
      });
    }
    io.to(gameId).emit("game_state", game.state);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    const index = waitingPlayers.indexOf(socket.id);

    if (index !== -1) {
      waitingPlayers.splice(index, 1);
    }

    const user = users.get(socket.id);

    users.delete(socket.id);

    if (!user) return;

    for (const [gameId, game] of games) {
      let disconnectedPlayerId: string | null = null;

      if (game.playerXSocketId === socket.id) {
        game.playerXSocketId = null;
        disconnectedPlayerId = game.playerXId;
      } else if (game.playerOSocketId === socket.id) {
        game.playerOSocketId = null;
        disconnectedPlayerId = game.playerOId;
      }

      if (!disconnectedPlayerId) continue;

      // A finished game has nothing to reconnect to; just drop it.
      if (game.state.gameOver) {
        games.delete(gameId);
        break;
      }

      game.disconnectedPlayerId = disconnectedPlayerId;

      // socket.to() excludes the leaving socket — io.to() would also notify the
      // player who just left that their "opponent" disconnected.
      socket.to(gameId).emit("opponent_disconnected", {
        message: "Opponent disconnected. Waiting for reconnection...",
      });

      game.disconnectTimeout = setTimeout(() => {
        if (!game.disconnectedPlayerId) return;

        io.to(gameId).emit("game_ended", {
          message: "Opponent did not reconnect. Game ended.",
        });

        games.delete(gameId);
      }, 30_000);

      break;
    }
  });
});

server.listen(8081, () => {
  console.log("Server is listening on port 8081");
});
