import OBR from "@owlbear-rodeo/sdk";
import {
  loadBoard,
  saveBoard,
  createGuildMission,
  createClickChallenge,
  onBoardChange,
  formatTime,
  getProgressPercent,
} from "./shared";
import type { TavernBoard, ClickChallenge } from "./types";

let currentBoard: TavernBoard;
let timers: Record<string, ReturnType<typeof setInterval>> = {};

export async function renderGMPanel(container: HTMLElement): Promise<void> {
  currentBoard = await loadBoard();

  container.innerHTML = `
    <div class="guild-panel gm">
      <div class="guild-header">
        <div class="guild-icon">⚔️</div>
        <div class="guild-info">
          <h1 id="guild-name">${currentBoard.tavernName}</h1>
          <div class="guild-stats">
            <span class="badge">Nível ${currentBoard.tavernLevel}</span>
            <span class="badge success">${currentBoard.totalCompleted} completas</span>
            <span class="badge gm-badge">👑 Mestre</span>
          </div>
        </div>
      </div>

      <details class="config-section">
        <summary>⚙️ Configurar Taverna</summary>
        <div class="config-form">
          <label>Nome da Taverna</label>
          <input type="text" id="guild-name-input" value="${currentBoard.tavernName}" />
          <button id="save-guild-config" class="btn btn-secondary">💾 Salvar</button>
        </div>
      </details>

      <!-- ABA DE NAVEGAÇÃO -->
      <div class="tabs">
        <button class="tab active" id="tab-missions">📋 Missões</button>
        <button class="tab" id="tab-challenges">🎯 Desafios</button>
      </div>

      <!-- PAINEL DE MISSÕES -->
      <div id="missions-panel">
        <div class="create-mission-section">
          <h2>📋 Nova Missão da Guilda</h2>
          <div class="form-group">
            <label>Título</label>
            <input type="text" id="mission-title" placeholder="Ex: Encontrar o mapa antigo" />
          </div>
          <div class="form-group">
            <label>Descrição (opcional)</label>
            <textarea id="mission-desc" placeholder="Ex: Procurar na biblioteca..."></textarea>
          </div>
          <button id="create-mission" class="btn btn-primary">📋 Criar Missão</button>
        </div>
        <div class="missions-section">
          <h2>📋 Missões Ativas</h2>
          <div id="missions-list"></div>
        </div>
      </div>

      <!-- PAINEL DE DESAFIOS -->
      <div id="challenges-panel" style="display:none;">
        <div class="create-mission-section">
          <h2>🎯 Novo Desafio de Cliques</h2>
          <div class="form-group">
            <label>Título</label>
            <input type="text" id="challenge-title" placeholder="Ex: Destruir o portal" />
          </div>
          <div class="form-group">
            <label>Descrição (opcional)</label>
            <textarea id="challenge-desc" placeholder="Ex: Cada golpe conta..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>🎯 Meta de Cliques</label>
              <input type="number" id="challenge-clicks" min="1" value="30" />
            </div>
            <div class="form-group">
              <label>⏱️ Tempo (seg)</label>
              <input type="number" id="challenge-time" min="10" value="60" />
            </div>
          </div>
          <button id="create-challenge" class="btn btn-primary">🎯 Criar Desafio</button>
        </div>
        <div class="missions-section">
          <h2>🎯 Desafios</h2>
          <div id="challenges-list"></div>
        </div>
      </div>
    </div>
  `;

  // Tabs
  document.getElementById("tab-missions")?.addEventListener("click", () => switchTab("missions"));
  document.getElementById("tab-challenges")?.addEventListener("click", () => switchTab("challenges"));

  // Botões
  document.getElementById("create-mission")?.addEventListener("click", handleCreateMission);
  document.getElementById("create-challenge")?.addEventListener("click", handleCreateChallenge);
  document.getElementById("save-guild-config")?.addEventListener("click", handleSaveConfig);

  renderMissions();
  renderChallenges();

  onBoardChange((board) => {
    currentBoard = board;
    renderMissions();
    renderChallenges();
    updateHeader();
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

async function handleCreateMission(): Promise<void> {
  const title = (document.getElementById("mission-title") as HTMLInputElement).value.trim();
  const desc = (document.getElementById("mission-desc") as HTMLTextAreaElement).value.trim();
  if (!title) { alert("⚠️ Dê um título!"); return; }

  const mission = createGuildMission(title, desc);
  currentBoard.guildMissions.unshift(mission);
  await saveBoard(currentBoard);
  (document.getElementById("mission-title") as HTMLInputElement).value = "";
  (document.getElementById("mission-desc") as HTMLTextAreaElement).value = "";
  renderMissions();
}

async function handleCreateChallenge(): Promise<void> {
  const title = (document.getElementById("challenge-title") as HTMLInputElement).value.trim();
  const desc = (document.getElementById("challenge-desc") as HTMLTextAreaElement).value.trim();
  const clicks = parseInt((document.getElementById("challenge-clicks") as HTMLInputElement).value);
  const time = parseInt((document.getElementById("challenge-time") as HTMLInputElement).value);

  if (!title) { alert("⚠️ Dê um título!"); return; }
  if (isNaN(clicks) || clicks < 1) { alert("⚠️ Meta mínima: 1!"); return; }
  if (isNaN(time) || time < 10) { alert("⚠️ Tempo mínimo: 10s!"); return; }

  const playerId = await OBR.player.getId();
  const challenge = createClickChallenge(title, desc, clicks, time, playerId);
  currentBoard.clickChallenges.unshift(challenge);
  await saveBoard(currentBoard);

  (document.getElementById("challenge-title") as HTMLInputElement).value = "";
  (document.getElementById("challenge-desc") as HTMLTextAreaElement).value = "";
  renderChallenges();
}

async function handleSaveConfig(): Promise<void> {
  const name = (document.getElementById("guild-name-input") as HTMLInputElement).value.trim();
  if (!name) { alert("⚠️ Digite um nome!"); return; }
  currentBoard.tavernName = name;
  await saveBoard(currentBoard);
  updateHeader();
}

function updateHeader(): void {
  const nameEl = document.getElementById("guild-name");
  if (nameEl) nameEl.textContent = currentBoard.tavernName;
}

// ========== MISSÕES (CHECKLIST) ==========

function renderMissions(): void {
  const list = document.getElementById("missions-list");
  if (!list) return;

  if (currentBoard.guildMissions.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>📋 Nenhuma missão criada ainda.</p></div>`;
    return;
  }

  list.innerHTML = currentBoard.guildMissions.map((m) => `
    <div class="mission-card ${m.completed ? "completed" : ""}">
      <div class="mission-header">
        <div class="checkbox-area">
          <span class="checkbox ${m.completed ? "checked" : ""}">
            ${m.completed ? "✅" : "⬜"}
          </span>
          <h3 class="${m.completed ? "line-through" : ""}">${m.title}</h3>
        </div>
        <button class="btn btn-danger btn-sm" onclick="window.deleteGuildMission('${m.id}')">🗑️</button>
      </div>
      ${m.description ? `<p class="mission-desc">${m.description}</p>` : ""}
      ${m.completed ? `<p class="completed-by">✅ Completada por: <strong>${m.completedByName}</strong></p>` : ""}
    </div>
  `).join("");
}

// ========== DESAFIOS DE CLIQUES ==========

function renderChallenges(): void {
  const list = document.getElementById("challenges-list");
  if (!list) return;

  if (currentBoard.clickChallenges.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>🎯 Nenhum desafio criado ainda.</p></div>`;
    return;
  }

  list.innerHTML = currentBoard.clickChallenges.map((c) => {
    const statusLabel: Record<ClickChallenge["status"], string> = {
      waiting: "⏳ Aguardando",
      active: "🔥 Em andamento",
      completed: "✅ Completo",
      failed: "❌ Tempo esgotado",
    };

    const playersList = Object.entries(c.playerClicks)
      .sort(([, a], [, b]) => b.clicks - a.clicks)
      .map(([, p]) => {
        const progress = getProgressPercent(p.clicks, c.targetClicks);
        return `
          <div class="player-row">
            <span>${p.completed ? "🏆" : "⚔️"} ${p.name}: ${p.clicks}/${c.targetClicks}</span>
            <div class="progress-bar small">
              <div class="progress-fill ${p.completed ? "completed-fill" : ""}" style="width:${progress}%"></div>
            </div>
          </div>
        `;
      }).join("");

    return `
      <div class="mission-card ${c.status}">
        <div class="mission-header">
          <h3>${c.title}</h3>
          <span class="status-badge ${c.status}">${statusLabel[c.status]}</span>
        </div>
        ${c.description ? `<p class="mission-desc">${c.description}</p>` : ""}
        <div class="progress-info">
          <span>🎯 Meta: ${c.targetClicks} cliques</span>
          <span>⏱️ ${formatTime(c.timeRemaining)}</span>
        </div>
        ${playersList ? `<div class="players-list">${playersList}</div>` : ""}
        ${c.winner ? `<p class="winner-msg">🏆 Vencedor: <strong>${c.winnerName}</strong></p>` : ""}
        <div class="mission-actions">
          ${c.status === "waiting" ? `<button class="btn btn-success btn-sm" onclick="window.startChallenge('${c.id}')">▶️ Iniciar</button>` : ""}
          ${c.status === "active" ? `<button class="btn btn-warning btn-sm" onclick="window.pauseChallenge('${c.id}')">⏸️ Pausar</button>` : ""}
          <button class="btn btn-danger btn-sm" onclick="window.deleteChallenge('${c.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

// ========== AÇÕES GLOBAIS ==========

(window as any).deleteGuildMission = async (id: string) => {
  if (!confirm("Remover essa missão?")) return;
  currentBoard.guildMissions = currentBoard.guildMissions.filter((m) => m.id !== id);
  await saveBoard(currentBoard);
  renderMissions();
};

(window as any).startChallenge = async (id: string) => {
  const challenge = currentBoard.clickChallenges.find((c) => c.id === id);
  if (!challenge) return;

  challenge.status = "active";
  challenge.timeRemaining = challenge.timeLimit;
  await saveBoard(currentBoard);
  renderChallenges();

  if (timers[id]) clearInterval(timers[id]);

  timers[id] = setInterval(async () => {
    const board = await loadBoard();
    const c = board.clickChallenges.find((x) => x.id === id);
    if (!c || c.status !== "active") { clearInterval(timers[id]); return; }

    c.timeRemaining--;

    if (c.winner) {
      c.status = "completed";
      board.totalCompleted++;
      board.tavernLevel = Math.floor(board.totalCompleted / 5) + 1;
      clearInterval(timers[id]);
      delete timers[id];
    } else if (c.timeRemaining <= 0) {
      c.timeRemaining = 0;
      c.status = "failed";
      clearInterval(timers[id]);
      delete timers[id];
    }

    currentBoard = board;
    await saveBoard(board);
    renderChallenges();
  }, 1000);
};

(window as any).pauseChallenge = async (id: string) => {
  const challenge = currentBoard.clickChallenges.find((c) => c.id === id);
  if (!challenge) return;
  challenge.status = "waiting";
  if (timers[id]) { clearInterval(timers[id]); delete timers[id]; }
  await saveBoard(currentBoard);
  renderChallenges();
};

(window as any).deleteChallenge = async (id: string) => {
  if (!confirm("Remover esse desafio?")) return;
  if (timers[id]) { clearInterval(timers[id]); delete timers[id]; }
  currentBoard.clickChallenges = currentBoard.clickChallenges.filter((c) => c.id !== id);
  await saveBoard(currentBoard);
  renderChallenges();
};