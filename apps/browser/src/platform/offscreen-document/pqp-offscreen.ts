import { RtcSessionStatus, cryptoService, dnsClient, OpfsVault, sha256 } from '@ovrlab/pqp-network';

// Note: We DO NOT call init() here because offscreen document cannot access
// chrome.storage or other APIs that ServiceLocator relies on.
// Instead, we rely on injected keys and stateless services (cryptoService, dnsClient).

// Vault for storing received files
const vault = new OpfsVault();

// WebRTC constants (offscreen-specific)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
const DATA_CHANNEL_LABEL = 'pqp-data';
const HELLO_FILE_NAME = 'hello.txt';
const HELLO_FILE_CONTENT = 'Hello from PQP!';

type SessionRole = 'offerer' | 'answerer';

type Session = {
  targetQueueId: string;
  sessionId: string;
  role: SessionRole;
  pc: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  pendingCandidates: RTCIceCandidateInit[];
  pendingFile?: ArrayBuffer;
  pendingFilename?: string;
  peerPublicKey?: string;
};

// Local injected key
let localPrivateKey: CryptoKey | null = null;

const sessions = new Map<string, Session>();

function buildSessionId(): string {
  return crypto.randomUUID?.() || `pqp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emitStatus() {
  const snapshot: Record<string, RtcSessionStatus> = {};
  for (const session of sessions.values()) {
    snapshot[session.targetQueueId] = {
      targetQueueId: session.targetQueueId,
      sessionId: session.sessionId,
      role: session.role,
      iceConnectionState: session.pc.iceConnectionState,
      dataChannelState: session.dataChannel?.readyState,
      lastUpdated: Date.now(),
    };
  }
  chrome.runtime.sendMessage({ type: 'RTC_OFFSCREEN_STATUS', sessions: snapshot }).catch(() => {});
}

// Periodic status updates to ensure UI stays in sync
let statusUpdateInterval: any = null;

function startStatusUpdates() {
  if (statusUpdateInterval) return;
  statusUpdateInterval = setInterval(() => {
    if (sessions.size > 0) {
      emitStatus();
    } else {
      stopStatusUpdates();
    }
  }, 2000); // Update every 2 seconds
}

function stopStatusUpdates() {
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }
}

type RtcSignal =
  | { type: 'RTC_OFFER'; sessionId: string; sdp: RTCSessionDescriptionInit | null }
  | { type: 'RTC_ANSWER'; sessionId: string; sdp: RTCSessionDescriptionInit | null }
  | { type: 'RTC_ICE'; sessionId: string; candidate: RTCIceCandidateInit };

function emitSignal(targetQueueId: string, payload: RtcSignal) {
  chrome.runtime
    .sendMessage({
      type: 'RTC_OFFSCREEN_SIGNAL_OUT',
      signal: { ...payload, targetQueueId },
    })
    .catch(() => {});
}

async function getPeerKey(session: Session): Promise<string | null> {
  if (session.peerPublicKey) return session.peerPublicKey;

  try {
    // Attempt to use dnsClient from pqp-network, which uses fetch internally
    // and is stateless/safe for offscreen use.
    const key = await dnsClient.getTxtRecord(session.targetQueueId);
    if (key) {
      session.peerPublicKey = key;
      return key;
    }
  } catch (err) {
    console.error(`[WebRTC] Failed to fetch public key for ${session.targetQueueId}:`, err);
  }
  return null;
}

// Helper to encrypt and send
async function sendEncrypted(session: Session, data: string | ArrayBuffer): Promise<boolean> {
  if (!session.dataChannel || session.dataChannel.readyState !== 'open') return false;

  const peerKey = await getPeerKey(session);
  if (!peerKey) {
    console.error(`[WebRTC] Cannot send: missing public key for ${session.targetQueueId}`);
    return false;
  }

  try {
    let payload = '';
    if (typeof data !== 'string') {
      // Assume ArrayBuffer -> Base64
      const bytes = new Uint8Array(data);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      payload = btoa(binary);
    } else {
      payload = data;
    }

    // Encrypt
    const encrypted = await cryptoService.encrypt(peerKey, payload);
    session.dataChannel.send(encrypted);
    return true;
  } catch (err) {
    console.error(`[WebRTC] Encryption/Send failed:`, err);
    return false;
  }
}

// Unified helper to flush pending file if channel is ready (with hash)
async function flushPendingFile(session: Session) {
  if (
    !session.pendingFile ||
    !session.pendingFilename ||
    !session.dataChannel ||
    session.dataChannel.readyState !== 'open'
  )
    return;

  // Optimistically take the file to prevent race conditions
  const fileToSend = session.pendingFile;
  const filenameToSend = session.pendingFilename;
  session.pendingFile = undefined;
  session.pendingFilename = undefined;

  // Calculate hash of file content
  const fileHash = await sha256(fileToSend);

  const fileMsg = JSON.stringify({
    type: 'FILE',
    name: filenameToSend,
    size: fileToSend.byteLength,
    hash: fileHash,
  });

  const metaSent = await sendEncrypted(session, fileMsg);
  const fileSent = await sendEncrypted(session, fileToSend);

  if (metaSent && fileSent) {
    console.log(`[WebRTC] File "${filenameToSend}" sent successfully`);
  } else {
    // Put it back if failed
    console.warn(`[WebRTC] Failed to send file, queuing for retry.`);
    session.pendingFile = fileToSend;
    session.pendingFilename = filenameToSend;
  }
}

function attachDataChannelHandlers(session: Session, channel: RTCDataChannel) {
  // We use strings (Base64)
  channel.binaryType = 'arraybuffer';

  channel.onopen = async () => {
    console.log(
      `[WebRTC] Data channel opened for ${session.targetQueueId} (role: ${session.role})`,
    );
    emitStatus();
    await flushPendingFile(session);
  };

  // Check immediately in case it's already open
  if (channel.readyState === 'open') {
    void flushPendingFile(session);
  }

  channel.onclose = () => {
    console.log(`[WebRTC] Data channel closed for ${session.targetQueueId}`);
    emitStatus();
  };

  channel.onerror = (event) => {
    console.error(`[WebRTC] Data channel error for ${session.targetQueueId}:`, event);
    emitStatus();
  };

  // Track expected incoming file metadata per session
  let pendingIncomingFilename: string | null = null;
  let pendingIncomingHash: string | null = null;

  channel.onmessage = async (event) => {
    try {
      if (!localPrivateKey) {
        console.error('[WebRTC] Cannot decrypt: No local private key set via INIT_KEYS');
        return;
      }

      let encryptedData = '';
      if (typeof event.data === 'string') {
        encryptedData = event.data;
      } else {
        encryptedData = new TextDecoder().decode(event.data);
      }

      // Decrypt using INJECTED key
      const decrypted = await cryptoService.decrypt(encryptedData, localPrivateKey);

      // Protocol Check - is this file metadata?
      try {
        const json = JSON.parse(decrypted);
        if (json && json.type === 'FILE' && json.name) {
          console.log(`[WebRTC] Received file metadata from ${session.targetQueueId}:`, json);
          pendingIncomingFilename = json.name;
          pendingIncomingHash = json.hash || null;
          return; // Wait for the actual file content
        }
      } catch {
        /* Not JSON, continue to content handling */
      }

      // Content handling - this is the file data
      let fileContent: Uint8Array;
      try {
        // Assume Base64 encoded binary
        const decoded = atob(decrypted);
        fileContent = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
      } catch {
        // Fallback: treat as plain text
        fileContent = new TextEncoder().encode(decrypted);
      }

      // Determine filename
      const filename = pendingIncomingFilename || 'received_file';
      const expectedHash = pendingIncomingHash;
      pendingIncomingFilename = null; // Reset for next file
      pendingIncomingHash = null;

      // Verify hash if provided
      const buffer = fileContent.buffer.slice(
        fileContent.byteOffset,
        fileContent.byteOffset + fileContent.byteLength,
      ) as ArrayBuffer;

      let hashValid = true;
      if (expectedHash) {
        const actualHash = await sha256(buffer);
        hashValid = actualHash === expectedHash;
        if (hashValid) {
          console.log(`[WebRTC] File hash verified: ${actualHash.slice(0, 16)}...`);
        } else {
          console.error(
            `[WebRTC] Hash mismatch! Expected: ${expectedHash.slice(0, 16)}..., Got: ${actualHash.slice(0, 16)}...`,
          );
        }
      }

      // Write to vault only if hash is valid (or no hash provided)
      if (hashValid) {
        try {
          await vault.writeFile(filename, buffer);
          console.log(`[WebRTC] File "${filename}" written to vault (${fileContent.length} bytes)`);
        } catch (vaultErr) {
          console.error(`[WebRTC] Failed to write file to vault:`, vaultErr);
        }
      } else {
        console.error(`[WebRTC] File "${filename}" rejected due to hash mismatch`);
      }

      // Emit status update
      chrome.runtime
        .sendMessage({
          type: 'RTC_OFFSCREEN_STATUS',
          sessions: {
            [session.targetQueueId]: {
              targetQueueId: session.targetQueueId,
              sessionId: session.sessionId,
              role: session.role,
              iceConnectionState: session.pc.iceConnectionState,
              dataChannelState: session.dataChannel?.readyState,
              lastUpdated: Date.now(),
              lastReceivedFile: {
                name: filename,
                size: fileContent.length,
                ok: true,
                preview: new TextDecoder().decode(fileContent.slice(0, 100)),
              },
            },
          },
        })
        .catch(() => {});
    } catch (err) {
      console.error(`[WebRTC] Decryption error:`, err);
    }
  };
}

function createPeerConnection(session: Session): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 0,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      emitSignal(session.targetQueueId, {
        type: 'RTC_ICE',
        sessionId: session.sessionId,
        candidate: event.candidate.toJSON(),
      });
    } else {
      console.log(`[WebRTC] ICE gathering complete for ${session.targetQueueId}`);
      emitStatus();
    }
  };

  pc.onicegatheringstatechange = () => {
    console.log(
      `[WebRTC] ICE gathering state: ${pc.iceGatheringState} for ${session.targetQueueId}`,
    );
    emitStatus();
  };

  pc.oniceconnectionstatechange = () => {
    console.log(
      `[WebRTC] ICE connection state: ${pc.iceConnectionState} for ${session.targetQueueId}`,
    );
    emitStatus();

    if (pc.iceConnectionState === 'checking') {
      setTimeout(() => {
        if (pc.iceConnectionState === 'checking') {
          console.warn(`[WebRTC] ICE connection timeout for ${session.targetQueueId}`);
          emitStatus();
        }
      }, 30000);
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[WebRTC] Connection state: ${pc.connectionState} for ${session.targetQueueId}`);
    emitStatus();
  };

  pc.ondatachannel = (event) => {
    console.log(
      `[WebRTC] Data channel received via ondatachannel for ${session.targetQueueId} (role: ${session.role}), label: ${event.channel.label}`,
    );
    session.dataChannel = event.channel;

    attachDataChannelHandlers(session, event.channel);

    // We don't need to manually send here because attachDataChannelHandlers
    // checks readyState and sends pending file if open.
    // Redundant block removed.
  };

  return pc;
}

