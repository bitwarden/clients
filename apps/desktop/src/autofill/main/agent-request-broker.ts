import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

type Pending<TRequest, TAnswer> = {
  request: TRequest;
  resolve: (answer: TAnswer) => void;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Correlates requests sent to the renderer with its answers. A request waits while no renderer
 * listens and is re-sent whenever one (re)starts, so a closed window or a reload doesn't lose it.
 * Every request settles exactly once: answered, at its deadline, or on {@link settleAll}.
 */
export class AgentRequestBroker<TRequest extends object, TAnswer> {
  private pending = new Map<number, Pending<TRequest, TAnswer>>();
  private lastId = 0;
  private rendererReady = false;
  private opening: Promise<void> | null = null;

  constructor(
    private command: string,
    private messagingService: MessagingService,
    private logService: LogService,
    private hasWindow: () => boolean,
    private showWindow: () => Promise<void>,
    private timedOut: TAnswer,
  ) {}

  request(request: TRequest, deadline: number): Promise<TAnswer> {
    const requestId = ++this.lastId;
    return new Promise<TAnswer>((resolve) => {
      const timer = setTimeout(
        () => this.answer(requestId, this.timedOut),
        Math.max(0, deadline - Date.now()),
      );
      this.pending.set(requestId, { request, resolve, timer });
      this.deliver(requestId, request);
    });
  }

  answer(requestId: number, answer: TAnswer) {
    const pending = this.pending.get(requestId);
    if (pending == null) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending.delete(requestId);
    pending.resolve(answer);
  }

  /** A renderer started listening: whatever an earlier one held is lost, so re-send all. */
  rendererStarted() {
    this.rendererReady = true;
    for (const [requestId, { request }] of this.pending) {
      this.deliver(requestId, request);
    }
  }

  settleAll(answer: TAnswer, which: (request: TRequest) => boolean = () => true) {
    for (const [requestId, { request }] of [...this.pending]) {
      if (which(request)) {
        this.answer(requestId, answer);
      }
    }
  }

  private deliver(requestId: number, request: TRequest) {
    if (!this.hasWindow()) {
      this.rendererReady = false;
      this.opening ??= this.showWindow()
        .catch((e: unknown) =>
          this.logService.error("Failed to open a window for agent requests", e),
        )
        .finally(() => (this.opening = null));
      return;
    }
    if (this.rendererReady) {
      this.messagingService.send(this.command, { ...request, requestId });
    }
  }
}
