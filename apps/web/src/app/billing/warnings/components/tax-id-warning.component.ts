import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import {
  BehaviorSubject,
  combineLatest,
  filter,
  firstValueFrom,
  lastValueFrom,
  map,
  Observable,
  switchMap,
} from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BannerModule, DialogService } from "@bitwarden/components";
import { BILLING_DISK, StateProvider, UserKeyDefinition } from "@bitwarden/state";
import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";
import { EditBillingAddressDialogComponent } from "@bitwarden/web-vault/app/billing/payment/components";
import { NonIndividualSubscriber } from "@bitwarden/web-vault/app/billing/types";
import {
  TaxIdWarningType,
  TaxIdWarningTypes,
} from "@bitwarden/web-vault/app/billing/warnings/types";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

type DismissalCounts = {
  [TaxIdWarningTypes.Missing]?: number;
  [TaxIdWarningTypes.FailedVerification]?: number;
};

const DISMISSALS_COUNT_KEY = new UserKeyDefinition<DismissalCounts>(
  BILLING_DISK,
  "taxIdWarningDismissalCounts",
  {
    deserializer: (dismissalCounts) => dismissalCounts,
    clearOn: [],
  },
);

type DismissedThisSession = {
  [TaxIdWarningTypes.Missing]?: boolean;
  [TaxIdWarningTypes.FailedVerification]?: boolean;
};

const DISMISSED_THIS_SESSION_KEY = new UserKeyDefinition<DismissedThisSession>(
  BILLING_DISK,
  "taxIdWarningDismissedThisSession",
  {
    deserializer: (dismissedThisSession) => dismissedThisSession,
    clearOn: ["logout"],
  },
);

type Dismissals = {
  [TaxIdWarningTypes.Missing]: {
    count: number;
    dismissedThisSession: boolean;
  };
  [TaxIdWarningTypes.FailedVerification]: {
    count: number;
    dismissedThisSession: boolean;
  };
};

const shouldShowWarning = (
  warning: Exclude<TaxIdWarningType, typeof TaxIdWarningTypes.PendingVerification>,
  dismissals: Dismissals,
) => {
  const dismissalsForType = dismissals[warning];
  if (dismissalsForType.dismissedThisSession) {
    return false;
  }
  return dismissalsForType.count < 3;
};

type View = {
  message: string;
  callToAction: string;
};

type GetWarning$ = () => Observable<TaxIdWarningType | null>;

@Component({
  selector: "app-tax-id-warning",
  template: `
    @if (enableTaxIdWarning$ | async) {
      @let view = view$ | async;

      @if (view) {
        <bit-banner
          id="tax-id-warning-banner"
          class="-tw-m-6 tw-flex tw-flex-col tw-pb-6"
          bannerType="warning"
          (onClose)="trackDismissal()"
        >
          {{ view.message }}
          <a
            bitLink
            linkType="secondary"
            (click)="editBillingAddress()"
            class="tw-cursor-pointer"
            rel="noreferrer noopener"
          >
            {{ view.callToAction }}
          </a>
        </bit-banner>
      }
    }
  `,
  imports: [BannerModule, SharedModule],
})
export class TaxIdWarningComponent implements OnInit {
  @Input({ required: true }) subscriber!: NonIndividualSubscriber;
  @Input({ required: true }) getWarning$!: GetWarning$;
  @Output() billingAddressUpdated = new EventEmitter<void>();

  protected enableTaxIdWarning$ = this.configService.getFeatureFlag$(
    FeatureFlag.PM22415_TaxIDWarnings,
  );

  protected userId$ = this.accountService.activeAccount$.pipe(
    filter((account): account is Account => account !== null),
    getUserId,
  );

