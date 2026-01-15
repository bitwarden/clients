import {
  ServiceLocator,
  sendMessage,
  RtcSessionStatus,
  offscreenService,
} from '@ovrlab/pqp-network';

const RTC_STATUS_KEY = 'rtcSessions';
const RTC_MESSAGE_TYPES = ['RTC_OFFER', 'RTC_ANSWER', 'RTC_ICE'] as const;

let creatingOffscreen: Promise<void> | null = null;

async function offscreenExists(): Promise<boolean> {
  // @ts-ignore
  if (chrome.offscreen && chrome.offscreen.hasDocument) {
    try {
      // @ts-ignore
      return await chrome.offscreen.hasDocument();
    } catch {
      // Fall through to runtime.getContexts
    }
  }

  // @ts-ignore
  const contexts = await chrome.runtime.getContexts?.({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  return Boolean(contexts && contexts.length > 0);
}

function isAlreadyExistsError(err: unknown): boolean {
  const message =
    (err as { message?: string } | undefined)?.message ||
    chrome.runtime.lastError?.message ||
    String(err ?? '');
  return message.includes('Only a single offscreen document may be created');
}

// Ensure offscreen document exists for WebRTC operations
async function ensureOffscreenDocument() {
  if (await offscreenExists()) {
    // Ensure keys are injected even if document exists (e.g. key rotation)
    await offscreenService.injectKeys();
    return;
  }
  if (creatingOffscreen) return creatingOffscreen;

  creatingOffscreen = (async () => {
    try {
      // @ts-ignore
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('offscreen-document/index.html'), // Adjusted to likely Bitwarden name
        reasons: ['WEB_RTC'],

        justification: 'WebRTC P2P datachannel in DOM context',
      });
      // Important: Reset state because we have a fresh (empty) document
      offscreenService.reset();
      await offscreenService.injectKeys();
    } catch (err) {
      if (!isAlreadyExistsError(err)) {
        throw err;
      }
      // Even if it exists, ensure keys are injected (in case of re-attach)
      await offscreenService.injectKeys();
    } finally {
      creatingOffscreen = null;
    }
  })();

  return creatingOffscreen;
}

async function getSelfQueueId(): Promise<string> {
  const id = await ServiceLocator.getSyncStorage().get<string>('listenQueue', '');
  if (!id) throw new Error('listenQueue not set; join the network first.');
  return id.trim();
}

async function loadStatuses(): Promise<Record<string, RtcSessionStatus>> {
  return ServiceLocator.getLocalStorage().get<Record<string, RtcSessionStatus>>(RTC_STATUS_KEY, {});
}

async function persistSnapshot(sessions: Record<string, RtcSessionStatus>) {
  await ServiceLocator.getLocalStorage().set(RTC_STATUS_KEY, sessions);
  ServiceLocator.getMessaging().send('rtc:status', { sessions });
}

// Forward signals from PqP to offscreen document
type RtcSignal = {
  type: (typeof RTC_MESSAGE_TYPES)[number];
  sessionId?: string;
  sdp?: RTCSessionDescriptionInit | null;
  candidate?: RTCIceCandidateInit;
  targetQueueId?: string;
};

async function sendSignal(targetQueueId: string, payload: RtcSignal) {
  const body = JSON.stringify({
    ...payload,
    fromQueueId: await getSelfQueueId(),
  });

  console.log(`[WebRTC] Sending signal ${payload.type} to ${targetQueueId} via PqP`);
  await sendMessage(body, targetQueueId);

  // Trigger immediate poll to speed up signal exchange
  ServiceLocator.getMessaging().send('ORCHESTRATOR_TRIGGER');
}

// Wrap sendMessage so "receiving end does not exist" rejections are swallowed
async function sendToOffscreen(payload: Record<string, unknown>): Promise<boolean> {
  await ensureOffscreenDocument();
  try {
    await chrome.runtime.sendMessage(payload);
    return true;
  } catch (err) {
    const lastErr = chrome.runtime.lastError;
    console.warn('[WebRTC] Failed to reach offscreen document', lastErr?.message || err);
    return false;
  }
}