function closeSession(targetQueueId: string) {
  const session = sessions.get(targetQueueId);
  if (!session) return;

  try {
    session.dataChannel?.close();
    session.pc.close();
  } catch {
    /* ignore */
  }
  sessions.delete(targetQueueId);

  if (sessions.size === 0) {
    stopStatusUpdates();
  }

  emitStatus();
}

async function flushPendingCandidates(session: Session) {
  if (!session.pc.remoteDescription) return;
  while (session.pendingCandidates.length > 0) {
    const cand = session.pendingCandidates.shift();
    if (cand) {
      try {
        await session.pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        /* ignore */
      }
    }
  }
}

async function handleOffer(
  role: SessionRole,
  targetQueueId: string,
  sessionId?: string,
  sdp?: RTCSessionDescriptionInit | null,
) {
  closeSession(targetQueueId);

  const session: Session = {
    targetQueueId,
    sessionId: sessionId || buildSessionId(),
    role,
    pc: {} as RTCPeerConnection,
    pendingCandidates: [],
  };

  session.pc = createPeerConnection(session);
  sessions.set(targetQueueId, session);
  startStatusUpdates();

  if (role === 'offerer') {
    const channel = session.pc.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
    });
    session.dataChannel = channel;
    attachDataChannelHandlers(session, channel);

    const offer = await session.pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });

    const setDescPromise = session.pc.setLocalDescription(offer);
    await setDescPromise;

    console.log(`[WebRTC] Offer created for ${targetQueueId}, sending SDP immediately`);
    emitSignal(targetQueueId, {
      type: 'RTC_OFFER',
      sessionId: session.sessionId,
      sdp: session.pc.localDescription,
    });
  } else if (role === 'answerer' && sdp) {
    await session.pc.setRemoteDescription(new RTCSessionDescription(sdp));

    const answer = await session.pc.createAnswer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });

    const setDescPromise = session.pc.setLocalDescription(answer);
    await setDescPromise;

    console.log(`[WebRTC] Answer created for ${targetQueueId}, sending SDP immediately`);
    emitSignal(targetQueueId, {
      type: 'RTC_ANSWER',
      sessionId: session.sessionId,
      sdp: session.pc.localDescription,
    });

    await flushPendingCandidates(session);
  }

  emitStatus();
}

