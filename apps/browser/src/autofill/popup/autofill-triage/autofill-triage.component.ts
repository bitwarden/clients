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
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  BadgeModule,
  ButtonModule,
  CalloutModule,
  DialogService,
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
import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { AutofillTriagePageResult, AutofillTriageFieldResult } from "../../types/autofill-triage";
import { formatAutofillTriageReport, getFieldLabel } from "../utils/format-autofill-triage-report";

@Component({
  selector: "app-autofill-triage",
  templateUrl: "autofill-triage.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
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
   * Computed count of eligible fields.
   */
  readonly eligibleCount = computed(() => {
    const result = this.triageResult();
    if (!result) {
      return 0;
    }
    return result.fields.filter((f: AutofillTriageFieldResult) => f.eligible).length;
  });

  private readonly _expandedFields = new Set<number>();
  private readonly _expandedCount = signal(0);

  /**
   * Computed signal that creates a function to check if a field is expanded.
   * Depends on _expandedCount so Angular re-evaluates when the set changes.
   */
  readonly isFieldExpanded = computed(() => {
    this._expandedCount();
    return (index: number) => this._expandedFields.has(index);
  });

  private readonly currentTabId = signal<number | undefined>(undefined);

  private readonly messageListener = (msg: { command: string; tabId?: number }) => {
    if (msg.command === "triageResultReady" && msg.tabId === this.currentTabId()) {
      // Clear previous results and show loading state for new triage
      this.triageResult.set(null);
      this._expandedFields.clear();
      this._expandedCount.set(0);
      void this.fetchTriageResult();
    }
  };

  constructor(
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly toastService: ToastService,
    private readonly dialogService: DialogService,
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
    void this.fetchTriageResult();
  }

  ngOnDestroy() {
    BrowserApi.removeListener(chrome.runtime.onMessage, this.messageListener);

    if (BrowserPopupUtils.inSidePanel(window)) {
      void BrowserApi.setSidePanelOptions({ enabled: false, tabId: this.currentTabId() });
    }
  }

  private async fetchTriageResult(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await BrowserApi.sendMessageWithResponse<AutofillTriagePageResult | null>(
        "getAutofillTriageResult",
        { tabId: this.currentTabId() },
      );
      if (response) {
        this.triageResult.set({ ...response, analyzedAt: new Date(response.analyzedAt) });
      }
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Toggles the expanded state of a field's conditions list.
   */
  toggleField(index: number): void {
    if (this._expandedFields.has(index)) {
      this._expandedFields.delete(index);
    } else {
      this._expandedFields.add(index);
    }
    this._expandedCount.set(this._expandedFields.size);
  }

  getFieldLabel(field: AutofillTriageFieldResult): string {
    return getFieldLabel(field);
  }

  /**
   * Copies the triage report to the clipboard in the requested format.
   */
  async copyReport(format: "text" | "json"): Promise<void> {
    const result = this.triageResult();
    if (!result) {
      return;
    }

    const confirmed = await this.promptExportWarning();
    if (!confirmed) {
      return;
    }

    const content =
      format === "json" ? JSON.stringify(result, null, 2) : formatAutofillTriageReport(result);
    await this.platformUtilsService.copyToClipboard(content);

    this.toastService.showToast({
      variant: "success",
      title: "Copied to Clipboard",
      message:
        format === "json"
          ? "Triage JSON report copied to clipboard"
          : "Triage report copied to clipboard",
    });
  }

  private async promptExportWarning(): Promise<boolean> {
    return this.dialogService.openSimpleDialog({
      title: "Export Report Data",
      content:
        "Carefully review all data before copying. The report may contain form field details, labels, and partial field values — ensure no sensitive information is included before sharing.",
      type: "warning",
    });
  }
}
