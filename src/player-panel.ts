import OBR from "@owlbear-rodeo/sdk";
import {
  loadBoard,
  saveBoard,
  onBoardChange,
  formatTime,
  getProgressPercent,
  sendNotification,
} from "./shared";
import type { TavernBoard } from "./types";

let currentBoard: TavernBoard;
let playerId: string;
let playerName: string;
let isClicking = false;

export async function renderPlayerPanel(container: HTMLElement): Promise<void> {
  currentBoard = await loadBoard();
  playerId = await OBR.player.getId();
  playerName = await OBR.player.getName();

  container.innerHTML = `
    <div class="guild-panel player">
      <div class="guild-header">
        <div class="guild-icon">🛡️</div>
        <div class="guild-info">
          <h1>${currentBoard.tavernName}</h1>
          <div class="guild-stats">
            <span class="badge">Nível ${currentBoard.tavernLevel}</span>
            <span class="badge player-badge">🧙 ${playerName}</span>
          </div>
        </div>
      </div>

      <!-- ABA DE NAVEGAÇÃO -->
      <div class="tabs">
        <button class="tab active" id="tab-missions">📋 Missões</button>
        <button class="tab" id="tab-challenges">🎯 Desafios</button>
      </div>

      <!-- PAINEL DE MISSÕES -->
      <div id="missions-panel">
        <div class="missions-section">
          <h2>📋 Missões da Guilda</h2>
          <div id="player-missions-list"></div>
        </div>
      </div>

      <!-- PAINEL DE DESAFIOS -->
      <div id="challenges-panel" style="display:none;">
        <div class="missions-section">
          <h2>🎯 Desafios de Cliques</h2>
          <div id="player-challenges-list"></div>
        </div>
      </div>

      <!-- ESTATÍSTICAS -->
      <div class="player-stats-section">
        <h2>📊 Suas Contribuições</h2>
        <div id="player-stats"></div>
      </div>
    </div>
  `;

  // Tabs
  document.getElementById("tab-missions")?.addEventListener("click", () => switchTab("missions"));
  document.getElementById("tab-challenges")?.addEventListener("click", () => switchTab("challenges"));

  renderPlayerMissions();
  renderPlayerChallenges();

  onBoardChange((board) => {
    currentBoard = board;
    renderPlayerMissions();
    renderPlayerChallenges();
  });
}

function switchTab(tab: string): void {
  const missionsPanel = document.getElementById("missions-panel");
  const challengesPanel = document.getElementById("challenges-panel");
  const tabMissions = document.getElementById("tab-missions");
  const tabChallenges = document.getElementById("tab-challenges");

  if (tab === "missions") {
    missionsPanel!.style.display = "block";
    challengesPanel!.style.display = "none";
    tabMissions!.classList.add("active");
    tabChallenges!.classList.remove("active");
  } else {
    missionsPanel!.style.display = "none";
    challengesPanel!.style.display = "block";
    tabMissions!.classList.remove("active");
    tabChallenges!.classList.add("active");
  }
}

// ========== MISSÕES (CHECKLIST) ==========

