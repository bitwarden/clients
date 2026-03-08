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

/** Internal state for a single active toast. */
export type ToastData = {
  id: string;
  message: string | string[];
  variant: ToastVariant;
};

const defaultTimeout = 5000;

/**
 * Presents toast notifications
 **/
@Injectable({ providedIn: "root" })
export class ToastService {
  private readonly _toasts = signal<ToastData[]>([]);
  /** Read-only signal of currently active toasts. */
  readonly toasts = this._toasts.asReadonly();
  private readonly timers = new Map<string, PausableTimer>();
  private paused = false;
  private maxOpened = 5;

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
        : calculateToastTimeout(options.message, defaultTimeout);

    const toast: ToastData = {
      id,
      message: options.message,
      variant: options.variant ?? "info",
    };

    this._toasts.update((toasts) => {
      if (toasts.length >= this.maxOpened) {
        const toRemove = toasts.slice(0, toasts.length - this.maxOpened + 1);
        toRemove.forEach((t) => this.cancelTimer(t.id));
        return [...toasts.slice(toRemove.length), toast];
      }
      return [...toasts, toast];
    });

    // Pause all existing timers — the new toast is on top; others are hidden
    this.timers.forEach((timer) => timer.pause());

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

  /** Sets the maximum number of toasts shown at once. Called by `ToastContainerComponent`. */
  setMaxOpened(max: number): void {
    this.maxOpened = max;
  }

  /** Dismisses a toast immediately, cancelling its timer. */
  remove(id: string): void {
    this.cancelTimer(id);
    this._toasts.update((toasts) => toasts.filter((t) => t.id !== id));

    // Resume the new top toast's timer if not hover-paused
    if (!this.paused) {
      const toasts = this._toasts();
      if (toasts.length > 0) {
        this.timers.get(toasts[toasts.length - 1].id)?.resume();
      }
    }
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
