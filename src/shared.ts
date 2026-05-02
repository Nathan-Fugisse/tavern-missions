import OBR from "@owlbear-rodeo/sdk";
import type { TavernBoard, GuildMission, ClickChallenge } from "./types";

const METADATA_KEY = "com.tavern-missions/board";

export function getDefaultBoard(): TavernBoard {
  return {
    guildMissions: [],
    clickChallenges: [],
    tavernName: "Taverna do Aventureiro",
    tavernLevel: 1,
    totalCompleted: 0,
  };
}

export async function loadBoard(): Promise<TavernBoard> {
  const metadata = await OBR.room.getMetadata();
  const raw = metadata[METADATA_KEY];
  if (raw && typeof raw === "object") {
    return raw as unknown as TavernBoard;
  }
  return getDefaultBoard();
}

export async function saveBoard(board: TavernBoard): Promise<void> {
  await OBR.room.setMetadata({
    [METADATA_KEY]: board as unknown as Record<string, unknown>,
  });
}

export function createGuildMission(
  title: string,
  description: string
): GuildMission {
  return {
    id: crypto.randomUUID(),
    title,
    description,
    completed: false,
    completedBy: null,
    completedByName: null,
  };
}

export function createClickChallenge(
  title: string,
  description: string,
  targetClicks: number,
  timeLimit: number,
  createdBy: string
): ClickChallenge {
  return {
    id: crypto.randomUUID(),
    title,
    description,
    targetClicks,
    timeLimit,
    timeRemaining: timeLimit,
    status: "waiting",
    createdBy,
    playerClicks: {},
    winner: null,
    winnerName: null,
  };
}

export function onBoardChange(callback: (board: TavernBoard) => void): void {
  OBR.room.onMetadataChange((metadata) => {
    const raw = metadata[METADATA_KEY];
    if (raw && typeof raw === "object") {
      callback(raw as unknown as TavernBoard);
    }
  });
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function getProgressPercent(current: number, target: number): number {
  return Math.min(100, Math.round((current / target) * 100));
}

export async function sendNotification(message: string): Promise<void> {
  await OBR.notification.show(message);
}