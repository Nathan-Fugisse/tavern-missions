import OBR from "@owlbear-rodeo/sdk";
const METADATA_KEY = "com.tavern-missions/board";
export function getDefaultBoard() {
    return {
        missions: [],
        guildName: "Taverna do Aventureiro",
        guildLevel: 1,
        totalCompleted: 0,
    };
}
export async function loadBoard() {
    const metadata = await OBR.room.getMetadata();
    const raw = metadata[METADATA_KEY];
    if (raw && typeof raw === "object") {
        return raw;
    }
    return getDefaultBoard();
}
export async function saveBoard(board) {
    await OBR.room.setMetadata({
        [METADATA_KEY]: board,
    });
}
export function createMission(title, description, targetClicks, timeLimit, createdBy) {
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
export function onBoardChange(callback) {
    OBR.room.onMetadataChange((metadata) => {
        const raw = metadata[METADATA_KEY];
        if (raw && typeof raw === "object") {
            callback(raw);
        }
    });
}
export function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
export function getProgressPercent(current, target) {
    return Math.min(100, Math.round((current / target) * 100));
}
