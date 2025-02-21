// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { IndividualConfig, ToastrService } from "ngx-toastr";

import type { ToastComponent } from "./toast.component";
import { calculateToastTimeout } from "./utils";

export type ToastOptions = {
  /**
   * The duration the toast will persist in milliseconds
   **/
  timeout?: number;
} & Pick<ToastComponent, "message" | "variant" | "title">;

/**
 * Presents toast notifications
 **/
@Injectable({ providedIn: "root" })
export class ToastService {
  constructor(private toastrService: ToastrService) {}

  /**
   * This will present the toast to a user.
   *
   * Note: The toast duration is calculated programmatically by length and will
   * be displayed for a minimum of 5 seconds if no timeout is provided in
   * the options.
   *
   * @param options Options for toasts. If no timeout is specified an appropriate duration will be
   *                calculated on the size of the message being displayed.
   */
  showToast(options: ToastOptions): void {
    const toastrConfig: Partial<IndividualConfig> = {
      payload: {
        message: options.message,
        variant: options.variant,
        title: options.title,
      },
      timeOut:
        options.timeout != null && options.timeout > 0
          ? options.timeout
          : calculateToastTimeout(options.message),
    };

    this.toastrService.show(null, options.title, toastrConfig);
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
