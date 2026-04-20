import { CommonModule } from "@angular/common";
import { Component, computed, input, OnInit, signal, ChangeDetectionStrategy } from "@angular/core";
import { outputFromObservable } from "@angular/core/rxjs-interop";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconModule } from "../icon";
import { IconButtonModule } from "../icon-button";
import { BitwardenIcon } from "../shared/icon";
import { TypographyModule } from "../typography";

export type CalloutTypes = "success" | "info" | "warning" | "danger" | "subtle";

const defaultIcon: Record<CalloutTypes, BitwardenIcon> = {
  success: "bwi-check-circle",
  info: "bwi-info-circle",
  warning: "bwi-exclamation-triangle",
  danger: "bwi-error",
  subtle: "bwi-info-circle",
};

const defaultI18n: Partial<Record<CalloutTypes, string>> = {
  warning: "warning",
  danger: "error",
};

// Increments for each instance of this component
let nextId = 0;

/**
 * The callout component provides information to your users such as success or error messages,
 * but also highlighted information complementing the normal flow of paragraphs and headers on a page.
 * Whereas a banner is meant to be used globally across pages, the callout can be used more contextually
 * within other components / in the more standard flow of information.
 */
@Component({
  selector: "bit-callout",
  templateUrl: "callout.component.html",
  imports: [CommonModule, TypographyModule, IconButtonModule, IconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalloutComponent implements OnInit {
  /** The variant type of the callout. Defaults to "info". */
  readonly type = input<CalloutTypes>("info");
  /** The icon to display in the callout. If not provided, a default icon based on the type will be used. Pass in `null` to not display an icon. */
  readonly icon = input<BitwardenIcon | null>();
  /** The title of the callout. If not provided, a default title will be used if callout type is `warning | danger`. Pass in `null` to not display a title. */
  readonly title = input<string | null>();
  /** If a title is not supplied, provide a screenreader-accessible unique name for this callout */
  readonly accessibleName = input<string>();

  readonly closeLabel = this.i18nService.t("close");

  private readonly calloutId = nextId++;

  private readonly dismiss$ = new Subject<void>();
  readonly dismiss = outputFromObservable(this.dismiss$);
  protected readonly isDismissible = signal(false);

  protected onDismiss(): void {
    this.dismiss$.next();
  }

  ngOnInit() {
    this.isDismissible.set(this.dismiss$.observed);
  }

  readonly iconComputed = computed(() => {
    if (this.icon() === null) {
      return undefined;
    }

    return this.icon() || defaultIcon[this.type()];
  });

  readonly titleComputed = computed(() => {
    const title = this.title();
    if (title === null) {
      return undefined;
    }

    const type = this.type();
    if (title == null && defaultI18n[type] != null) {
      return this.i18nService.t(defaultI18n[type]);
    }

    return title;
  });

  protected readonly titleId = `bit-callout-title-${this.calloutId}`;

  constructor(private readonly i18nService: I18nService) {}

  protected readonly variantClass = computed(() => {
    switch (this.type()) {
      case "danger":
        return "tw-bg-bg-danger-soft tw-border-border-danger-soft";
      case "info":
        return "tw-bg-bg-brand-softer tw-border-border-brand-soft";
      case "success":
        return "tw-bg-bg-success-soft tw-border-border-success-soft";
      case "warning":
        return "tw-bg-bg-warning-soft tw-border-border-warning-soft";
      case "subtle":
        return "tw-bg-bg-secondary tw-border-border-base";
    }
  });

  protected readonly fgClass = computed(() => {
    switch (this.type()) {
      case "danger":
        return "!tw-text-fg-danger-strong";
      case "info":
        return "!tw-text-fg-brand-strong";
      case "success":
        return "!tw-text-fg-success-strong";
      case "warning":
        return "!tw-text-fg-warning-strong";
      case "subtle":
        return "!tw-text-fg-heading";
    }
  });

  protected readonly paddingClass = computed(() => {
    return this.title() ? "tw-pt-3 tw-pb-4" : "tw-py-2";
  });

  protected readonly calloutClass = computed(() => {
    return `${this.variantClass()} ${this.fgClass()} ${this.paddingClass()}`;
  });

  protected readonly paddingTopClass = computed(() => {
    return this.isDismissible() ? "tw-pt-1.5" : undefined;
  });

  protected readonly accessibleLandmarkName = computed(() => {
    return (
      this.accessibleName() ??
      `${this.i18nService.t("callout")} ${this.calloutId + 1}, ${this.type()}`
    );
  });
}