function renderPlayerMissions(): void {
  const list = document.getElementById("player-missions-list");
  if (!list) return;

  if (currentBoard.guildMissions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>📋 Nenhuma missão disponível.</p>
        <p>Aguarde o Mestre criar missões!</p>
      </div>
    `;
    updatePlayerStats();
    return;
  }

  list.innerHTML = currentBoard.guildMissions.map((m) => `
    <div class="mission-card ${m.completed ? "completed" : ""}">
      <div class="mission-header">
        <div class="checkbox-area" ${!m.completed ? `style="cursor:pointer" id="check-${m.id}"` : ""}>
          <span class="checkbox ${m.completed ? "checked" : ""}">
            ${m.completed ? "✅" : "⬜"}
          </span>
          <h3 class="${m.completed ? "line-through" : ""}">${m.title}</h3>
        </div>
      </div>
      ${m.description ? `<p class="mission-desc">${m.description}</p>` : ""}
      ${m.completed
        ? `<p class="completed-by">✅ Completada por: <strong>${m.completedByName}</strong></p>`
        : `<p class="mission-desc" style="color:var(--blue)">Clique no quadrado para completar</p>`
      }
    </div>
  `).join("");

  // Adicionar evento de clique nos checkboxes
  currentBoard.guildMissions
    .filter((m) => !m.completed)
    .forEach((m) => {
      const el = document.getElementById(`check-${m.id}`);
      if (el) el.addEventListener("click", () => handleCheckMission(m.id));
    });

  updatePlayerStats();
}

async function handleCheckMission(missionId: string): Promise<void> {
  const board = await loadBoard();
  const mission = board.guildMissions.find((m) => m.id === missionId);

  if (!mission || mission.completed) return;

  mission.completed = true;
  mission.completedBy = playerId;
  mission.completedByName = playerName;

  board.totalCompleted++;
  board.tavernLevel = Math.floor(board.totalCompleted / 5) + 1;

  currentBoard = board;
  await saveBoard(board);

  // Notificar todos
  await sendNotification(`📋 ${playerName} completou a missão: "${mission.title}"!`);

  renderPlayerMissions();
}

// ========== DESAFIOS DE CLIQUES ==========

function renderPlayerChallenges(): void {
  const list = document.getElementById("player-challenges-list");
  if (!list) return;

  if (currentBoard.clickChallenges.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>🎯 Nenhum desafio disponível.</p>
        <p>Aguarde o Mestre criar um desafio!</p>
      </div>
    `;
    return;
  }

  const activeChallenges = currentBoard.clickChallenges.filter((c) => c.status === "active");
  const waitingChallenges = currentBoard.clickChallenges.filter((c) => c.status === "waiting");
  const finishedChallenges = currentBoard.clickChallenges.filter(
    (c) => c.status === "completed" || c.status === "failed"
  );

  let html = "";

  // DESAFIOS ATIVOS
  if (activeChallenges.length > 0) {
    html += `<h3 class="section-divider">🔥 Ativos</h3>`;
    activeChallenges.forEach((c) => {
      const myProgress = c.playerClicks[playerId];
      const myClicks = myProgress ? myProgress.clicks : 0;
      const myCompleted = myProgress ? myProgress.completed : false;
      const progress = getProgressPercent(myClicks, c.targetClicks);

      // Ranking dos jogadores
      const ranking = Object.entries(c.playerClicks)
        .sort(([, a], [, b]) => b.clicks - a.clicks)
        .map(([, p], i) => `
          <div class="player-row">
            <span>${p.completed ? "🏆" : `${i + 1}.`} ${p.name}: ${p.clicks}/${c.targetClicks}</span>
            <div class="progress-bar small">
              <div class="progress-fill ${p.completed ? "completed-fill" : ""}" style="width:${getProgressPercent(p.clicks, c.targetClicks)}%"></div>
            </div>
          </div>
        `).join("");

      html += `
        <div class="mission-card active">
          <div class="mission-header">
            <h3>${c.title}</h3>
            <span class="status-badge active">🔥 ATIVO</span>
          </div>
          ${c.description ? `<p class="mission-desc">${c.description}</p>` : ""}

          <!-- SEU PROGRESSO -->
          <div class="my-contribution">
            <div style="width:100%">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>⚔️ Seus cliques: <strong>${myClicks} / ${c.targetClicks}</strong></span>
                <span class="${c.timeRemaining <= 10 ? "time-danger" : ""}">⏱️ ${formatTime(c.timeRemaining)}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill animated" style="width:${progress}%"></div>
              </div>
            </div>
          </div>

          ${myCompleted
            ? `<div class="winner-msg">🏆 Você já completou esse desafio!</div>`
            : `<button class="btn-click" id="click-${c.id}">⚔️ ATACAR! ⚔️</button>`
          }

          ${c.winner ? `<div class="winner-msg">🏆 Primeiro a completar: <strong>${c.winnerName}</strong></div>` : ""}

          <!-- RANKING -->
          ${ranking ? `
            <details class="ranking-section">
              <summary>👥 Ver ranking</summary>
              <div class="players-list">${ranking}</div>
            </details>
          ` : ""}
        </div>
      `;
    });
  }

  // DESAFIOS AGUARDANDO
  if (waitingChallenges.length > 0) {
    html += `<h3 class="section-divider">⏳ Aguardando</h3>`;
    waitingChallenges.forEach((c) => {
      html += `
        <div class="mission-card waiting">
          <div class="mission-header">
            <h3>${c.title}</h3>
            <span class="status-badge waiting">⏳ Aguardando</span>
          </div>
          ${c.description ? `<p class="mission-desc">${c.description}</p>` : ""}
          <div class="progress-info">
            <span>🎯 Meta: ${c.targetClicks} cliques</span>
            <span>⏱️ Tempo: ${formatTime(c.timeLimit)}</span>
          </div>
          <div class="waiting-message">🏰 Aguardando o Mestre iniciar...</div>
        </div>
      `;
    });
  }

  // HISTÓRICO
  if (finishedChallenges.length > 0) {
    html += `<h3 class="section-divider">📜 Histórico</h3>`;
    finishedChallenges.forEach((c) => {
      const myClicks = c.playerClicks[playerId]?.clicks || 0;
      html += `
        <div class="mission-card ${c.status}">
          <div class="mission-header">
            <h3>${c.title}</h3>
            <span class="status-badge ${c.status}">
              ${c.status === "completed" ? "✅ Completo" : "❌ Falhou"}
            </span>
          </div>
          ${c.winner ? `<div class="winner-msg">🏆 Vencedor: <strong>${c.winnerName}</strong></div>` : ""}
          <div class="progress-info" style="margin-top:8px">
            <span>Seus cliques: ${myClicks}</span>
            <span>Meta: ${c.targetClicks}</span>
          </div>
        </div>
      `;
    });
  }

  list.innerHTML = html;

  // Botões de clique
  activeChallenges.forEach((c) => {
    const myProgress = c.playerClicks[playerId];
    const myCompleted = myProgress ? myProgress.completed : false;
    if (!myCompleted) {
      const btn = document.getElementById(`click-${c.id}`);
      if (btn) btn.addEventListener("click", () => handleClick(c.id));
    }
  });
}

