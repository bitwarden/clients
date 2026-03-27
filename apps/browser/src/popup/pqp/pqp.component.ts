import {
  Component,
  AfterViewInit,
  ViewEncapsulation,
  OnDestroy,
  ChangeDetectionStrategy,
} from "@angular/core";
import {
  sendMessage,
  ParsedMessage,
  RtcSessionStatus,
  getMessages,
  setMessages,
  clearBadge,
  loadPeerIndex,
  getOrchestrationState,
  PeerIndex,
  OrchestrationState,
  ServiceLocator,
} from "@ovrlab/pqp-network";

// Constants
const ONLINE_THRESHOLD_MS = 60000;

@Component({
  selector: "app-pqp",
  templateUrl: "./pqp.component.html",
  standalone: false,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    "app-pqp { display: block; padding: 15px; background-color: #f8f9fa; min-height: 100%; color: #333; font-family: 'Open Sans', sans-serif; }",
    "app-pqp h3 { margin-top: 0; margin-bottom: 12px; font-size: 16px; color: #175ddc; font-weight: 600; text-align: left; }",
    "app-pqp .card { background: #ffffff; border: 1px solid #e0e0e0; padding: 15px; border-radius: 8px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }",
    "app-pqp input, app-pqp textarea { width: 100%; box-sizing: border-box; margin-bottom: 10px; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; transition: border-color 0.15s; }",
    "app-pqp input:focus, app-pqp textarea:focus { border-color: #175ddc; outline: none; }",
    "app-pqp button { width: 100%; padding: 8px 16px; background-color: #175ddc; color: white; border: none; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color 0.15s; margin-bottom: 5px; }",
    "app-pqp button:hover { background-color: #1550bd; }",
    "app-pqp button:disabled { background-color: #a0c0f0; cursor: not-allowed; }",
    "app-pqp .peer-row { display: flex; align-items: center; justify-content: space-between; padding: 10px; border-radius: 6px; cursor: pointer; transition: background-color 0.15s; border: 1px solid transparent; margin-bottom: 4px; }",
    "app-pqp .peer-row:hover { background-color: #f1f3f5; }",
    "app-pqp .peer-self { background-color: #e8f0fe; border-color: #d2e3fc; }",
    "app-pqp .peer-slot { font-weight: 700; color: #555; width: auto; min-width: 30px; font-size: 12px; margin-right: 8px; }",
    "app-pqp .peer-id { flex: 1; text-align: left; font-family: 'Roboto Mono', monospace; font-size: 13px; color: #333; }",
    "app-pqp .peer-status { width: 10px; height: 10px; border-radius: 50%; margin-left: 10px; background: #e9ecef; flex-shrink: 0; }",
    "app-pqp .peers-empty { color: #6c757d; font-size: 14px; padding: 15px 0; font-style: italic; }",
    "app-pqp .peers-discovering { color: #175ddc; font-size: 14px; padding: 10px 0; font-weight: 500; display: flex; flex-direction: column; align-items: center; }",
    "app-pqp .discovery-loader-container { width: 100%; height: 4px; background-color: #e9ecef; border-radius: 2px; margin-top: 8px; overflow: hidden; }",
    "app-pqp .discovery-loader-bar { height: 100%; background-color: #175ddc; width: 0%; transition: width 0.3s linear; }",
    "app-pqp .message { background: #f1f3f5; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; font-size: 13px; text-align: left; border-left: 3px solid #175ddc; }",
    "app-pqp .status-success { color: #28a745; font-weight: 600; }",
    "app-pqp .status-error { color: #dc3545; font-weight: 600; }",
    "app-pqp .status-warning { color: #ffc107; font-weight: 600; }",
    "app-pqp .status-info { color: #17aaec; font-weight: 600; }",
  ],
})
export class PqpComponent implements AfterViewInit, OnDestroy {
  private peersInterval: any;

  ngAfterViewInit() {
    this.initPopup();
  }

  ngOnDestroy() {
    if (this.peersInterval) {
      clearInterval(this.peersInterval);
    }
  }

