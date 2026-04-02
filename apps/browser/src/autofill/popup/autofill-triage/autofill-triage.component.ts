// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe, CommonModule } from "@angular/common";
import {
  Component,
  OnDestroy,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy,
} from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  BadgeModule,
  ButtonModule,
  CalloutModule,
  IconButtonModule,
  IconModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { AutofillTriagePageResult, AutofillTriageFieldResult } from "../../types/autofill-triage";
import { formatAutofillTriageReport } from "../utils/format-autofill-triage-report";

@Component({
  selector: "app-autofill-triage",
  templateUrl: "autofill-triage.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    BadgeModule,
    ButtonModule,
    CalloutModule,
    IconButtonModule,
    IconModule,
    ItemModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    DatePipe,
  ],
})
export class AutofillTriageComponent implements OnInit, OnDestroy {
  /**
   * Whether the component is waiting for triage results from the background.
   */
  readonly loading = signal(true);

  /**
   * The triage result fetched from the background service worker.
   */
  readonly triageResult = signal<AutofillTriagePageResult | null>(null);

  /**
   * Set of field indices that are currently expanded to show their conditions.
   */
  readonly expandedFields = signal<Set<number>>(new Set());

  /**
   * Computed count of eligible fields.
   */
  readonly eligibleCount = computed(() => {
    const result = this.triageResult();
    if (!result) {
      return 0;
    }
    return result.fields.filter((f: AutofillTriageFieldResult) => f.eligible).length;
  });

  /**
   * Computed signal that creates a function to check if a field is expanded.
   */
  readonly isFieldExpanded = computed(() => {
    const expanded = this.expandedFields();
    return (index: number) => expanded.has(index);
  });

  private readonly currentTabId = signal<number | undefined>(undefined);

  private readonly messageListener = (msg: { command: string; tabId?: number }) => {
    if (msg.command === "triageResultReady" && msg.tabId === this.currentTabId()) {
      // Clear previous results and show loading state for new triage
      this.triageResult.set(null);
      this.expandedFields.set(new Set());
      this.fetchTriageResult();
    }
  };

  constructor(
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly i18nService: I18nService,
    private readonly toastService: ToastService,
  ) {}

  async ngOnInit() {
    // In a side panel context, chrome.tabs.getCurrent() returns null.
    // We need to get the active tab from the current window instead.
    let tab = await BrowserApi.getCurrentTab();
    if (!tab && BrowserPopupUtils.inSidePanel(window)) {
      const tabs = await BrowserApi.tabsQuery({ active: true, currentWindow: true });
      tab = tabs[0];
    }
    this.currentTabId.set(tab?.id);

    BrowserApi.addListener(chrome.runtime.onMessage, this.messageListener);

    // Safety net: if the background finished collection before Angular bootstrapped,
    // pick up the already-stored result immediately.
    this.fetchTriageResult();
  }

  ngOnDestroy() {
    BrowserApi.removeListener(chrome.runtime.onMessage, this.messageListener);

    if (BrowserPopupUtils.inSidePanel(window)) {
      void BrowserApi.setSidePanelOptions({ enabled: false });
    }
  }

  private fetchTriageResult(): void {
    this.loading.set(true);
    void BrowserApi.sendMessageWithResponse<AutofillTriagePageResult | null>(
      "getAutofillTriageResult",
    ).then((response) => {
      if (response) {
        this.triageResult.set(response);
      }
      this.loading.set(false);
    });
  }

  /**
   * Toggles the expanded state of a field's conditions list.
   */
  toggleField(index: number): void {
    const current = new Set(this.expandedFields());
    if (current.has(index)) {
      current.delete(index);
    } else {
      current.add(index);
    }
    this.expandedFields.set(current);
  }

  /**
   * Gets a human-readable label for a field, falling back through available identifiers.
   */
  getFieldLabel(field: AutofillTriageFieldResult): string {
    if (field.htmlId) {
      return `${field.htmlId} (${field.htmlType || "unknown"})`;
    }
    if (field.htmlName) {
      return `${field.htmlName} (${field.htmlType || "unknown"})`;
    }
    if (field.htmlType) {
      return `(${field.htmlType})`;
    }
    return "(unnamed)";
  }

  /**
   * Formats and copies the triage report to the clipboard.
   */
  async copyReport(): Promise<void> {
    const result = this.triageResult();
    if (!result) {
      return;
    }

    const report = formatAutofillTriageReport(result);
    await this.platformUtilsService.copyToClipboard(report);

    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("copiedToClipboard"),
      message: this.i18nService.t("triageReportCopied"),
    });
  }

  /**
   * Serializes the triage result as formatted JSON and copies it to the clipboard.
   */
  async copyJsonReport(): Promise<void> {
    const result = this.triageResult();
    if (!result) {
      return;
    }

    await this.platformUtilsService.copyToClipboard(JSON.stringify(result, null, 2));

    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("copiedToClipboard"),
      message: this.i18nService.t("triageJsonReportCopied"),
    });
  }
}