// Setup listener for messages from offscreen document
export function setupWebRtcListeners() {
  chrome.runtime.onMessage.addListener((message) => {
    (async () => {
      if (!message || typeof message.type !== 'string') return;

      if (message.type === 'RTC_OFFSCREEN_STATUS') {
        await persistSnapshot(message.sessions ?? {});
      }

      if (message.type === 'RTC_OFFSCREEN_SIGNAL_OUT') {
        const signal = message.signal;
        if (signal?.targetQueueId) {
          try {
            await sendSignal(signal.targetQueueId, signal);
            console.log(
              `[WebRTC] Signal ${signal.type} sent successfully to ${signal.targetQueueId}`,
            );
          } catch (err) {
            console.error(
              `[WebRTC] Failed to send signal ${signal.type} to ${signal.targetQueueId}:`,
              err,
            );
          }
        }
      }
    })();
    // Don't return true - we're not sending a response
  });
}

// Handle incoming RTC signals from PqP and forward to offscreen
// Only handles RTC-specific message types to avoid intercepting discovery messages
export async function handleRtcSignal(message: RtcSignal | null | undefined): Promise<boolean> {
  if (!message || typeof message.type !== 'string') return false;

  // @ts-ignore
  if (!RTC_MESSAGE_TYPES.includes(message.type)) {
    return false;
  }

  await ensureOffscreenDocument();
  return sendToOffscreen({ type: 'RTC_OFFSCREEN_APPLY_SIGNAL', signal: message });
}

// Handle popup commands
type WebRtcRequest =
  | { type: 'RTC_CONNECT'; targetQueueId: string }
  | { type: 'RTC_SEND_HELLO'; targetQueueId: string }
  | { type: 'RTC_SEND_FILE'; targetQueueId: string; filename: string; fileBytes: number[] }
  | { type: 'RTC_GET_STATUS' }
  | { type: 'RTC_CLOSE'; targetQueueId: string };

type WebRtcResponse =
  | { ok: true }
  | { sessions: Record<string, RtcSessionStatus> }
  | { error: string };

export async function handleWebRtcMessage(
  message: WebRtcRequest,
  sendResponse?: (resp: WebRtcResponse) => void,
): Promise<boolean> {
  await ensureOffscreenDocument();

  switch (message.type) {
    case 'RTC_CONNECT': {
      const connectOk = await sendToOffscreen({
        type: 'RTC_OFFSCREEN_CMD',
        cmd: 'CONNECT',
        targetQueueId: message.targetQueueId,
      });
      // @ts-ignore
      sendResponse?.(connectOk ? { ok: true } : { error: 'Failed to reach offscreen document.' });
      return true;
    }

    case 'RTC_SEND_HELLO': {
      const helloOk = await sendToOffscreen({
        type: 'RTC_OFFSCREEN_CMD',
        cmd: 'SEND_HELLO',
        targetQueueId: message.targetQueueId,
      });
      // @ts-ignore
      sendResponse?.(helloOk ? { ok: true } : { error: 'Failed to reach offscreen document.' });
      return true;
    }

    case 'RTC_GET_STATUS': {
      const sessions = await loadStatuses();
      // @ts-ignore
      sendResponse?.({ sessions });
      return true;
    }

    case 'RTC_SEND_FILE': {
      const sendFileOk = await sendToOffscreen({
        type: 'RTC_OFFSCREEN_CMD',
        cmd: 'SEND_FILE',
        targetQueueId: message.targetQueueId,
        filename: message.filename,
        fileBytes: message.fileBytes,
      });
      // @ts-ignore
      sendResponse?.(sendFileOk ? { ok: true } : { error: 'Failed to reach offscreen document.' });
      return true;
    }

    case 'RTC_CLOSE': {
      const closeOk = await sendToOffscreen({
        type: 'RTC_OFFSCREEN_CMD',
        cmd: 'CLOSE',
        targetQueueId: message.targetQueueId,
      });
      // @ts-ignore
      sendResponse?.(closeOk ? { ok: true } : { error: 'Failed to reach offscreen document.' });
      return true;
    }

    default:
      return false;
  }
}
