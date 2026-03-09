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
  /** Resolved auto-dismiss duration, used to (re)start the timer when this toast reaches the top. */
  timeout: number;
};

const defaultTimeout = 5000;

/**
 * Presents toast notifications
 **/
@Injectable({ providedIn: "root" })
export class ToastService {
  private nextId = 0;
  private readonly _toasts = signal<ToastData[]>([]);
  /** Read-only signal of currently active toasts. */
  readonly toasts = this._toasts.asReadonly();
  /** Single timer tracking the current top toast. Paused while the user hovers. */
  private timer: PausableTimer | null = null;
  private paused = false;

  /** Show a toast notification. */
  showToast(options: ToastOptions): void;
  /** @deprecated The following properties are deprecated:
   * - `title: string` (will not render)
   * - `message: string[]` (to be removed; use single string instead)
   **/
  showToast(options: DeprecatedToastOptions): void;
  showToast(options: ToastOptions | DeprecatedToastOptions): void {
    const id = String(this.nextId++);
    const resolvedTimeout =
      options.timeout != null && options.timeout > 0
        ? options.timeout
        : calculateToastTimeout(options.message, defaultTimeout);

    const toast: ToastData = {
      id,
      message: options.message,
      variant: options.variant ?? "info",
      timeout: resolvedTimeout,
    };

    this._toasts.update((toasts) => [...toasts, toast]);

    // Restart the single timer for the new top toast.
    this.timer?.cancel();
    this.timer = new PausableTimer(() => this.remove(id), resolvedTimeout);

    if (this.paused) {
      this.timer.pause();
    }
  }

  /** Pauses auto-dismiss. Called when the user hovers the container. */
  pause(): void {
    if (this.paused) {
      return;
    }
    this.paused = true;
    this.timer?.pause();
  }

  /** Resumes auto-dismiss. Called when the user stops hovering. */
  resume(): void {
    if (!this.paused) {
      return;
    }
    this.paused = false;
    if (this.timer) {
      // Top toast was hover-paused — resume from where it left off.
      this.timer.resume();
    } else {
      // Top toast was removed while hover-paused — start a fresh timer for the new top.
      const toasts = this._toasts();
      if (toasts.length > 0) {
        const top = toasts[toasts.length - 1];
        this.timer = new PausableTimer(() => this.remove(top.id), top.timeout);
      }
    }
  }

  /** Dismisses a toast immediately. */
  remove(id: string): void {
    this.timer?.cancel();
    this.timer = null;
    this._toasts.update((toasts) => toasts.filter((t) => t.id !== id));

    // Start a fresh timer for the new top toast if not hover-paused.
    if (!this.paused) {
      const toasts = this._toasts();
      if (toasts.length > 0) {
        const top = toasts[toasts.length - 1];
        this.timer = new PausableTimer(() => this.remove(top.id), top.timeout);
      }
    }
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
