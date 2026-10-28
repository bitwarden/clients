import { LiveAnnouncer } from "@angular/cdk/a11y";
import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { catchError, map, of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  AsyncActionsModule,
  BitwardenIcon,
  ButtonModule,
  CalloutModule,
  CardContentComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  IconTileComponent,
  LinkModule,
  RadioButtonModule,
  SegmentedCardComponent,
  SelectComponent,
  SelectModule,
  SpinnerComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  ImportDestinationKind,
  ImportDestinationOption,
  ImportDestinations,
  ImportResult,
  ImportResultError,
  ImportResultErrorKey,
} from "../../models";
import {
  cloneImportResult,
  countAfterRemoval,
  countCipherTypes,
  ImportDestinationServiceAbstraction,
  ImportStagingServiceAbstraction,
  ImportUpgradeServiceAbstraction,
  ItemTypeCounts,
  StagedImport,
} from "../../services";
import { ImportErrorDialogComponent } from "../dialog";
import { ImportOutcomePresenter } from "../import-confirmation/import-outcome-presenter";
import { FinishedImportOutcome } from "../import-controls/import-outcome";
import { presentImportOutcome } from "../import-controls/present-import-outcome";
import { ImportProgressComponent } from "../import-progress";

type DestinationsState =
  { status: "pending" } | { status: "error" } | { status: "ready"; value: ImportDestinations };

const RESTRICTED_TYPE_KEYS: Record<CipherType, string> = {
  [CipherType.Login]: "importRestrictedTypeLogin",
  [CipherType.SecureNote]: "importRestrictedTypeSecureNote",
  [CipherType.Card]: "importRestrictedTypeCard",
  [CipherType.Identity]: "importRestrictedTypeIdentity",
  [CipherType.SshKey]: "importRestrictedTypeSshKey",
  [CipherType.BankAccount]: "importRestrictedTypeBankAccount",
  [CipherType.DriversLicense]: "importRestrictedTypeDriversLicense",
  [CipherType.Passport]: "importRestrictedTypePassport",
};

const POLICY_HELP_URL = "https://bitwarden.com/help/policies/#manage-item-types";

// Name only: an import error's message can carry item names.
const errorName = (error: unknown): string =>
  error instanceof Error ? error.name : "unknown error";

/**
 * Lets the user choose where the staged items land (My vault, My items, or an organization,
 * optionally in one of its shared folders), then imports them. An organization requires
 * confirming that the data may be shared with its members.
 */
@Component({
  selector: "importer-destination",
  templateUrl: "./import-destination.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    CardContentComponent,
    CheckboxModule,
    FormFieldModule,
    I18nPipe,
    IconTileComponent,
    ImportProgressComponent,
    LinkModule,
    RadioButtonModule,
    ReactiveFormsModule,
    SegmentedCardComponent,
    SelectModule,
    SpinnerComponent,
    TypographyModule,
  ],
})
export class ImportDestinationComponent {
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly syncService = inject(SyncService);
  private readonly presenter = inject(ImportOutcomePresenter);
  private readonly document = inject(DOCUMENT);
  private readonly liveAnnouncer = inject(LiveAnnouncer);
  private readonly destinationService = inject(ImportDestinationServiceAbstraction);
  private readonly stagingService = inject(ImportStagingServiceAbstraction);
  private readonly importService = inject(ImportUpgradeServiceAbstraction);

  /** Fires once the import succeeds, not on button click. */
  readonly continue = output<void>();

  /** Fires when the user clicks Back, after the staged items are dropped. */
  readonly back = output<void>();

  protected readonly policyHelpUrl = POLICY_HELP_URL;

  private readonly state = toSignal(
    this.destinationService.destinations$.pipe(
      map((value): DestinationsState => ({ status: "ready", value })),
      catchError((error: unknown) => {
        this.logService.error("Error loading import destinations:", errorName(error));
        return of<DestinationsState>({ status: "error" });
      }),
    ),
    { initialValue: { status: "pending" } as DestinationsState },
  );

  protected readonly pending = computed(() => this.state().status === "pending");
  protected readonly failed = computed(() => this.state().status === "error");

  private readonly options = computed<readonly ImportDestinationOption[]>(() => {
    const state = this.state();
    return state.status === "ready" ? state.value.options : [];
  });

