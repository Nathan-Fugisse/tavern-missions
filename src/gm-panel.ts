import OBR from "@owlbear-rodeo/sdk";
import {
  loadBoard,
  saveBoard,
  createMission,
  onBoardChange,
  formatTime,
  getProgressPercent,
} from "./shared";
import type { GuildBoard, Mission } from "./types";

let currentBoard: GuildBoard;
let timers: Record<string, ReturnType<typeof setInterval>> = {};

export async function renderGMPanel(container: HTMLElement): Promise<void> {
  currentBoard = await loadBoard();

  container.innerHTML = `
    <div class="guild-panel gm">
      <div class="guild-header">
        <div class="guild-icon">⚔️</div>
        <div class="guild-info">
          <h1 id="guild-name">${currentBoard.guildName}</h1>
          <div class="guild-stats">
            <span class="badge">Nível ${currentBoard.guildLevel}</span>
            <span class="badge success">${currentBoard.totalCompleted} completas</span>
            <span class="badge gm-badge">👑 Mestre</span>
          </div>
        </div>
      </div>

      <details class="config-section">
        <summary>⚙️ Configurar Taverna</summary>
        <div class="config-form">
          <label>Nome da Taverna</label>
          <input type="text" id="guild-name-input" value="${currentBoard.guildName}" />
          <button id="save-guild-config" class="btn btn-secondary">💾 Salvar Nome</button>
        </div>
      </details>

      <div class="create-mission-section">
        <h2>📜 Criar Nova Missão</h2>
        <div class="form-group">
          <label>Título da Missão</label>
          <input type="text" id="mission-title" placeholder="Ex: Derrotar o Dragão Vermelho" />
        </div>
        <div class="form-group">
          <label>Descrição (opcional)</label>
          <textarea id="mission-desc" placeholder="Ex: Os aventureiros devem unir forças..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>🎯 Meta de Cliques</label>
            <input type="number" id="mission-clicks" min="1" value="50" />
          </div>
          <div class="form-group">
            <label>⏱️ Tempo Limite (seg)</label>
            <input type="number" id="mission-time" min="10" value="60" />
          </div>
        </div>
        <button id="create-mission" class="btn btn-primary">⚔️ Criar Missão</button>
      </div>

      <div class="missions-section">
        <h2>📋 Missões</h2>
        <div id="missions-list"></div>
      </div>
    </div>
  `;

  document.getElementById("create-mission")?.addEventListener("click", handleCreateMission);
  document.getElementById("save-guild-config")?.addEventListener("click", handleSaveConfig);

  renderMissions();

  onBoardChange((board) => {
    currentBoard = board;
    renderMissions();
    updateHeader();
  });
}

async function handleCreateMission(): Promise<void> {
  const title = (document.getElementById("mission-title") as HTMLInputElement).value.trim();
  const desc = (document.getElementById("mission-desc") as HTMLTextAreaElement).value.trim();
  const clicks = parseInt((document.getElementById("mission-clicks") as HTMLInputElement).value);
  const time = parseInt((document.getElementById("mission-time") as HTMLInputElement).value);

  if (!title) { alert("⚠️ Dê um título à missão!"); return; }
  if (isNaN(clicks) || clicks < 1) { alert("⚠️ Meta mínima: 1 clique!"); return; }
  if (isNaN(time) || time < 10) { alert("⚠️ Tempo mínimo: 10 segundos!"); return; }

  const playerId = await OBR.player.getId();
  const mission = createMission(title, desc, clicks, time, playerId);

  currentBoard.missions.unshift(mission);
  await saveBoard(currentBoard);

  (document.getElementById("mission-title") as HTMLInputElement).value = "";
  (document.getElementById("mission-desc") as HTMLTextAreaElement).value = "";

  renderMissions();
}

async function handleSaveConfig(): Promise<void> {
  const name = (document.getElementById("guild-name-input") as HTMLInputElement).value.trim();
  if (!name) { alert("⚠️ Digite um nome!"); return; }
  currentBoard.guildName = name;
  await saveBoard(currentBoard);
  updateHeader();
  alert("✅ Nome salvo!");
}

