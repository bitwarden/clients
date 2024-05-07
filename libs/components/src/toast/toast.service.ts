import { Injectable } from "@angular/core";
import { ActiveToast, IndividualConfig, ToastrService } from "ngx-toastr";

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

  showToast(options: ToastOptions): ActiveToast<any> {
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

    return this.toastrService.show(null, options.title, toastrConfig);
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