  protected dismissals$: Observable<Dismissals> = this.userId$.pipe(
    switchMap((userId) =>
      combineLatest([
        this.stateProvider.getUser(userId, DISMISSALS_COUNT_KEY).state$.pipe(
          map((dismissalCounts) => {
            if (!dismissalCounts) {
              return {
                [TaxIdWarningTypes.Missing]: 0,
                [TaxIdWarningTypes.FailedVerification]: 0,
              };
            }
            return {
              [TaxIdWarningTypes.Missing]: dismissalCounts[TaxIdWarningTypes.Missing] ?? 0,
              [TaxIdWarningTypes.FailedVerification]:
                dismissalCounts[TaxIdWarningTypes.FailedVerification] ?? 0,
            };
          }),
        ),
        this.stateProvider.getUser(userId, DISMISSED_THIS_SESSION_KEY).state$.pipe(
          map((dismissedThisSession) => {
            if (!dismissedThisSession) {
              return {
                [TaxIdWarningTypes.Missing]: false,
                [TaxIdWarningTypes.FailedVerification]: false,
              };
            }
            return {
              [TaxIdWarningTypes.Missing]: dismissedThisSession[TaxIdWarningTypes.Missing] ?? false,
              [TaxIdWarningTypes.FailedVerification]:
                dismissedThisSession[TaxIdWarningTypes.FailedVerification] ?? false,
            };
          }),
        ),
      ]),
    ),
    map(([dismissalCounts, dismissedThisSession]) => ({
      [TaxIdWarningTypes.Missing]: {
        count: dismissalCounts[TaxIdWarningTypes.Missing],
        dismissedThisSession: dismissedThisSession[TaxIdWarningTypes.Missing],
      },
      [TaxIdWarningTypes.FailedVerification]: {
        count: dismissalCounts[TaxIdWarningTypes.FailedVerification],
        dismissedThisSession: dismissedThisSession[TaxIdWarningTypes.FailedVerification],
      },
    })),
  );

  protected getWarningSubject = new BehaviorSubject<GetWarning$ | null>(null);

  protected warning$ = this.getWarningSubject.pipe(switchMap(() => this.getWarning$()));

  protected view$: Observable<View | null> = combineLatest([this.warning$, this.dismissals$]).pipe(
    map(([warning, dismissals]) => {
      if (!warning || warning === TaxIdWarningTypes.PendingVerification) {
        return null;
      }

      if (!shouldShowWarning(warning, dismissals)) {
        return null;
      }

      switch (warning) {
        case TaxIdWarningTypes.Missing: {
          return {
            message: this.i18nService.t("missingTaxIdWarning"),
            callToAction: this.i18nService.t("addTaxId"),
          };
        }
        case TaxIdWarningTypes.FailedVerification: {
          return {
            message: this.i18nService.t("unverifiedTaxIdWarning"),
            callToAction: this.i18nService.t("editTaxId"),
          };
        }
      }
    }),
  );

  constructor(
    private accountService: AccountService,
    private configService: ConfigService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private subscriberBillingClient: SubscriberBillingClient,
    private stateProvider: StateProvider,
  ) {}

  ngOnInit() {
    this.getWarningSubject.next(this.getWarning$);
  }

  editBillingAddress = async () => {
    const billingAddress = await this.subscriberBillingClient.getBillingAddress(this.subscriber);
    const warning = (await firstValueFrom(this.warning$)) ?? undefined;

    const dialogRef = EditBillingAddressDialogComponent.open(this.dialogService, {
      data: {
        subscriber: this.subscriber,
        billingAddress,
        taxIdWarning: warning,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result?.type === "success") {
      this.billingAddressUpdated.emit();
    }
  };

  trackDismissal = async () => {
    const warning = await firstValueFrom(this.warning$);
    if (!warning || warning === TaxIdWarningTypes.PendingVerification) {
      return;
    }
    const userId = await firstValueFrom(this.userId$);
    const updateDismissalCounts = this.stateProvider
      .getUser(userId, DISMISSALS_COUNT_KEY)
      .update((dismissalCounts) => {
        if (!dismissalCounts) {
          return {
            [warning]: 1,
          };
        }
        const dismissalsByType = dismissalCounts[warning];
        if (!dismissalsByType) {
          return {
            ...dismissalCounts,
            [warning]: 1,
          };
        }
        return {
          ...dismissalCounts,
          [warning]: dismissalsByType + 1,
        };
      });
    const updateDismissedThisSession = this.stateProvider
      .getUser(userId, DISMISSED_THIS_SESSION_KEY)
      .update((dismissedThisSession) => {
        if (!dismissedThisSession) {
          return {
            [warning]: true,
          };
        }
        const dismissedThisSessionByType = dismissedThisSession[warning];
        if (!dismissedThisSessionByType) {
          return {
            ...dismissedThisSession,
          };
        }
        return {
          ...dismissedThisSession,
          [warning]: dismissedThisSessionByType,
        };
      });
    await Promise.all([updateDismissalCounts, updateDismissedThisSession]);
  };
}
