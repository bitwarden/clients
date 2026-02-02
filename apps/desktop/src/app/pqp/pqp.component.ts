import { Component, AfterViewInit, ViewEncapsulation, OnDestroy, OnInit } from "@angular/core";
import {
  init as initPqp,
  sendMessage,
  RtcSessionStatus,
  getMessages,
  setMessages,
  clearBadge,
  isGoogleDriveLoggedIn,
  googleDriveLogin,
  manualRestoreFromDrive,
  loadPeerIndex,
  getOrchestrationState,
  PeerIndex,
  OrchestrationState,
  ServiceLocator,
  isLoggedIn,
  logout,
  getWebRtcManager,
  onWebRtcStatus,
  WebRtcManager,
} from "@ovrlab/pqp-network";

// Constants
const ONLINE_THRESHOLD_MS = 60000;

// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-pqp",
  standalone: true,
  templateUrl: "./pqp.component.html",
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow-y: auto;
        padding: 20px;
        box-sizing: border-box;
        font-family: sans-serif;
      }

      /* Wrap content to prevent it from getting too wide on large screens */
      .content-container {
        max-width: 800px;
        margin: 0 auto;
        text-align: center;
      }

      input,
      textarea,
      button {
        width: 100%;
        margin: 5px 0;
        padding: 8px;
        font-size: 14px;
        box-sizing: border-box;
      }

      textarea {
        resize: vertical;
      }

      .card {
        border: 1px solid #ccc;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        background: white;
        color: black;
        text-align: left; /* Reset text align for cards */
      }

      h3 {
        color: #175ddc;
        margin-top: 0;
        margin-bottom: 15px;
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
      }

      /* Peer List Styles */
      .peer-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.15s;
        color: black;
        border-bottom: 1px solid #f5f5f5;
      }

      .peer-row:hover {
        background-color: #f0f0f0;
      }

      .peer-self {
        background-color: #e3f2fd;
        border: 1px solid #2196f3;
      }

      .peer-slot {
        font-weight: bold;
        width: 40px;
      }

      .peer-id {
        flex: 1;
        text-align: left;
        margin-left: 10px;
        font-family: monospace;
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .peer-status {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        margin-left: 10px;
        border: 1px solid #ddd;
        background: #f0f0f0;
        flex-shrink: 0;
      }

      .peers-empty {
        color: #888;
        font-size: 14px;
        padding: 15px 0;
        text-align: center;
      }

      .peers-discovering {
        color: #1976d2;
        font-size: 14px;
        padding: 10px 0;
        text-align: center;
        animation: pulse 1.5s infinite;
      }

      .discovery-loader-container {
        width: 100%;
        height: 4px;
        background-color: #e0e0e0;
        border-radius: 2px;
        margin: 0 auto 15px auto;
        overflow: hidden;
      }

      .discovery-loader-bar {
        height: 100%;
        background-color: #1976d2;
        width: 0%;
        transition: width 0.3s linear;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      .message {
        background: #f8f9fa;
        padding: 10px 15px;
        border-radius: 6px;
        margin-bottom: 10px;
        font-size: 14px;
        text-align: left;
        border-left: 4px solid #175ddc;
        color: black;
      }

      /* Utility Classes */
      .status-success {
        color: #28a745;
        font-weight: 600;
      }
      .status-error {
        color: #dc3545;
        font-weight: 600;
      }
      .status-warning {
        color: #ffc107;
        font-weight: 600;
      }
      .status-info {
        color: #17aaec;
        font-weight: 600;
      }

      .flex-row {
        display: flex;
        gap: 10px;
      }
      .flex-1 {
        flex: 1;
      }
    `,
  ],
  encapsulation: ViewEncapsulation.None,
})
export class PqpComponent implements OnInit, AfterViewInit, OnDestroy {
  private peersInterval: any;
  private messagesInterval: any;
  private manager: WebRtcManager | null = null;

  async ngOnInit() {
    try {
      initPqp("electron", { context: "ui", enableWebRtc: true });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("PQP Init warning:", e);
    }
  }

  ngAfterViewInit() {
    this.initPopup();
  }

  ngOnDestroy() {
    if (this.peersInterval) {
      clearInterval(this.peersInterval);
    }
    if (this.messagesInterval) {
      clearInterval(this.messagesInterval);
    }
  }

  // --- Auth Status Logic ---
  updateStatus(text: string) {
    const statusEl = document.getElementById("auth_status");
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  async checkStatus() {
    try {
      const loggedIn = await isLoggedIn();
      this.updateStatus(loggedIn ? "Logged In" : "Logged Out");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Auth status check failed:", error);
      this.updateStatus("Error");
    }
  }

  // --- Peers List Logic ---
  async renderPeersList() {
    const container = document.getElementById("peersList");
    if (!container) {
      return;
    }

    // Load data
    const peerIndex = await loadPeerIndex();
    const orchestrationState = await getOrchestrationState();

    // Extract Tier-0 peers
    const tier0Peers = Object.values(peerIndex.peers || {})
      .filter((p) => p.tier?.tier === 0)
      .sort((a, b) => a.tier.position - b.tier.position);

    let html = "";

    // Status Banner
    if (orchestrationState) {
      const statusText = this.getOrchestrationStatusText(orchestrationState, peerIndex);
      const statusClass = this.getOrchestrationStatusClass(orchestrationState.status);
      html += `<div class="orchestration-status ${statusClass}">${statusText}</div>`;
    }

    // Discovering Indicator
    if (orchestrationState && orchestrationState.status === "JOINING_TIER0") {
      let progressHtml = "";
      if (orchestrationState.joinCompletionCheckTime) {
        const startTime =
          orchestrationState.joinStartTime || orchestrationState.joinCompletionCheckTime - 100000;
        const total = orchestrationState.joinCompletionCheckTime - startTime;
        const elapsed = Date.now() - startTime;
        const progress = Math.max(0, Math.min(100, (elapsed / total) * 100));
        progressHtml = `<div class="discovery-loader-container"><div class="discovery-loader-bar" style="width: ${progress}%"></div></div>`;
      }
      html += `<div class="peers-discovering">Discovering peers...</div>${progressHtml}`;
    }

    // List
    if (tier0Peers.length === 0) {
      if (orchestrationState?.status !== "JOINING_TIER0") {
        html += `<div class="peers-empty">No Tier-0 peers discovered yet.</div>`;
      }
    } else {
      tier0Peers.forEach((peer) => {
        const elapsed = Date.now() - peer.lastSeen;
        const isOnline = elapsed < ONLINE_THRESHOLD_MS;
        const remainingPercent = Math.max(
          0,
          Math.min(100, ((ONLINE_THRESHOLD_MS - elapsed) / ONLINE_THRESHOLD_MS) * 100),
        );
        const degrees = Math.floor((remainingPercent / 100) * 360);
        const timerStyle = isOnline
          ? `background: conic-gradient(#4caf50 ${degrees}deg, #f0f0f0 ${degrees}deg);`
          : `background: #9e9e9e; opacity: 0.5;`;

        const truncatedId = peer.queueId.substring(0, 12) + "...";
        const isSelf = peerIndex.self && peerIndex.self.queueId === peer.queueId;
        const selfLabel = isSelf ? " <strong>(You)</strong>" : "";
        const rowClass = isSelf ? "peer-row peer-self" : "peer-row";

        html += `
          <div class="${rowClass}" data-queue-id="${peer.queueId}">
            <span class="peer-slot">p${peer.tier.position}</span>
            <span class="peer-id">${truncatedId}${selfLabel}</span>
            <span class="peer-status" style="${timerStyle}" title="${Math.round(remainingPercent)}% freshness"></span>
          </div>
        `;
      });
    }

    container.innerHTML = html;
    this.setupPeerClickHandlers();
  }

  setupPeerClickHandlers() {
    const rows = document.querySelectorAll(".peer-row");
    const sendQueueInput = document.getElementById("sendQueueId") as HTMLInputElement;
    const messageBody = document.getElementById("messageBody") as HTMLTextAreaElement;

    rows.forEach((row) => {
      row.addEventListener("click", () => {
        const queueId = row.getAttribute("data-queue-id");
        if (queueId && sendQueueInput) {
          sendQueueInput.value = queueId;
          messageBody?.focus();
        }
      });
    });
  }

  getOrchestrationStatusText(state: OrchestrationState, peerIndex: PeerIndex): string {
    switch (state.status) {
      case "LOGGED_OUT":
        return "Not logged in";
      case "LOGGED_IN":
        return "Logged in";
      case "BOOTSTRAPPING":
        return "Bootstrapping assets...";
      case "JOINING_TIER0":
        return "Joining tier-0...";
      case "JOINED_TIER0":
        return peerIndex.self?.tier?.position !== undefined
          ? `Joined as p${peerIndex.self.tier.position}`
          : "Joined";
      case "ERROR":
        return `Error: ${state.lastError || "Unknown"}`;
      default:
        return "Unknown state";
    }
  }

  getOrchestrationStatusClass(status: string): string {
    switch (status) {
      case "JOINED_TIER0":
        return "status-success";
      case "ERROR":
        return "status-error";
      case "LOGGED_OUT":
        return "status-warning";
      default:
        return "status-info";
    }
  }

  // --- UI Actions Logic (Merged) ---
  async updateMessages() {
    const messages = await getMessages();
    const container = document.getElementById("messagesContainer");
    if (container) {
      container.innerHTML = "";
    }
    messages.forEach((msg) => {
      this.displayMessage(msg.content, msg.replyTo);
      msg.read = true;
    });
    await setMessages(messages);
    await clearBadge();
  }

  displayMessage(content: string, replyTo: string) {
    const container = document.getElementById("messagesContainer");
    if (!container) {
      return;
    }
    const div = document.createElement("div");
    div.className = "message";
    div.innerHTML = `<strong>From: ${replyTo}</strong><br>${content}`;
    container.prepend(div);
  }

  renderRtcStatus(nextSessions: Record<string, RtcSessionStatus>) {
    const statusEl = document.getElementById("webrtcStatus");
    const sendFileBtn = document.getElementById("webrtcSendFileBtn") as HTMLButtonElement | null;
    if (!statusEl) {
      return;
    }

    const entries = Object.values(nextSessions);
    if (entries.length === 0) {
      statusEl.innerHTML = "<em>No active P2P sessions.</em>";
      if (sendFileBtn) {
        sendFileBtn.disabled = true;
      }
      return;
    }

    const parts = entries.map((s) => {
      const lastFile =
        s.lastReceivedFile &&
        ` • File: ${s.lastReceivedFile.name} (${s.lastReceivedFile.size}b) ${s.lastReceivedFile.ok ? "✅" : "⚠️"}`;
      const err = s.lastError ? ` • Error: ${s.lastError}` : "";
      return `<div style="margin-bottom:6px;">
        <div><strong>${s.targetQueueId.slice(0, 12)}...</strong> (${s.role})</div>
        <div>ICE: ${s.iceConnectionState ?? "n/a"} | DC: ${s.dataChannelState ?? "n/a"}${lastFile ?? ""}${err}</div>
      </div>`;
    });

    statusEl.innerHTML = parts.join("");
    if (sendFileBtn) {
      sendFileBtn.disabled = !entries.some((s) => s.dataChannelState === "open");
    }
  }

  initPopup() {
    const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
    const webrtcTargetInput = document.getElementById("webrtcTargetQueue") as HTMLInputElement;
    const webrtcConnectBtn = document.getElementById("webrtcConnectBtn") as HTMLButtonElement;
    const webrtcSendFileBtn = document.getElementById("webrtcSendFileBtn") as HTMLButtonElement;

    // Trigger orchestrator in the MAIN process via IPC (not in renderer,
    // because renderer lacks auth token provider and API calls would 401 → force logout)
    const ipcRef = (globalThis as any).electron?.ipcRenderer;
    ipcRef?.send("extension-message", { type: "ORCHESTRATOR_TRIGGER" });

    // Render peers list on popup open
    void this.renderPeersList();

    // Refresh peers list every second
    this.peersInterval = setInterval(() => {
      void this.renderPeersList();
    }, 1000);

    // Messages — initial fetch + poll every 5 seconds (matches pqp-electron)
    void this.updateMessages();
    this.messagesInterval = setInterval(() => {
      void this.updateMessages();
    }, 5000);

    // Listen for WebRTC status updates globally
    onWebRtcStatus((status: Record<string, RtcSessionStatus>) => {
      this.renderRtcStatus(status);
    });

    // Initial auth state check
    void this.checkStatus();

    // Auth buttons
    const loginBtn = document.getElementById("loginBtn") as HTMLButtonElement;
    const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement;

    loginBtn?.addEventListener("click", async () => {
      const ipc = (globalThis as any).electron?.ipcRenderer;
      if (!ipc) {
        this.updateStatus("IPC unavailable");
        return;
      }
      this.updateStatus("Opening login...");
      try {
        const result = await ipc.invoke("OPEN_INTERNAL_LOGIN");
        if (result?.success) {
          this.updateStatus("Logged In");
          // Trigger orchestration in main process (not renderer - see comment above)
          ipc.send("extension-message", { type: "ORCHESTRATOR_TRIGGER" });
        } else {
          this.updateStatus("Login cancelled");
        }
      } catch {
        this.updateStatus("Login failed");
      }
      setTimeout(() => this.checkStatus(), 1000);
    });

    logoutBtn?.addEventListener("click", async () => {
      await logout();
      setTimeout(() => this.checkStatus(), 1000);
    });

    // Drive Backup
    const driveStatusEl = document.getElementById("driveStatus");
    const driveLoginBtn = document.getElementById("driveLoginBtn") as HTMLButtonElement;
    const driveRestoreBtn = document.getElementById("driveRestoreBtn") as HTMLButtonElement;

    const checkDriveStatus = async () => {
      try {
        const loggedIn = await isGoogleDriveLoggedIn();
        if (driveStatusEl) {
          driveStatusEl.textContent = loggedIn
            ? "✅ Connected to Google Drive"
            : "❌ Not connected";
          driveStatusEl.style.color = loggedIn ? "#4caf50" : "#666";
        }
        if (driveLoginBtn) {
          driveLoginBtn.textContent = loggedIn ? "Connected" : "Login to Drive";
          driveLoginBtn.disabled = loggedIn;
        }
        if (driveRestoreBtn) {
          driveRestoreBtn.disabled = !loggedIn;
        }
      } catch {
        if (driveStatusEl) {
          driveStatusEl.textContent = "Error checking status";
          driveStatusEl.style.color = "#f44336";
        }
      }
    };

    void checkDriveStatus();

    driveLoginBtn?.addEventListener("click", async () => {
      driveLoginBtn.disabled = true;
      driveLoginBtn.textContent = "Connecting...";
      try {
        const success = await googleDriveLogin();
        if (!success) {
          alert("Google Drive login cancelled or failed.");
        } else {
          alert("Google Drive login success!");
        }
      } catch (err) {
        alert("Google Drive login failed: " + err);
      }
      void checkDriveStatus();
    });

    driveRestoreBtn?.addEventListener("click", async () => {
      driveRestoreBtn.disabled = true;
      driveRestoreBtn.textContent = "Restoring...";
      try {
        const success = await manualRestoreFromDrive();
        if (success) {
          alert("Keys restored from Google Drive!");
        } else {
          alert("No keys found in Google Drive.");
        }
      } catch (err) {
        alert("Restore failed: " + err);
      }
      driveRestoreBtn.textContent = "Restore Keys";
      void checkDriveStatus();
    });

    // Send Btn
    sendBtn?.addEventListener("click", async () => {
      const sendQueueInput = document.getElementById("sendQueueId") as HTMLInputElement;
      const messageBodyInput = document.getElementById("messageBody") as HTMLTextAreaElement;
      const queueId = sendQueueInput.value.trim();
      const messageBody = messageBodyInput.value.trim();

      if (!queueId || !messageBody) {
        alert("Queue ID and message body required");
        return;
      }
      try {
        await sendMessage(messageBody, queueId);
        messageBodyInput.value = "";
        void this.updateMessages();
        alert("Message sent!");
      } catch (err) {
        alert("Failed to send: " + err);
      }
    });

    // WebRTC Btns
    webrtcConnectBtn?.addEventListener("click", async () => {
      const target = (webrtcTargetInput?.value || "").trim();
      if (!target) {
        alert("Queue ID required to start P2P.");
        return;
      }
      try {
        const manager = getWebRtcManager();
        if (!manager) {
          alert("WebRTC Manager not initialized yet. Please wait...");
          return;
        }
        await manager.ensureConnect(target);
        alert("P2P Connection Initiated via PqP.");
      } catch (err) {
        alert("Failed to start P2P: " + err);
      }
    });

    webrtcSendFileBtn?.addEventListener("click", async () => {
      const target = (webrtcTargetInput?.value || "").trim();
      if (!target) {
        alert("Queue ID required to send file.");
        return;
      }
      try {
        const manager = getWebRtcManager();
        if (!manager) {
          alert("WebRTC Manager not initialized yet. Please wait...");
          return;
        }
        await manager.handleSendHello(target);
        alert("Hello World sent!");
      } catch (err) {
        alert("Failed to send file: " + err);
      }
    });

    // Vault Test
    const vaultWriteBtn = document.getElementById("vaultWriteBtn") as HTMLButtonElement | null;
    const vaultReadBtn = document.getElementById("vaultReadBtn") as HTMLButtonElement | null;
    const vaultDeleteBtn = document.getElementById("vaultDeleteBtn") as HTMLButtonElement | null;
    const vaultStatus = document.getElementById("vaultStatus") as HTMLDivElement | null;
    const vaultInput = document.getElementById("vaultContent") as HTMLInputElement | null;
    const vaultListBtn = document.getElementById("vaultListBtn") as HTMLButtonElement | null;

    const getVaultFilename = async (): Promise<string> => {
      const queueId = await ServiceLocator.getSyncStorage().get<string>("listenQueue", "");
      return queueId || "file_test";
    };

    const updateVaultStatus = (msg: string, color: string = "black") => {
      if (vaultStatus) {
        vaultStatus.textContent = msg;
        vaultStatus.style.color = color;
      }
    };

    vaultWriteBtn?.addEventListener("click", async () => {
      const content = vaultInput?.value || "";
      if (!content) {
        alert("Enter some content to write");
        return;
      }
      try {
        const filename = await getVaultFilename();
        updateVaultStatus("Writing...", "#666");
        await ServiceLocator.getVault().writeFile(filename, content);
        updateVaultStatus(`Success: Wrote "${content}" to ${filename.slice(0, 12)}...`, "#4caf50");
      } catch (err: any) {
        updateVaultStatus("Error: " + err.message, "#f44336");
        // eslint-disable-next-line no-console
        console.error(err);
      }
    });

    vaultReadBtn?.addEventListener("click", async () => {
      try {
        const filename = await getVaultFilename();
        updateVaultStatus("Reading...", "#666");
        const blob = (await ServiceLocator.getVault().readFile(filename)) as Blob;
        // Convert Blob to text
        const text = await blob.text();
        updateVaultStatus(`Read Content: "${text}"`, "#2196f3");
      } catch (err: any) {
        if (err.name === "NotFoundError") {
          updateVaultStatus("File not found", "#ff9800");
        } else {
          updateVaultStatus("Error: " + err.message, "#f44336");
        }
        // eslint-disable-next-line no-console
        console.error(err);
      }
    });

    vaultDeleteBtn?.addEventListener("click", async () => {
      try {
        const filename = await getVaultFilename();
        updateVaultStatus("Deleting...", "#666");
        await ServiceLocator.getVault().deleteFile(filename);
        updateVaultStatus("Success: File deleted", "#9e9e9e");
      } catch (err: any) {
        updateVaultStatus("Error: " + err.message, "#f44336");
        // eslint-disable-next-line no-console
        console.error(err);
      }
    });

    vaultListBtn?.addEventListener("click", async () => {
      try {
        updateVaultStatus("Listing files...", "#666");
        const files = await ServiceLocator.getVault().listFiles();
        if (files.length === 0) {
          updateVaultStatus("Vault is empty", "#ff9800");
        } else {
          // Read content for each file and display
          const vault = ServiceLocator.getVault();
          const fileInfos: string[] = [];
          for (const filename of files) {
            try {
              const blob = (await vault.readFile(filename)) as Blob;
              const content = await blob.text();
              const shortName = filename.length > 12 ? filename.slice(0, 12) + "..." : filename;
              const shortContent = content.length > 20 ? content.slice(0, 20) + "..." : content;
              fileInfos.push(`${shortName}: "${shortContent}"`);
            } catch {
              fileInfos.push(`${filename}: (error reading)`);
            }
          }
          updateVaultStatus(fileInfos.join(" | "), "#2196f3");
        }
      } catch (err: any) {
        updateVaultStatus("Error: " + err.message, "#f44336");
        // eslint-disable-next-line no-console
        console.error(err);
      }
    });
  }
}
