// Missão da Guilda (checklist)
export interface GuildMission {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  completedBy: string | null;
  completedByName: string | null;
}

// Desafio de Cliques
export interface ClickChallenge {
  id: string;
  title: string;
  description: string;
  targetClicks: number;
  timeLimit: number;
  timeRemaining: number;
  status: "waiting" | "active" | "completed" | "failed";
  createdBy: string;
  // Cada jogador tem seu próprio contador
  playerClicks: Record<string, PlayerProgress>;
  // Quem completou primeiro
  winner: string | null;
  winnerName: string | null;
}

export interface PlayerProgress {
  name: string;
  clicks: number;
  completed: boolean;
}

// Quadro geral da Taverna
export interface TavernBoard {
  guildMissions: GuildMission[];
  clickChallenges: ClickChallenge[];
  tavernName: string;
  tavernLevel: number;
  totalCompleted: number;
}