  // Per-type item counts. Unavailable for an SDK import and for a file only the organization's
  // key can read.
  private readonly typeCounts = this.stagedTypeCounts();

  protected readonly destinationControl = new FormControl("", { nonNullable: true });
  protected readonly moveToSharedFolderControl = new FormControl(false, { nonNullable: true });

  // Custom validator first so its message wins; Validators.required kept so the asterisk renders.
  private readonly sharedFolderRequiredValidator: ValidatorFn = (control: AbstractControl) =>
    control.value != null ? null : this.sharedFolderRequiredError();

  protected readonly sharedFolderControl = new FormControl<CollectionView | null>(null, [
    this.sharedFolderRequiredValidator,
    Validators.required,
  ]);

  private readonly moveToSharedFolderInput = viewChild("moveToSharedFolder", {
    read: ElementRef<HTMLInputElement>,
  });
  private readonly sharedFolderSelect = viewChild(SelectComponent);

  protected readonly formGroup = new FormGroup({
    destination: this.destinationControl,
    moveToSharedFolder: this.moveToSharedFolderControl,
    sharedFolder: this.sharedFolderControl,
  });

  private readonly selectedId = toSignal(this.destinationControl.valueChanges, {
    initialValue: this.destinationControl.value,
  });
  private readonly moveToSharedFolder = toSignal(this.moveToSharedFolderControl.valueChanges, {
    initialValue: this.moveToSharedFolderControl.value,
  });

  protected readonly selectedOption = computed(() =>
    this.options().find((option) => option.id === this.selectedId()),
  );

  // "Location" wording whenever a My items card is offered.
  private readonly usesLocationWording = computed(() =>
    this.options().some((option) => option.kind === ImportDestinationKind.MyItems),
  );

  protected readonly titleKey = computed(() =>
    this.usesLocationWording() ? "selectALocationTitle" : "selectAVaultTitle",
  );

  protected readonly cards = computed(() =>
    this.options().map((option) => ({
      id: option.id,
      icon: this.iconFor(option),
      label: this.labelFor(option),
      hint: this.hintFor(option),
    })),
  );

  protected readonly restrictionCallouts = computed(() =>
    (this.selectedOption()?.restrictions ?? []).map((restriction) => ({
      key: restriction.organizationName,
      text: this.i18nService.t(
        "importItemTypesRestricted",
        restriction.organizationName,
        new Intl.ListFormat(this.document.documentElement.lang || undefined, {
          style: "long",
          type: "conjunction",
        }).format(restriction.types.map((type) => this.i18nService.t(RESTRICTED_TYPE_KEYS[type]))),
      ),
    })),
  );

  // Only an org with a shared folder the user manages offers the choice.
  protected readonly showMoveToSharedFolder = computed(() => {
    const option = this.selectedOption();
    return option?.kind === ImportDestinationKind.Organization && option.sharedFolders.length > 0;
  });

  protected readonly showSharedFolder = computed(
    () => this.showMoveToSharedFolder() && this.moveToSharedFolder(),
  );

  protected readonly moveToSharedFolderLabel = computed(() => {
    const name = this.selectedOption()?.organizationName ?? "";
    return this.i18nService.t(
      /^[aeiou]/i.test(name.trim())
        ? "importMoveAllItemsIntoSharedFolderAn"
        : "importMoveAllItemsIntoSharedFolderA",
      name,
    );
  });

  protected readonly importLabel = computed(() => {
    if (this.typeCounts == null) {
      return this.i18nService.t("importVerb");
    }
    // Same rule as the import filter, so the count matches what is imported.
    const count = countAfterRemoval(this.typeCounts, this.selectedOption()?.removedTypes ?? []);
    return count === 1
      ? this.i18nService.t("importItemsSingular")
      : this.i18nService.t("importItemsCount", count.toString());
  });

  protected readonly importing = signal(false);

  protected readonly importDisabled = computed(
    () => this.state().status !== "ready" || this.options().length === 0,
  );

