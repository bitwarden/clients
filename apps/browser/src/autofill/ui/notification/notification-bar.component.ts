import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BitwardenIcon,
  ButtonModule,
  IconButtonModule,
  IconComponent,
  ItemModule,
  LinkModule,
  SvgModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { NotificationTypes } from "../../notification/abstractions/notification-bar";
import { CipherIconComponent } from "../shared/cipher-icon.component";
import { Celebrate, Keyhole } from "../shared/illustrations";

import {
  NotificationOptionSelectComponent,
  NotificationSelectOption,
} from "./notification-option-select.component";
import {
  NotificationBarConfirmationState,
  NotificationBarState,
  NotificationCipher,
  NotificationSaveSelection,
  OrganizationCategory,
} from "./notification.types";

/** Placeholder value for "personal vault", "no folder" and "no collection". */
const NONE = "0";

const organizationCategoryIcons: Record<OrganizationCategory, BitwardenIcon> = {
  business: "bwi-business",
  family: "bwi-family",
};

function vaultIcon(productTierType?: ProductTierType): BitwardenIcon {
  switch (productTierType) {
    case ProductTierType.Free:
    case ProductTierType.Families:
      return "bwi-family";
    case ProductTierType.Teams:
    case ProductTierType.Enterprise:
    case ProductTierType.TeamsStarter:
      return "bwi-business";
    default:
      return "bwi-user";
  }
}

/**
 * The notification bar page. Renders whichever view `state` describes.
 */
