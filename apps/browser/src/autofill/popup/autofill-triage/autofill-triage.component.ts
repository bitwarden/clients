// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe, CommonModule } from "@angular/common";
import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  CalloutModule,
  IconButtonModule,
  IconModule,
  BadgeModule,
  SectionComponent,
  ToastService,
} from "@bitwarden/components";

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
    ButtonModule,
    CalloutModule,
    IconButtonModule,
    IconModule,
    BadgeModule,
    SectionComponent,
    DatePipe,
  ],
})
export class AutofillTriageComponent implements OnInit {
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

  constructor(
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly i18nService: I18nService,
    private readonly toastService: ToastService,
  ) {}

  async ngOnInit() {
    // Fetch the triage result from the background service worker
    chrome.runtime.sendMessage(
      { command: "getAutofillTriageResult" },
      (response: AutofillTriagePageResult | null) => {
        this.triageResult.set(response);
      },
    );
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
}
