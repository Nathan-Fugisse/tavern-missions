import "./style.css";
import OBR from "@owlbear-rodeo/sdk";
const app = document.querySelector("#app");
OBR.onReady(async () => {
    const role = await OBR.player.getRole();
    if (role === "GM") {
        const module = await import("./gm-panel");
        module.renderGMPanel(app);
    }
    else {
        const module = await import("./player-panel");
        module.renderPlayerPanel(app);
    }
});
