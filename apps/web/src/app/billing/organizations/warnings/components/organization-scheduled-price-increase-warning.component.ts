import { CommonModule, CurrencyPipe, DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { map, switchMap } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CalloutModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OrganizationWarningsService } from "../services";

@Component({
  selector: "app-organization-scheduled-price-increase-warning",
  template: `
    @let warning = message$ | async;

    @if (warning) {
      <bit-callout type="info" [title]="null" [accessibleName]="'priceIncreaseNotice' | i18n">
        {{ warning }}
      </bit-callout>
    }
  `,
  imports: [CommonModule, CalloutModule, I18nPipe],
  providers: [CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block tw-mt-6 tw-mb-8" },
})
export class OrganizationScheduledPriceIncreaseWarningComponent {
  readonly organization = input.required<Organization>();

  private readonly organizationWarningsService = inject(OrganizationWarningsService);
  private readonly i18nService = inject(I18nService);
  private readonly currencyPipe = inject(CurrencyPipe);
  private readonly datePipe = inject(DatePipe);

  protected readonly message$ = toObservable(this.organization).pipe(
    switchMap((organization) =>
      this.organizationWarningsService.getScheduledPriceIncreaseWarning$(organization),
    ),
    map((warning) => {
      if (!warning) {
        return null;
      }
      const digitsInfo = Number.isInteger(warning.seatPrice) ? "1.0-0" : "1.2-2";
      const price =
        this.currencyPipe.transform(warning.seatPrice, "$", "symbol", digitsInfo) ??
        `$${warning.seatPrice}`;
      const date = this.datePipe.transform(warning.effectiveDate, "longDate", "UTC") ?? "";
      return warning.cadence === "annually"
        ? this.i18nService.t("scheduledPriceIncreaseWarningAnnually", price, date)
        : this.i18nService.t("scheduledPriceIncreaseWarningMonthly", price, date);
    }),
  );
}
