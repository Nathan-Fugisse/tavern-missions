import OBR from "@owlbear-rodeo/sdk";
import { loadBoard, saveBoard, onBoardChange, formatTime, getProgressPercent, } from "./shared";
let currentBoard;
let playerId;
let playerName;
let isClicking = false;
export async function renderPlayerPanel(container) {
    currentBoard = await loadBoard();
    playerId = await OBR.player.getId();
    playerName = await OBR.player.getName();
    container.innerHTML = `
    <div class="guild-panel player">
      <div class="guild-header">
        <div class="guild-icon">🛡️</div>
        <div class="guild-info">
          <h1 id="player-guild-name">${currentBoard.guildName}</h1>
          <div class="guild-stats">
            <span class="badge">Nível ${currentBoard.guildLevel}</span>
            <span class="badge player-badge">🧙 ${playerName}</span>
          </div>
        </div>
      </div>
      <div class="missions-section">
        <h2>⚔️ Missões da Taverna</h2>
        <div id="player-missions-list"></div>
      </div>
      <div class="player-stats-section">
        <h2>📊 Suas Contribuições</h2>
        <div id="player-stats"></div>
      </div>
    </div>
  `;
    renderPlayerMissions();
    onBoardChange((board) => {
        currentBoard = board;
        renderPlayerMissions();
    });
}
function renderPlayerMissions() {
    const list = document.getElementById("player-missions-list");
    if (!list)
        return;
    const activeMissions = currentBoard.missions.filter((m) => m.status === "active");
    const waitingMissions = currentBoard.missions.filter((m) => m.status === "waiting");
    const finishedMissions = currentBoard.missions.filter((m) => m.status === "completed" || m.status === "failed");
    if (currentBoard.missions.length === 0) {
        list.innerHTML = `
      <div class="empty-state">
        <p>🏰 Nenhuma missão disponível.</p>
        <p>Aguarde o Mestre criar uma missão!</p>
      </div>
    `;
        updatePlayerStats();
        return;
    }
    let html = "";
    if (activeMissions.length > 0) {
        html += `<h3 class="section-divider">🔥 Missões Ativas</h3>`;
        activeMissions.forEach((m) => {
            const progress = getProgressPercent(m.currentClicks, m.targetClicks);
            const myClicks = m.contributors[playerId] || 0;
            const myPercent = m.currentClicks > 0 ? Math.round((myClicks / m.currentClicks) * 100) : 0;
            html += `
        <div class="mission-card active">
          <div class="mission-header">
            <h3>${m.title}</h3>
            <span class="status-badge active">🔥 ATIVA</span>
          </div>
          ${m.description ? `<p class="mission-desc">${m.description}</p>` : ""}
          <div class="mission-progress">
            <div class="progress-bar">
              <div class="progress-fill animated" style="width: ${progress}%"></div>
            </div>
            <div class="progress-info">
              <span>🎯 ${m.currentClicks} / ${m.targetClicks}</span>
              <span class="${m.timeRemaining <= 10 ? "time-danger" : ""}">⏱️ ${formatTime(m.timeRemaining)}</span>
            </div>
          </div>
          <div class="my-contribution">
            ⚔️ Seus cliques: <strong>${myClicks}</strong>
            ${myPercent > 0 ? `<span class="contribution-percent">(${myPercent}% do total)</span>` : ""}
          </div>
          <button class="btn-click" id="click-${m.id}">⚔️ ATACAR! ⚔️</button>
        </div>
      `;
        });
    }
    if (waitingMissions.length > 0) {
        html += `<h3 class="section-divider">⏳ Aguardando</h3>`;
        waitingMissions.forEach((m) => {
            html += `
        <div class="mission-card waiting">
          <div class="mission-header">
            <h3>${m.title}</h3>
            <span class="status-badge waiting">⏳ Aguardando</span>
          </div>
          ${m.description ? `<p class="mission-desc">${m.description}</p>` : ""}
          <div class="progress-info">
            <span>🎯 Meta: ${m.targetClicks} cliques</span>
            <span>⏱️ Tempo: ${formatTime(m.timeLimit)}</span>
          </div>
          <div class="waiting-message">🏰 Aguardando o Mestre iniciar...</div>
        </div>
      `;
        });
    }
    if (finishedMissions.length > 0) {
        html += `<h3 class="section-divider">📜 Histórico</h3>`;
        finishedMissions.forEach((m) => {
            const myClicks = m.contributors[playerId] || 0;
            html += `
        <div class="mission-card ${m.status}">
          <div class="mission-header">
            <h3>${m.title}</h3>
            <span class="status-badge ${m.status}">
              ${m.status === "completed" ? "✅ Completa" : "❌ Falhou"}
            </span>
          </div>
          <div class="progress-info" style="margin-top: 8px">
            <span>🎯 ${m.currentClicks} / ${m.targetClicks} cliques</span>
            ${myClicks > 0 ? `<span>Você: <strong>${myClicks}</strong></span>` : ""}
          </div>
        </div>
      `;
        });
    }
    list.innerHTML = html;
    activeMissions.forEach((m) => {
        const btn = document.getElementById(`click-${m.id}`);
        if (btn)
            btn.addEventListener("click", () => handleClick(m.id));
    });
    updatePlayerStats();
}
async function handleClick(missionId) {
    if (isClicking)
        return;
    isClicking = true;
    try {
        const btn = document.getElementById(`click-${missionId}`);
        if (btn) {
            btn.classList.add("clicked");
            setTimeout(() => btn.classList.remove("clicked"), 150);
        }
        const board = await loadBoard();
        const mission = board.missions.find((m) => m.id === missionId);
        if (!mission || mission.status !== "active")
            return;
        mission.currentClicks++;
        mission.contributors[playerId] = (mission.contributors[playerId] || 0) + 1;
        currentBoard = board;
        await saveBoard(board);
        renderPlayerMissions();
    }
    finally {
        isClicking = false;
    }
}
function updatePlayerStats() {
    const statsEl = document.getElementById("player-stats");
    if (!statsEl)
        return;
    let totalClicks = 0;
    let missionsParticipated = 0;
    let missionsWon = 0;
    currentBoard.missions.forEach((m) => {
        const myClicks = m.contributors[playerId] || 0;
        if (myClicks > 0) {
            totalClicks += myClicks;
            missionsParticipated++;
            if (m.status === "completed")
                missionsWon++;
        }
    });
    statsEl.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${totalClicks}</div>
        <div class="stat-label">Total de Cliques</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${missionsParticipated}</div>
        <div class="stat-label">Missões Jogadas</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${missionsWon}</div>
        <div class="stat-label">Vitórias</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${currentBoard.guildLevel}</div>
        <div class="stat-label">Nível da Taverna</div>
      </div>
    </div>
  `;
}
