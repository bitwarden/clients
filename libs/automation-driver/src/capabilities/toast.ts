/**
 * Timeout, in milliseconds, forced onto every toast once the toast service is hooked. Toasts
 * normally dismiss themselves in a few seconds, which is long enough for an automation run to miss
 * them entirely between a click and a screenshot.
 */
export const AUTOMATION_TOAST_TIMEOUT_MS = 60_000;

/**
 * A toast as the application requested it — the original timeout, before the hook overrides it.
 */
export interface ToastEntry {
  message: any;
  title?: any;
  variant?: any;
  timeout?: number;
}

/**
 * Structural view of the Angular `ToastService`. Declared here rather than imported so this
 * (client-agnostic) file keeps no dependency on `@bitwarden/components`; the CLI consumes the
 * driver too and has no Angular.
 */
export interface AutomationToastController {
  showToast(options: ToastEntry): void;
}

/** Buffers toasts and keeps them on screen long enough for an automation run to observe them. */
export class ToastCapability {
  private toastBuffer: ToastEntry[] = [];

  constructor(toastService: AutomationToastController) {
    this.hook(toastService);
  }

  /**
   * Patches `toastService.showToast` so every toast is appended to an internal buffer and shown
   * for {@link AUTOMATION_TOAST_TIMEOUT_MS} instead of its requested timeout. The buffer records
   * the timeout the caller asked for, not the overridden one. The original `showToast` still
   * fires.
   */
  private hook(toastService: AutomationToastController): void {
    const original = toastService.showToast.bind(toastService);

    (toastService as any).showToast = (options: ToastEntry) => {
      // Reads the field on every call so the hook keeps writing to the current buffer after a
      // clear swaps the array out.
      this.toastBuffer.push({ ...options });
      original({ ...options, timeout: AUTOMATION_TOAST_TIMEOUT_MS });
    };
  }

  /** Return a snapshot of buffered toasts since the last {@link clearBuffer} call. */
  readBuffer(): ToastEntry[] {
    return [...this.toastBuffer];
  }

  /** Empty the toast buffer. */
  clearBuffer(): void {
    this.toastBuffer = [];
  }
}
