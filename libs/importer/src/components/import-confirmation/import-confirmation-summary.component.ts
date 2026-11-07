import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CalloutComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportedFile } from "../../models";

import { ImportSummary } from "./import-summary";

@Component({
  selector: "importer-confirmation-summary",
  templateUrl: "./import-confirmation-summary.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalloutComponent, I18nPipe, TypographyModule],
  host: { class: "tw-flex tw-flex-col tw-gap-2.5" },
})
export class ImportConfirmationSummaryComponent implements OnInit {
  private readonly i18nService = inject(I18nService);
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  readonly summary = input.required<ImportSummary>();
  /** The file the items came from. The delete-the-file tip shows only when set. */
  readonly importedFile = input<ImportedFile>();

  protected readonly bodyKey = computed(() =>
    this.summary().total === 1 ? "importConfirmationBodySingular" : "importConfirmationBody",
  );

  protected readonly tip = computed(() => {
    const file = this.importedFile();
    if (file == null) {
      return undefined;
    }
    return file.name == null
      ? this.i18nService.t("importDeleteFileTipGeneric")
      : this.i18nService.t("importDeleteFileTip", file.name);
  });

  ngOnInit(): void {
    const tip = this.tip();
    if (tip != null) {
      void this.liveAnnouncer.announce(
        `${this.i18nService.t("importConfirmationTipLabel")} ${tip}`,
        "polite",
      );
    }
  }
}
