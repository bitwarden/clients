import { Injectable, signal } from "@angular/core";

import type { ToastVariant } from "./toast.component";
import { calculateToastTimeout, PausableTimer } from "./utils";

export type ToastOptions = {
  /**
   * The duration the toast will persist in milliseconds
   **/
  timeout?: number;
  message: string | string[];
  variant?: ToastVariant;
  title?: string;
};

export type ToastPosition = "bottom-right" | "top-full-width" | "bottom-full-width";

export type ToastConfig = {
  /** Maximum number of toasts shown at once. */
  maxOpened: number;
  /** When `maxOpened` is exceeded, remove the oldest toast to make room. */
  autoDismiss: boolean;
  /** Default auto-dismiss duration in milliseconds. */
  timeout: number;
  /** Where toasts are anchored on screen. */
  position: ToastPosition;
};

export const defaultToastConfig: ToastConfig = {
  maxOpened: 5,
  autoDismiss: true,
  timeout: 5000,
  position: "bottom-right",
};

export type ToastData = {
  id: string;
  message: string | string[];
  variant: ToastVariant;
  title?: string;
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

  showToast(options: ToastOptions): void {
    const id = Math.random().toString(36).slice(2);
    const timeout =
      options.timeout != null && options.timeout > 0
        ? options.timeout
        : calculateToastTimeout(options.message);

    const toast: ToastData = {
      id,
      message: options.message,
      variant: options.variant ?? "info",
      title: options.title,
    };

    this._toasts.update((toasts) => {
      let updated = [...toasts, toast];
      if (updated.length > this.config.maxOpened) {
        if (this.config.autoDismiss) {
          const toRemove = updated.slice(0, updated.length - this.config.maxOpened);
          toRemove.forEach((t) => this.cancelTimer(t.id));
        }
        updated = updated.slice(updated.length - this.config.maxOpened);
      }
      return updated;
    });

    this.startTimer(id, timeout);
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