function updateHeader(): void {
  const nameEl = document.getElementById("guild-name");
  if (nameEl) nameEl.textContent = currentBoard.guildName;
}

function renderMissions(): void {
  const list = document.getElementById("missions-list");
  if (!list) return;

  if (currentBoard.missions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>🏰 Nenhuma missão criada ainda.</p>
        <p>Use o formulário acima para criar a primeira!</p>
      </div>
    `;
    return;
  }

  list.innerHTML = currentBoard.missions.map((m) => {
    const progress = getProgressPercent(m.currentClicks, m.targetClicks);
    const statusLabel: Record<Mission["status"], string> = {
      waiting: "⏳ Aguardando",
      active: "🔥 Em andamento",
      completed: "✅ Completa",
      failed: "❌ Falhou",
    };

    const contributorsList = Object.entries(m.contributors)
      .sort(([, a], [, b]) => b - a)
      .map(([id, clicks]) => `<span class="contributor">${id.slice(0, 8)}: ${clicks}</span>`)
      .join("");

    return `
      <div class="mission-card ${m.status}">
        <div class="mission-header">
          <h3>${m.title}</h3>
          <span class="status-badge ${m.status}">${statusLabel[m.status]}</span>
        </div>
        ${m.description ? `<p class="mission-desc">${m.description}</p>` : ""}
        <div class="mission-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="progress-info">
            <span>🎯 ${m.currentClicks} / ${m.targetClicks} cliques</span>
            <span>⏱️ ${formatTime(m.timeRemaining)}</span>
          </div>
        </div>
        ${contributorsList ? `<div class="contributors">👥 ${contributorsList}</div>` : ""}
        <div class="mission-actions">
          ${m.status === "waiting" ? `<button class="btn btn-success btn-sm" onclick="window.startMission('${m.id}')">▶️ Iniciar</button>` : ""}
          ${m.status === "active" ? `<button class="btn btn-warning btn-sm" onclick="window.pauseMission('${m.id}')">⏸️ Pausar</button>` : ""}
          <button class="btn btn-danger btn-sm" onclick="window.deleteMission('${m.id}')">🗑️ Remover</button>
        </div>
      </div>
    `;
  }).join("");
}

(window as any).startMission = async (id: string) => {
  const mission = currentBoard.missions.find((m) => m.id === id);
  if (!mission) return;

  mission.status = "active";
  mission.timeRemaining = mission.timeLimit;
  await saveBoard(currentBoard);
  renderMissions();

  if (timers[id]) clearInterval(timers[id]);

  timers[id] = setInterval(async () => {
    const board = await loadBoard();
    const m = board.missions.find((x) => x.id === id);

    if (!m || m.status !== "active") {
      clearInterval(timers[id]);
      return;
    }

    m.timeRemaining--;

    if (m.currentClicks >= m.targetClicks) {
      m.status = "completed";
      board.totalCompleted++;
      board.guildLevel = Math.floor(board.totalCompleted / 5) + 1;
      clearInterval(timers[id]);
      delete timers[id];
    } else if (m.timeRemaining <= 0) {
      m.timeRemaining = 0;
      m.status = "failed";
      clearInterval(timers[id]);
      delete timers[id];
    }

    currentBoard = board;
    await saveBoard(board);
    renderMissions();
  }, 1000);
};

(window as any).pauseMission = async (id: string) => {
  const mission = currentBoard.missions.find((m) => m.id === id);
  if (!mission) return;
  mission.status = "waiting";
  if (timers[id]) { clearInterval(timers[id]); delete timers[id]; }
  await saveBoard(currentBoard);
  renderMissions();
};

(window as any).deleteMission = async (id: string) => {
  if (!confirm("Tem certeza que quer remover essa missão?")) return;
  if (timers[id]) { clearInterval(timers[id]); delete timers[id]; }
  currentBoard.missions = currentBoard.missions.filter((m) => m.id !== id);
  await saveBoard(currentBoard);
  renderMissions();
};