import { getToastContainer, ToastOptions } from "./toast-container";
import { calculateToastTimeout } from "./toast-timeout";

/**
 * Shows a toast, replacing `ToastService.showToast`. Toasts are announced to screen readers
 * (assertively for errors), pause while hovered and dismiss after `timeout`.
 *
 * ```ts
 * showToast({ variant: "success", message: t("itemSaved") });
 * ```
 */
export function showToast(options: ToastOptions): void {
  const timeout =
    options.timeout != null && options.timeout > 0
      ? options.timeout
      : calculateToastTimeout(options.message);
  getToastContainer().add(options, timeout);
}