async function handleClick(challengeId: string): Promise<void> {
  if (isClicking) return;
  isClicking = true;

  try {
    // Feedback visual
    const btn = document.getElementById(`click-${challengeId}`);
    if (btn) {
      btn.classList.add("clicked");
      setTimeout(() => btn.classList.remove("clicked"), 150);
    }

    const board = await loadBoard();
    const challenge = board.clickChallenges.find((c) => c.id === challengeId);
    if (!challenge || challenge.status !== "active") return;

    // Criar progresso do jogador se não existir
    if (!challenge.playerClicks[playerId]) {
      challenge.playerClicks[playerId] = {
        name: playerName,
        clicks: 0,
        completed: false,
      };
    }

    const myProgress = challenge.playerClicks[playerId];

    // Se já completou, não faz nada
    if (myProgress.completed) return;

    // Adicionar clique
    myProgress.clicks++;

    // Verificar se atingiu a meta
    if (myProgress.clicks >= challenge.targetClicks) {
      myProgress.completed = true;

      // Se é o primeiro a completar
      if (!challenge.winner) {
        challenge.winner = playerId;
        challenge.winnerName = playerName;

        // Notificar todos!
        await sendNotification(
          `🏆 ${playerName} completou o desafio "${challenge.title}"! 🎉`
        );
      }
    }

    currentBoard = board;
    await saveBoard(board);
    renderPlayerChallenges();
  } finally {
    isClicking = false;
  }
}

// ESTATÍSTICAS
function updatePlayerStats(): void {
  const statsEl = document.getElementById("player-stats");
  if (!statsEl) return;

  let missionsCompleted = 0;
  let challengesWon = 0;
  let totalClicks = 0;

  currentBoard.guildMissions.forEach((m) => {
    if (m.completedBy === playerId) missionsCompleted++;
  });

  currentBoard.clickChallenges.forEach((c) => {
    const myProgress = c.playerClicks[playerId];
    if (myProgress) {
      totalClicks += myProgress.clicks;
      if (c.winner === playerId) challengesWon++;
    }
  });

  statsEl.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${missionsCompleted}</div>
        <div class="stat-label">Missões Completas</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${challengesWon}</div>
        <div class="stat-label">Desafios Vencidos</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalClicks}</div>
        <div class="stat-label">Total de Cliques</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${currentBoard.tavernLevel}</div>
        <div class="stat-label">Nível da Taverna</div>
      </div>
    </div>
  `;
}