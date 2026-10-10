import { LiveAnnouncer } from "@angular/cdk/a11y";
import { Injectable, Optional } from "@angular/core";
import { IndividualConfig, ToastrService } from "ngx-toastr";

import type { ToastComponent } from "./toast.component";
import { calculateToastTimeout } from "./utils";

export type ToastOptions = {
  /**
   * The duration the toast will persist in milliseconds
   **/
  timeout?: number;
  message: ReturnType<ToastComponent["message"]>;
  variant?: ReturnType<ToastComponent["variant"]>;
  title?: ReturnType<ToastComponent["title"]>;
};

/**
 * Presents toast notifications visually and announces them to screen readers.
 **/
@Injectable({ providedIn: "root" })
export class ToastService {
  constructor(
    private toastrService: ToastrService,
    @Optional() private liveAnnouncer?: LiveAnnouncer,
  ) {}

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

    this.toastrService.show(undefined, options.title, toastrConfig);

    const messageText = Array.isArray(options.message)
      ? options.message.filter(Boolean).join(" ")
      : (options.message ?? "");
    const titleText = options.title?.trim();
    const fullAnnouncement = titleText
      ? messageText
        ? `${titleText}: ${messageText}`
        : titleText
      : messageText;

    if (fullAnnouncement?.trim() && this.liveAnnouncer) {
      const politeness = options.variant === "error" ? "assertive" : "polite";
      void this.liveAnnouncer.announce(fullAnnouncement.trim(), politeness);
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
