import OBR from "@owlbear-rodeo/sdk";
import type { GuildBoard, Mission } from "./types";

const METADATA_KEY = "com.tavern-missions/board";

export function getDefaultBoard(): GuildBoard {
  return {
    missions: [],
    guildName: "Taverna do Aventureiro",
    guildLevel: 1,
    totalCompleted: 0,
  };
}

export async function loadBoard(): Promise<GuildBoard> {
  const metadata = await OBR.room.getMetadata();
  const raw = metadata[METADATA_KEY];
  if (raw && typeof raw === "object") {
    return raw as unknown as GuildBoard;
  }
  return getDefaultBoard();
}

export async function saveBoard(board: GuildBoard): Promise<void> {
  await OBR.room.setMetadata({
    [METADATA_KEY]: board as unknown as Record<string, unknown>,
  });
}

export function createMission(
  title: string,
  description: string,
  targetClicks: number,
  timeLimit: number,
  createdBy: string
): Mission {
  return {
    id: crypto.randomUUID(),
    title,
    description,
    targetClicks,
    currentClicks: 0,
    timeLimit,
    timeRemaining: timeLimit,
    status: "waiting",
    createdBy,
    contributors: {},
  };
}

export function onBoardChange(callback: (board: GuildBoard) => void): void {
  OBR.room.onMetadataChange((metadata) => {
    const raw = metadata[METADATA_KEY];
    if (raw && typeof raw === "object") {
      callback(raw as unknown as GuildBoard);
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