  constructor() {
    // Drop everything staged, however this screen is left.
    inject(DestroyRef).onDestroy(() => this.stagingService.clear());

    // The first card is selected by default, and again if the list no longer holds the selection.
    effect(() => {
      const options = this.options();
      if (!options.some((option) => option.id === this.destinationControl.value)) {
        this.destinationControl.setValue(options[0]?.id ?? "");
      }
    });

    // The shared folder is never remembered, not even when switching back to an earlier org.
    this.destinationControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.moveToSharedFolderControl.reset(false);
      this.sharedFolderControl.reset(null);
    });

    effect(() => {
      const show = this.showSharedFolder();
      if (show && this.sharedFolderControl.disabled) {
        this.sharedFolderControl.enable();
      } else if (!show && this.sharedFolderControl.enabled) {
        this.sharedFolderControl.disable();
        this.sharedFolderControl.reset(null);
      }
    });

    effect(() => {
      if (this.failed()) {
        this.toastService.showToast({
          variant: "error",
          title: undefined,
          message: this.i18nService.t("errorOccurred"),
        });
      }
    });
  }

  protected onBack(): void {
    this.stagingService.clear();
    this.back.emit();
  }

  protected readonly submit = async (): Promise<void> => {
    const option = this.selectedOption();
    const staged = this.stagingService.current();
    if (option == null || staged == null || this.importDisabled()) {
      return;
    }

    if (this.showSharedFolder() && this.sharedFolderControl.invalid) {
      this.requireSharedFolder();
      return;
    }
    const sharedFolder = this.showSharedFolder() ? this.sharedFolderControl.value : null;
    const isOrganization = option.kind === ImportDestinationKind.Organization;

    let items: ImportResult | undefined;
    try {
      items = await this.prepare(staged, option.organizationId);
    } catch (error) {
      this.reportFailure(error);
      return;
    }

    // Checked before the sharing dialog so the user isn't asked to confirm an import that will be
    // refused. An SDK import has no items to inspect and is always refused for an org without a
    // target.
    if (
      isOrganization &&
      sharedFolder == null &&
      (items == null ||
        (await this.destinationService.hasUnassignedItems(items, option.organizationId)))
    ) {
      this.requireSharedFolder();
      return;
    }

    if (isOrganization && !(await this.confirmSharing(option))) {
      return;
    }

    const target =
      option.kind === ImportDestinationKind.MyItems
        ? option.defaultCollection
        : (sharedFolder ?? undefined);

    this.importing.set(true);
    try {
      let outcome: FinishedImportOutcome;
      try {
        outcome = await this.runImport(staged, items, option.organizationId, target);
      } catch (error) {
        this.reportFailure(error);
        return;
      }

      // Includes the post-import sync, so the progress stays up until the vault is current.
      await presentImportOutcome(
        outcome,
        {
          syncService: this.syncService,
          logService: this.logService,
          presenter: this.presenter,
        },
        staged.kind === "parsed" ? undefined : staged.fileName,
      );
    } finally {
      this.importing.set(false);
    }
    this.stagingService.clear();
    this.continue.emit();
  };

  private stagedTypeCounts(): ItemTypeCounts | undefined {
    const staged = this.stagingService.current();
    switch (staged?.kind) {
      case "file":
        return staged.itemTypeCounts;
      case "parsed":
        return countCipherTypes(staged.result.ciphers);
      default:
        return undefined;
    }
  }

  private confirmSharing(option: ImportDestinationOption): Promise<boolean> {
    return this.dialogService.openSimpleDialog({
      title: { key: "importToOrganization", placeholders: [option.organizationName ?? ""] },
      content: { key: "importDataMayBeShared" },
      type: "warning",
      acceptButtonText: { key: "continue" },
      cancelButtonText: { key: "cancel" },
    });
  }

  private sharedFolderRequiredError() {
    return { sharedFolderRequired: { message: this.i18nService.t("importSharedFolderRequired") } };
  }

  // Shows the inline error on the control the user can act on, and focuses it: the dropdown when
  // the box is checked, otherwise the checkbox, since the dropdown is hidden until it is checked.
  private requireSharedFolder(): void {
    if (this.showSharedFolder()) {
      this.sharedFolderControl.markAsTouched();
      this.sharedFolderSelect()?.select().focus();
      return;
    }
    this.moveToSharedFolderControl.setErrors(this.sharedFolderRequiredError());
    this.moveToSharedFolderControl.markAsTouched();
    this.moveToSharedFolderInput()?.nativeElement.focus();
    // The checkbox's error text has no live region, so screen readers need it announced.
    void this.liveAnnouncer.announce(this.i18nService.t("importSharedFolderRequired"), "assertive");
  }

  private reportFailure(error: unknown): void {
    // Set only by the encrypted Bitwarden JSON importer; shown as a toast, as in credential parsing.
    if (
      error instanceof ImportResultError &&
      error.errorKey === ImportResultErrorKey.AccountMismatch
    ) {
      this.toastService.showToast({
        variant: "error",
        title: undefined,
        message: this.i18nService.t("importAccountMismatchError"),
      });
      return;
    }
    this.logService.error("Import failed:", errorName(error));
    // The dialog reads .message; an unmapped SDK rejection may not be an Error.
    this.dialogService.open(ImportErrorDialogComponent, {
      data: error instanceof Error ? error : new Error(String(error)),
    });
  }

  // The items to import, parsed or reshaped for the destination org (importers shape their output
  // by it). Built fresh on each attempt: the import modifies its input, so a retry on the same
  // object would apply the target twice. Undefined for an SDK import, which parses as it writes.
  private async prepare(
    staged: StagedImport,
    organizationId: OrganizationId | undefined,
  ): Promise<ImportResult | undefined> {
    switch (staged.kind) {
      case "file": {
        const importer = this.importService.getImporter(
          staged.format,
          () => Promise.resolve(staged.filePassword ?? ""),
          organizationId,
        );
        if (importer == null) {
          throw new Error(this.i18nService.t("selectFormat"));
        }
        return this.importService.parse(importer, staged.contents);
      }
      case "parsed": {
        const copy = cloneImportResult(staged.result);
        if (organizationId != null) {
          this.importService.toOrganizationShape(copy, organizationId);
        }
        return copy;
      }
      case "sdk":
        return undefined;
    }
  }

  private async runImport(
    staged: StagedImport,
    items: ImportResult | undefined,
    organizationId: OrganizationId | undefined,
    target: CollectionView | undefined,
  ): Promise<FinishedImportOutcome> {
    if (staged.kind !== "sdk") {
      if (items == null) {
        throw new Error("Nothing was prepared to import.");
      }
      const result = await this.importService.importImportResult(
        items,
        organizationId,
        target,
        false,
      );
      return { kind: "imported", result };
    }

    try {
      const sdkSummary = await this.importService.importWithSdk(
        staged.format,
        staged.file,
        staged.credentials,
        organizationId,
        target,
        false,
      );
      return { kind: "importedWithSdk", sdkSummary };
    } catch (error) {
      this.logService.error("SDK importer error:", errorName(error));
      const messageKey = this.importService.sdkErrorMessageKey(staged.format, error);
      if (messageKey === "invalidFilePassword") {
        // Only the kdbx importer maps to this key; its password is checked here, not while parsing.
        throw new Error(this.i18nService.t("kdbxPasswordInvalid"));
      }
      throw messageKey != null ? new Error(this.i18nService.t(messageKey)) : error;
    }
  }

  private iconFor(option: ImportDestinationOption): BitwardenIcon {
    if (option.kind !== ImportDestinationKind.Organization) {
      return "bwi-user";
    }
    return option.productTierType === ProductTierType.Free ||
      option.productTierType === ProductTierType.Families
      ? "bwi-family"
      : "bwi-business";
  }

  private labelFor(option: ImportDestinationOption): string {
    switch (option.kind) {
      case ImportDestinationKind.MyVault:
        return this.i18nService.t("myVault");
      case ImportDestinationKind.MyItems:
        return this.i18nService.t("importMyItemsOption");
      case ImportDestinationKind.Organization:
        return option.organizationName ?? "";
    }
  }

  private hintFor(option: ImportDestinationOption): string {
    switch (option.kind) {
      case ImportDestinationKind.MyVault:
        return this.i18nService.t("importVisibleOnlyToYou");
      case ImportDestinationKind.MyItems:
        return this.i18nService.t("importMyItemsOwnedBy", option.organizationName ?? "");
      case ImportDestinationKind.Organization:
        return this.i18nService.t(this.organizationHintKey(option));
    }
  }

  private organizationHintKey(option: ImportDestinationOption): string {
    switch (option.productTierType) {
      case ProductTierType.Free:
        return "importSharedWithOnePerson";
      case ProductTierType.Families:
        return "importFamilyVault";
      default:
        return "importOrganizationVault";
    }
  }
}
