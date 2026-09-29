import { Router } from "express";
import { prisma } from "../../lib/prisma.js";

const router = Router();

router.get("/users/:userId", async (req, res) => {
  const { userId } = req.params;

  const games = await prisma.game.findMany({
    where: {
      OR: [{ playerXId: userId }, { playerOId: userId }],
    },
    include: {
      playerX: true,
      playerO: true,
      winner: true,
    },
    orderBy: {
      endedAt: "desc",
    },
  });
  res.status(200).json({
    games,
    message: "Games retrieved successfully",
  });
});

export default router;
