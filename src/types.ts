export interface Mission {
  id: string;
  title: string;
  description: string;
  targetClicks: number;
  currentClicks: number;
  timeLimit: number;
  timeRemaining: number;
  status: "waiting" | "active" | "completed" | "failed";
  createdBy: string;
  contributors: Record<string, number>;
}

export interface GuildBoard {
  missions: Mission[];
  guildName: string;
  guildLevel: number;
  totalCompleted: number;
}