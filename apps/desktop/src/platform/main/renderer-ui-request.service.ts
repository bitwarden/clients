import { ipcMain } from "electron";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

/**
 * Electron has no built-in main -> renderer request/response channel. When a main-process service
 * needs a decision that can only be made in the renderer (e.g. showing an approval dialog or
 * reading decrypted vault data behind UI), it must fire a message to the renderer and correlate the
 * eventual reply back to the awaiting caller.
 *
 * This service generalizes the correlation pattern originally implemented ad hoc in
 * {@link ../../autofill/main/main-ssh-agent.service.ts}: each request gets a monotonically
 * increasing `requestId`, its resolver is stored in a map, and the renderer replies over a paired
 * IPC channel carrying that `requestId`.
 *
 * The renderer side is a thin shim: it listens for `requestCommand` (via `MessageListener`), performs
 * the UI work, and replies through a preload `ipc.*` call that invokes `responseChannel` with
 * `{ requestId, response }`.
 */
export class RendererUiRequestService {
  private pendingRequests = new Map<number, (response: unknown) => void>();
  private registeredResponseChannels = new Set<string>();
  private nextRequestId = 0;

  constructor(private messagingService: MessagingService) {}

  /**
   * Ask the renderer for a decision and await its reply.
   *
   * @param requestCommand The messaging command the renderer listens for.
   * @param responseChannel The IPC channel the renderer replies on (invoked with `{ requestId, response }`).
   * @param payload Additional data to include with the request (merged with `requestId`).
   * @param options.timeoutMs If set, the request resolves with `options.defaultResponse` after this delay,
   *   guarding against a renderer that never replies (e.g. window closed mid-request).
   * @param options.defaultResponse The value to resolve with on timeout or when the request is cancelled.
   */
  request<TResponse>(
    requestCommand: string,
    responseChannel: string,
    payload: Record<string, unknown> = {},
    options: { timeoutMs?: number; defaultResponse?: TResponse } = {},
  ): Promise<TResponse> {
    this.ensureResponseHandler(responseChannel);

    const requestId = ++this.nextRequestId;
    return new Promise<TResponse>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const settle = (response: TResponse) => {
        if (!this.pendingRequests.has(requestId)) {
          return;
        }
        this.pendingRequests.delete(requestId);
        if (timer != null) {
          clearTimeout(timer);
        }
        resolve(response);
      };

      this.pendingRequests.set(requestId, (response) => settle(response as TResponse));

      if (options.timeoutMs != null) {
        timer = setTimeout(() => settle(options.defaultResponse as TResponse), options.timeoutMs);
      }

      this.messagingService.send(requestCommand, { requestId, ...payload });
    });
  }

  /**
   * Resolve every in-flight request with `defaultResponse`. Call this when the renderer is torn down
   * (e.g. reload or window close) so awaiting callers do not hang forever.
   */
  cancelAll(defaultResponse?: unknown): void {
    // Snapshot the resolvers first: each resolver runs `settle`, which removes its own entry from
    // `pendingRequests`, so we must not iterate the live map (and must not pre-clear it, or `settle`
    // would find the entry already gone and skip resolving).
    const resolvers = Array.from(this.pendingRequests.values());
    for (const resolve of resolvers) {
      resolve(defaultResponse);
    }
  }

  private ensureResponseHandler(responseChannel: string): void {
    if (this.registeredResponseChannels.has(responseChannel)) {
      return;
    }
    this.registeredResponseChannels.add(responseChannel);

    ipcMain.handle(
      responseChannel,
      (_event: unknown, { requestId, response }: { requestId: number; response: unknown }) => {
        this.pendingRequests.get(requestId)?.(response);
      },
    );
  }
}
