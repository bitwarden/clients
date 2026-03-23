import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ButtonModule,
  DialogModule,
  TypographyModule,
  CalloutComponent,
  LinkModule,
  TooltipDirective,
} from "@bitwarden/components";

export interface AutofillConfirmationDialogParams {
  savedUris: LoginUriView[];
  currentUrl: string;
  viewOnly?: boolean;
}

export const AutofillConfirmationDialogResult = Object.freeze({
  AutofillAndUrlAdded: "added",
  AutofilledOnly: "autofilled",
  Canceled: "canceled",
} as const);

export type AutofillConfirmationDialogResultType = UnionOfValues<
  typeof AutofillConfirmationDialogResult
>;

/** Match strategies that force showing full URLs */
const FULL_URI_MATCH_STRATEGIES = [UriMatchStrategy.StartsWith, UriMatchStrategy.RegularExpression];

@Component({
  templateUrl: "./autofill-confirmation-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    CalloutComponent,
    CommonModule,
    DialogModule,
    LinkModule,
    TypographyModule,
    JslibModule,
    TooltipDirective,
  ],
})
export class AutofillConfirmationDialogComponent {
  private readonly params = inject<AutofillConfirmationDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<AutofillConfirmationDialogResultType>);
  private readonly domainSettingsService = inject(DomainSettingsService);

  private readonly uriMatchSetting = toSignal(
    this.domainSettingsService.resolvedDefaultUriMatchStrategy$,
  );

  readonly savedUrls = signal<LoginUriView[]>(this.params.savedUris ?? []);

  readonly currentUrl = signal<string>(this.params.currentUrl);

  /**
   * When any of the saved URIs contain a `FULL_URI_MATCH_STRATEGIES` setting,
   * show the full URLs in the dialog.
   */
  readonly showFullUrls = computed<boolean>(() => {
    const uriMatchSetting = this.uriMatchSetting();

    return (
      (uriMatchSetting && (FULL_URI_MATCH_STRATEGIES as number[]).includes(uriMatchSetting)) ||
      this.savedUrls().some(
        (u) => u.match != null && (FULL_URI_MATCH_STRATEGIES as number[]).includes(u.match),
      )
    );
  });

  readonly formattedSavedUrls = computed(() => {
    const savedUrls = this.savedUrls();

    return this.showFullUrls()
      ? savedUrls.map((u) => u.uri)
      : savedUrls.map((u) => Utils.getHostname(u.uri ?? "")).filter(Boolean);
  });

  readonly formattedCurrentUrl = computed(() => {
    return this.showFullUrls() ? this.currentUrl() : Utils.getHostname(this.currentUrl());
  });

  readonly viewOnly = signal<boolean>(this.params.viewOnly ?? false);
  readonly savedUrlsExpanded = signal<boolean>(false);

  readonly savedUrlsListClass = computed(() =>
    this.savedUrlsExpanded()
      ? ""
      : `tw-relative tw-max-h-24 tw-overflow-hidden after:tw-pointer-events-none
         after:tw-content-[''] after:tw-absolute after:tw-inset-x-0 after:tw-bottom-0
         after:tw-h-8 after:tw-bg-gradient-to-t after:tw-from-background after:tw-to-transparent`,
  );

  toggleSavedUrlExpandedState() {
    this.savedUrlsExpanded.update((v) => !v);
  }

  close() {
    this.dialogRef.close(AutofillConfirmationDialogResult.Canceled);
  }

  autofillAndAddUrl() {
    this.dialogRef.close(AutofillConfirmationDialogResult.AutofillAndUrlAdded);
  }

  autofillOnly() {
    this.dialogRef.close(AutofillConfirmationDialogResult.AutofilledOnly);
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<AutofillConfirmationDialogParams>,
  ) {
    return dialogService.open<AutofillConfirmationDialogResultType>(
      AutofillConfirmationDialogComponent,
      { ...config },
    );
  }
}