@Component({
  selector: "autofill-notification-bar",
  imports: [
    ButtonModule,
    CipherIconComponent,
    I18nPipe,
    IconButtonModule,
    IconComponent,
    ItemModule,
    LinkModule,
    NotificationOptionSelectComponent,
    SvgModule,
    TypographyModule,
  ],
  templateUrl: "notification-bar.component.html",
  host: {
    class:
      "tw-block tw-w-full tw-overflow-hidden tw-rounded-2xl tw-border tw-border-solid tw-border-border-base tw-bg-bg-secondary tw-shadow-lg",
    "[attr.data-testid]": "testId()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBarComponent {
  private readonly i18nService = inject(I18nService);

  protected readonly NotificationTypes = NotificationTypes;
  protected readonly Celebrate = Celebrate;
  protected readonly Keyhole = Keyhole;

  readonly state = input.required<NotificationBarState>();

  readonly closeNotification = output<void>();
  readonly save = output<NotificationSaveSelection>();
  /** Emits the id of the existing cipher to update. */
  readonly update = output<string>();
  /** Emits the id of the cipher to review before saving. */
  readonly edit = output<string>();
  readonly openVault = output<void>();
  readonly openTasks = output<void>();
  readonly changePassword = output<void>();

  protected readonly saveState = computed(() => {
    const state = this.state();
    return state.view === NotificationTypes.Add ||
      state.view === NotificationTypes.Change ||
      state.view === NotificationTypes.Unlock
      ? state
      : undefined;
  });

  protected readonly confirmationState = computed(() => {
    const state = this.state();
    return state.view === "confirmation" ? state : undefined;
  });

  protected readonly atRiskState = computed(() => {
    const state = this.state();
    return state.view === NotificationTypes.AtRiskPassword ? state : undefined;
  });

  protected readonly heading = computed(() => {
    const state = this.state();
    switch (state.view) {
      case NotificationTypes.Add:
        return this.i18nService.t("saveLogin");
      case NotificationTypes.Change:
        return this.i18nService.t("updateLogin");
      case NotificationTypes.Unlock:
        return this.i18nService.t("unlockToSave");
      case NotificationTypes.AtRiskPassword:
        return this.i18nService.t("atRiskPassword");
      case "confirmation":
        return this.confirmationHeading(state);
    }
  });

  protected readonly testId = computed(() => {
    switch (this.state().view) {
      case NotificationTypes.Add:
        return "save-notification-bar";
      case NotificationTypes.Change:
        return "update-notification-bar";
      case NotificationTypes.Unlock:
        return "unlock-notification-bar";
      case NotificationTypes.AtRiskPassword:
        return "at-risk-notification-bar";
      case "confirmation":
        return "confirmation-notification-bar";
    }
  });

  protected readonly selectedVault = signal<string | undefined>(undefined);
  protected readonly selectedFolder = signal(NONE);
  protected readonly selectedCollection = signal<string | undefined>(undefined);

  protected readonly vaultOptions = computed<NotificationSelectOption[]>(() => {
    const state = this.saveState();
    return [
      ...(state?.personalVaultAllowed !== false
        ? [
            {
              value: NONE,
              text: this.i18nService.t("myVault"),
              icon: "bwi-user" as const,
              default: true,
            },
          ]
        : []),
      ...(state?.organizations ?? []).map((org) => ({
        value: org.id,
        text: org.name,
        icon: vaultIcon(org.productTierType),
      })),
    ];
  });

  protected readonly folderOptions = computed<NotificationSelectOption[]>(() =>
    (this.saveState()?.folders ?? []).map(({ id, name }) => ({
      value: id || NONE,
      text: name,
      icon: "bwi-folder",
      default: !id,
    })),
  );

  protected readonly collectionOptions = computed<NotificationSelectOption[]>(() =>
    (this.saveState()?.collections ?? []).map(({ id, name }) => ({
      value: id ?? NONE,
      text: name,
      icon: "bwi-collection-shared",
      default: id == null,
    })),
  );

  /** A lone vault option is implicitly selected. */
  protected readonly vault = computed(() => {
    const options = this.vaultOptions();
    return options.length === 1 ? options[0].value : (this.selectedVault() ?? NONE);
  });

  /** Without a personal vault, a collection is required, so default to the first one. */
  protected readonly collection = computed(() => {
    const state = this.saveState();
    const collections = state?.collections ?? [];
    return (
      this.selectedCollection() ??
      (state?.personalVaultAllowed === false && collections.length ? collections[0].id : NONE)
    );
  });

  protected readonly selection = computed<NotificationSaveSelection>(() => ({
    vault: this.vault(),
    folder: this.selectedFolder(),
    collection: this.collection(),
  }));

  protected cipherIconUri(cipher: NotificationCipher) {
    return (cipher.icon.imageEnabled && cipher.icon.image) || undefined;
  }

  protected organizationIcons(cipher: NotificationCipher) {
    return (cipher.organizationCategories ?? []).map((c) => organizationCategoryIcons[c]);
  }

  protected cipherDescription(cipher: NotificationCipher) {
    return [cipher.name, cipher.login?.username].filter(Boolean).join(" ");
  }

  private confirmationHeading(state: NotificationBarConfirmationState) {
    if (state.error) {
      return this.i18nService.t("saveFailure");
    }
    return state.type === NotificationTypes.Add
      ? this.i18nService.t("loginSaveSuccess")
      : this.i18nService.t("loginUpdateSuccess");
  }

  protected readonly confirmationMessage = computed(() => {
    const state = this.confirmationState();
    if (!state) {
      return "";
    }
    if (state.error) {
      return this.i18nService.t("saveFailureDetails");
    }
    return state.type === NotificationTypes.Add
      ? this.i18nService.t("notificationLoginSaveConfirmation")
      : this.i18nService.t("notificationLoginUpdatedConfirmation");
  });

  protected readonly openVaultAriaLabel = computed(() => {
    const state = this.confirmationState();
    if (!state) {
      return "";
    }
    return state.error
      ? this.i18nService.t("notificationNewItemAria")
      : this.i18nService.t("notificationViewAria", state.itemName);
  });

  protected readonly remainingTasks = computed(
    () => this.confirmationState()?.task?.remainingTasksCount ?? 0,
  );

  protected readonly tasksComplete = computed(
    () => !this.confirmationState()?.task || this.remainingTasks() === 0,
  );

  protected readonly taskMessage = computed(() => {
    const state = this.confirmationState();
    const orgName = state?.task?.orgName;
    if (!state || state.error || orgName == null) {
      return undefined;
    }
    return this.remainingTasks() > 0
      ? this.i18nService.t(
          "loginUpdateTaskSuccessAdditional",
          orgName,
          this.remainingTasks().toString(),
        )
      : this.i18nService.t("loginUpdateTaskSuccess", orgName);
  });

  protected readonly atRiskMessage = computed(() => {
    const state = this.atRiskState();
    if (!state) {
      return "";
    }
    return this.i18nService.t(
      state.passwordChangeUri ? "atRiskChangePrompt" : "atRiskNavigatePromptV2",
      state.organizationName,
    );
  });
}