type IncomingSignalMessage = {
  type: 'RTC_OFFSCREEN_APPLY_SIGNAL' | 'RTC_APPLY_SIGNAL';
  signal?: (RtcSignal & { fromQueueId?: string }) | null;
  payload?: { signal?: (RtcSignal & { fromQueueId?: string }) | null };
};

async function handleApplySignal(message: IncomingSignalMessage) {
  const signal = message.signal || message.payload?.signal;

  if (!signal || !signal.fromQueueId) {
    console.warn(
      '[WebRTC] handleApplySignal: Dropped message - missing signal or fromQueueId',
      message,
    );
    return;
  }

  switch (signal.type) {
    case 'RTC_OFFER':
      await handleOffer('answerer', signal.fromQueueId, signal.sessionId, signal.sdp);
      break;

    case 'RTC_ANSWER': {
      const session = sessions.get(signal.fromQueueId);
      if (session && signal.sdp) {
        await session.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await flushPendingCandidates(session);
        emitStatus();
      }
      break;
    }

    case 'RTC_ICE': {
      const session = sessions.get(signal.fromQueueId);
      if (!session || !signal.candidate) return;

      if (!session.pc.remoteDescription) {
        session.pendingCandidates.push(signal.candidate);
        console.log(
          `[WebRTC] Queued ICE candidate for ${signal.fromQueueId} (waiting for remote description)`,
        );
        return;
      }

      try {
        await session.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        console.log(`[WebRTC] Added ICE candidate for ${signal.fromQueueId}`);
      } catch (err) {
        console.warn(`[WebRTC] Failed to add ICE candidate for ${signal.fromQueueId}:`, err);
      }
      break;
    }
  }
}