  // --- Auth Status Logic ---
  private updateButtonStates(loggedIn: boolean) {
    const googleLoginBtn = document.getElementById("googleLoginBtn") as HTMLButtonElement | null;
    const microsoftLoginBtn = document.getElementById(
      "microsoftLoginBtn",
    ) as HTMLButtonElement | null;
    const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement | null;

    if (googleLoginBtn) {
      googleLoginBtn.disabled = loggedIn;
      googleLoginBtn.textContent = loggedIn ? "Signed In" : "Sign in with Google";
    }
    if (microsoftLoginBtn) {
      microsoftLoginBtn.disabled = loggedIn;
      microsoftLoginBtn.textContent = loggedIn ? "Signed In" : "Sign in with Microsoft";
    }
    if (logoutBtn) {
      logoutBtn.disabled = !loggedIn;
    }
  }

  updateStatus(text: string, loggedIn?: boolean) {
    const statusEl = document.getElementById("auth_status");
    if (statusEl) {
      statusEl.textContent = text;
      if (loggedIn !== undefined) {
        statusEl.style.color = loggedIn ? "#4caf50" : "#f44336";
      }
    }
    if (loggedIn !== undefined) {
      this.updateButtonStates(loggedIn);
    }
  }

  async checkStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "CHECK_STATUS" });
      if (response?.success) {
        this.updateStatus(response.loggedIn ? "Logged In" : "Logged Out", response.loggedIn);
      } else {
        this.updateStatus("Error");
      }
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

    // Sort peers by Tier structure (tier asc, then path)
    const sortedPeers = Object.values(peerIndex.peers).sort((a, b) => {
      if (a.tier.tier !== b.tier.tier) {
        return a.tier.tier - b.tier.tier;
      }
      // Compare paths
      return (a.tier.path || []).join(".").localeCompare((b.tier.path || []).join("."));
    });

    let html = "";

    // Status Banner
    if (orchestrationState) {
      const statusText = this.getOrchestrationStatusText(orchestrationState, peerIndex);
      const statusClass = this.getOrchestrationStatusClass(orchestrationState.status);
      html += `<div class="orchestration-status ${statusClass}">${statusText}</div>`;
    }

    // Discovering Indicator
    if (orchestrationState && orchestrationState.status === "JOINING") {
      let progressHtml = "";
      if (orchestrationState.joinCompletionCheckTime) {
        const startTime =
          orchestrationState.joinStartTime || orchestrationState.joinCompletionCheckTime - 100000;
        const total = orchestrationState.joinCompletionCheckTime - startTime;
        const elapsed = Date.now() - startTime;
        const progress = Math.max(0, Math.min(100, (elapsed / total) * 100));
        progressHtml = `<div class="discovery-loader-container"><div class="discovery-loader-bar" style="width: ${progress}%"></div></div>`;
      }
      html += `<div class="peers-discovering">Joining Network...</div>${progressHtml}`;
    }

    // List
    if (sortedPeers.length === 0) {
      if (orchestrationState?.status !== "JOINING") {
        html += `<div class="peers-empty">No peers discovered yet.</div>`;
      }
    } else {
      sortedPeers.forEach((peer) => {
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

        const truncatedId = peer.queueId.substring(0, 8) + "...";
        const isSelf = peerIndex.self && peerIndex.self.queueId === peer.queueId;
        const selfLabel = isSelf ? " <strong>(You)</strong>" : "";
        const rowClass = isSelf ? "peer-row peer-self" : "peer-row";

        // Display path like "192.168..."
        const pathStr = peer.tier.path ? peer.tier.path.slice().reverse().join(".") : "???";
        const tierBadge = `<span style="font-size:10px; background:#ddd; padding:1px 4px; border-radius:3px;">T${peer.tier.tier}</span>`;

        html += `
          <div class="${rowClass}" data-queue-id="${peer.queueId}">
            <span class="peer-slot" title="Path: ${pathStr}">${tierBadge} ${pathStr}</span>
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
      case "JOINING":
        return "Joining network...";
      case "JOINED": {
        const selfPath = peerIndex.self?.tier?.path
          ? peerIndex.self.tier.path.slice().reverse().join(".")
          : "Unknown";
        return `Joined: ${selfPath}`;
      }
      case "ERROR":
        return `Error: ${state.lastError || "Unknown"}`;
      default:
        return "Unknown state";
    }
  }

  getOrchestrationStatusClass(status: string): string {
    switch (status) {
      case "JOINED":
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

    // Trigger orchestrator via event
    void chrome.runtime.sendMessage({ type: "ORCHESTRATOR_TRIGGER" });

    // Render peers list on popup open
    void this.renderPeersList();

    // Refresh peers list every second
    this.peersInterval = setInterval(() => {
      void this.renderPeersList();
    }, 1000);

    // Messages
    void (async () => {
      const messages = await getMessages();
      messages.forEach((msg) => {
        this.displayMessage(msg.content, msg.replyTo);
        msg.read = true;
      });
      await setMessages(messages);
      await clearBadge();
    })();

    // Listen for incremental updates
    // eslint-disable-next-line no-restricted-syntax
    chrome.runtime.onMessage.addListener((msg) => {
      void (async () => {
        if (msg.type === "messages:updated") {
          const newMessages: ParsedMessage[] = msg.messages;
          const storedMessages = await getMessages();
          newMessages.forEach((m) => {
            this.displayMessage(m.content, m.replyTo);
            m.read = true;
          });
          const allMessages = [...newMessages, ...storedMessages];
          await setMessages(allMessages);
          await clearBadge();
        }
        if (msg.type === "rtc:status") {
          this.renderRtcStatus(msg.sessions ?? {});
        }
        if (msg.type === "peerIndex:updated" || msg.type === "orchestration:updated") {
          await this.renderPeersList();
        }
      })();
    });

    // Initial auth state check
    void this.checkStatus();

    // Auth buttons
    const googleLoginBtn = document.getElementById("googleLoginBtn") as HTMLButtonElement;
    const microsoftLoginBtn = document.getElementById("microsoftLoginBtn") as HTMLButtonElement;
    const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement;

    googleLoginBtn?.addEventListener("click", () => {
      void chrome.runtime.sendMessage({ type: "LOGIN" });
      this.updateStatus("Opening Google login...");
      setTimeout(() => void this.checkStatus(), 10000);
    });

    microsoftLoginBtn?.addEventListener("click", () => {
      void chrome.runtime.sendMessage({ type: "LOGIN_MICROSOFT" });
      this.updateStatus("Opening Microsoft login...");
      setTimeout(() => void this.checkStatus(), 10000);
    });

    logoutBtn?.addEventListener("click", () => {
      void chrome.runtime.sendMessage({ type: "LOGOUT" });
      setTimeout(() => void this.checkStatus(), 2000);
    });

    // RTC snapshot
    void (async () => {
      try {
        const resp = await chrome.runtime.sendMessage({ type: "RTC_GET_STATUS" });
        this.renderRtcStatus((resp && resp.sessions) || {});
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Failed to fetch RTC status", err);
      }
    })();

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
        const resp = await chrome.runtime.sendMessage({
          type: "RTC_CONNECT",
          targetQueueId: target,
        });
        if (resp?.ok) {
          alert("P2P signaling started via PqP.");
        } else {
          alert(resp?.error || "Failed to start P2P.");
        }
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
        const resp = await chrome.runtime.sendMessage({
          type: "RTC_SEND_HELLO",
          targetQueueId: target,
        });
        if (!resp?.ok) {
          alert(resp?.error || "Failed to send file");
        }
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

    // Key Rotation
    const rotateKeysBtn = document.getElementById("rotateKeysBtn") as HTMLButtonElement | null;
    const rotateKeysStatus = document.getElementById("rotateKeysStatus") as HTMLDivElement | null;

    rotateKeysBtn?.addEventListener("click", async () => {
      if (
        !confirm(
          "Are you sure you want to rotate your keys? In-flight messages encrypted with the old key will be lost.",
        )
      ) {
        return;
      }

      rotateKeysBtn.disabled = true;
      if (rotateKeysStatus) {
        rotateKeysStatus.textContent = "Rotating keys...";
        rotateKeysStatus.style.color = "#1976d2";
      }

      try {
        const resp = await chrome.runtime.sendMessage({ type: "ROTATE_KEYS" });
        if (resp?.success) {
          if (rotateKeysStatus) {
            rotateKeysStatus.textContent = "Keys rotated successfully!";
            rotateKeysStatus.style.color = "#4caf50";
          }
        } else {
          if (rotateKeysStatus) {
            rotateKeysStatus.textContent = "Error: " + (resp?.error || "Unknown error");
            rotateKeysStatus.style.color = "#f44336";
          }
        }
      } catch (err) {
        if (rotateKeysStatus) {
          rotateKeysStatus.textContent = "Error: " + err;
          rotateKeysStatus.style.color = "#f44336";
        }
      } finally {
        rotateKeysBtn.disabled = false;
      }
    });
  }
}
