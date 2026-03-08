import { Injectable, signal } from "@angular/core";

import type { ToastVariant } from "./toast.component";
import { calculateToastTimeout, PausableTimer } from "./utils";

/** Options passed to {@link ToastService.showToast}. */
export type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  /** The duration the toast will persist in milliseconds. */
  timeout?: number;
};

/** Options we used to support (used in method overload) */
type DeprecatedToastOptions = {
  message: string | string[];
  variant?: ToastVariant;
  timeout?: number;
  title?: string;
};

/** Screen position for the toast stack. */
export type ToastPosition = "bottom-right" | "top-full-width" | "bottom-full-width";

/** Configuration for the toast system, set via inputs on `<bit-toast-container>`. */
export type ToastConfig = {
  /** Maximum number of toasts shown at once. */
  maxOpened: number;
  /** Default auto-dismiss duration in milliseconds. */
  timeout: number;
  /** Where toasts are anchored on screen. */
  position: ToastPosition;
};

export const defaultToastConfig: ToastConfig = {
  maxOpened: 5,
  timeout: 5000,
  position: "bottom-right",
};

/** Internal state for a single active toast. */
export type ToastData = {
  id: string;
  message: string | string[];
  variant: ToastVariant;
};

/**
 * Presents toast notifications
 **/
@Injectable({ providedIn: "root" })
export class ToastService {
  private config: ToastConfig = { ...defaultToastConfig };
  private readonly _toasts = signal<ToastData[]>([]);
  /** Read-only signal of currently active toasts. */
  readonly toasts = this._toasts.asReadonly();
  private readonly timers = new Map<string, PausableTimer>();
  private paused = false;

  /** Overrides default config. Typically called once by `ToastContainerComponent` on init. */
  configure(config: Partial<ToastConfig>): void {
    this.config = { ...defaultToastConfig, ...config };
  }

  /** Show a toast notification. */
  showToast(options: ToastOptions): void;
  /** @deprecated The following properties are deprecated:
   * - `title: string` (will not render)
   * - `message: string[]` (to be removed; use single string instead)
   **/
  showToast(options: DeprecatedToastOptions): void;
  showToast(options: ToastOptions | DeprecatedToastOptions): void {
    const id = Math.random().toString(36).slice(2);
    const resolvedTimeout =
      options.timeout != null && options.timeout > 0
        ? options.timeout
        : calculateToastTimeout(options.message, this.config.timeout);

    const toast: ToastData = {
      id,
      message: options.message,
      variant: options.variant ?? "info",
    };

    this._toasts.update((toasts) => {
      if (toasts.length >= this.config.maxOpened) {
        const toRemove = toasts.slice(0, toasts.length - this.config.maxOpened + 1);
        toRemove.forEach((t) => this.cancelTimer(t.id));
        return [...toasts.slice(toRemove.length), toast];
      }
      return [...toasts, toast];
    });

    this.startTimer(id, resolvedTimeout);

    if (this.paused) {
      this.timers.get(id)?.pause();
    }
  }

  /** Pauses auto-dismiss for all active toasts. Called when the user hovers the container. */
  pause(): void {
    if (this.paused) {
      return;
    }
    this.paused = true;
    this.timers.forEach((timer) => timer.pause());
  }

  /** Resumes auto-dismiss for all active toasts. Called when the user stops hovering. */
  resume(): void {
    if (!this.paused) {
      return;
    }
    this.paused = false;
    this.timers.forEach((timer) => timer.resume());
  }

  /** Dismisses a toast immediately, cancelling its timer. */
  remove(id: string): void {
    this.cancelTimer(id);
    this._toasts.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  private startTimer(id: string, timeout: number): void {
    this.timers.set(id, new PausableTimer(() => this.remove(id), timeout));
  }

  private cancelTimer(id: string): void {
    this.timers.get(id)?.cancel();
    this.timers.delete(id);
  }

  /**
   * @deprecated use `showToast` instead
   *
   * Converts options object from PlatformUtilsService
   **/
  _showToast(options: {
    type: "error" | "success" | "warning" | "info";
    title: string;
    text: string | string[];
    options?: {
      timeout?: number;
    };
  }) {
    this.showToast({
      message: options.text,
      variant: options.type,
      title: options.title,
      timeout: options.options?.timeout,
    });
  }
}