async function handleSendHello(targetQueueId: string) {
  const session = sessions.get(targetQueueId);
  if (!session) {
    console.warn(`[WebRTC] No session found for ${targetQueueId}`);
    return;
  }

  const buffer = new TextEncoder().encode(HELLO_FILE_CONTENT).buffer;

  // Always queue first, then try to flush
  session.pendingFile = buffer;
  session.pendingFilename = HELLO_FILE_NAME;

  if (session.dataChannel) {
    if (session.dataChannel.readyState === 'open') {
      console.log(`[WebRTC] Sending file from ${session.role} to ${targetQueueId}`);
      await flushPendingFile(session);
    } else {
      console.log(
        `[WebRTC] Data channel not open yet (state: ${session.dataChannel.readyState}), queuing file`,
      );
    }
  } else {
    console.warn(
      `[WebRTC] No data channel available for ${targetQueueId} (role: ${session.role}), queuing file`,
    );

    if (session.role === 'answerer') {
      console.log(`[WebRTC] Waiting for data channel to arrive via ondatachannel event`);
    }
  }
}

async function handleSendFile(targetQueueId: string, filename: string, fileBytes: number[]) {
  const session = sessions.get(targetQueueId);
  if (!session) {
    console.warn(`[WebRTC] No session found for ${targetQueueId}`);
    return;
  }

  // Reconstruct ArrayBuffer from byte array
  const fileBuffer = new Uint8Array(fileBytes).buffer;

  // Store pending file info
  session.pendingFile = fileBuffer;
  session.pendingFilename = filename;

  if (session.dataChannel && session.dataChannel.readyState === 'open') {
    console.log(`[WebRTC] Sending file "${filename}" to ${targetQueueId}`);
    await flushPendingFile(session);
  } else {
    console.log(`[WebRTC] Data channel not open, queuing file "${filename}"`);
  }
}

export function initPqpOffscreen() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
        if (!message || typeof message.type !== 'string') return;

        if (message.type === 'RTC_OFFSCREEN_CMD') {
        const { cmd, targetQueueId } = message;

        if (cmd === 'INIT_KEYS') {
            const { privateKey } = message; // Base64
            if (privateKey) {
            try {
                localPrivateKey = await cryptoService.importPrivateKey(privateKey);
                console.log('[WebRTC] Local keys initialized in offscreen document.');
            } catch (e) {
                console.error('[WebRTC] Failed to import injected key', e);
            }
            }
            sendResponse?.({ ok: true });
            return;
        }

        if (!targetQueueId) return;

        switch (cmd) {
            case 'CONNECT':
            await handleOffer('offerer', targetQueueId);
            sendResponse?.({ ok: true });
            break;

            case 'SEND_HELLO':
            await handleSendHello(targetQueueId);
            sendResponse?.({ ok: true });
            break;

            case 'SEND_FILE':
            await handleSendFile(targetQueueId, message.filename, message.fileBytes);
            sendResponse?.({ ok: true });
            break;

            case 'FLUSH_PENDING_FILES':
            // Retry logic driven by Orchestrator
            for (const session of sessions.values()) {
                if (session.pendingFile) {
                void flushPendingFile(session);
                }
            }
            sendResponse?.({ ok: true });
            break;

            case 'CLOSE':
            closeSession(targetQueueId);
            sendResponse?.({ ok: true });
            break;
        }
        }

        if (message.type === 'RTC_APPLY_SIGNAL' || message.type === 'RTC_OFFSCREEN_APPLY_SIGNAL') {
        await handleApplySignal(message);
        sendResponse?.({ ok: true });
        }
    })();

    return true;
    });
}
