import { LiveAnnouncer } from "@angular/cdk/a11y";
import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { catchError, defer, firstValueFrom, map, of, startWith, switchMap } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { BitSvg } from "@bitwarden/assets/svg";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import {
  AsyncActionsModule,
  ButtonModule,
  CardContentComponent,
  DialogService,
  SegmentedCardComponent,
  SpinnerComponent,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { isPasswordProtected } from "@bitwarden/vault-export-core";

import { KeeperRegion } from "../../importers/keeper/access";
import { Loader } from "../../metadata";
import {
  CredentialKind,
  ImportOption,
  ImportResult,
  ImportResultError,
  ImportResultErrorKey,
  ImportType,
  SdkImportCredentials,
  UpgradeImportType,
} from "../../models";
import {
  ImporterProfile,
  ImportUpgradeMetadataServiceAbstraction,
  ImportUpgradeServiceAbstraction,
  readImportFileContents,
} from "../../services";
import { chromiumLoginsToCsv } from "../chrome/chromium-login-csv";
import {
  FilePasswordPromptComponent,
  ImportErrorDialogComponent,
  ImportSkippedItemsDialogComponent,
  ImportSuccessDialogComponent,
} from "../dialog";
import { pickerIconFor } from "../import-source-select/import-source-picker-metadata";
import {
  pickerAlwaysPromptsFormat,
  pickerDisplayNameFor,
  pickerFormatsFor,
} from "../import-source-select/picker-vendor-data";

import { KeeperDirectImportRunner } from "./direct/keeper-direct-import-runner";
import { LastPassDirectImportRunner } from "./direct/lastpass-direct-import-runner";
import { ImportControlsChromiumComponent } from "./import-controls-chromium.component";
import { DirectStep, ImportControlsDirectComponent } from "./import-controls-direct.component";
import { ImportControlsManualComponent } from "./import-controls-manual.component";
import { ImportOutcome } from "./import-outcome";
import {
  detectPasteContentShape,
  expectedPasteShapeFor,
  vendorSupportsPasteShapeNarrowing,
} from "./paste-content-shape";

/** How import data is provided: vendor direct importer, Chromium importer, or file/paste. */
type ImportStrategy = "direct" | "chromium" | "manual";

const dedupe = (values: readonly string[]): readonly string[] => Array.from(new Set(values));

const toHint = (picked: readonly string[] | undefined, union: readonly string[]): string =>
  (picked?.length ? picked : union).map((type) => `.${type}`).join(", ");

function setEnabled(control: FormControl<unknown>, enabled: boolean): void {
  if (enabled && control.disabled) {
    control.enable();
  } else if (!enabled && control.enabled) {
    control.disable();
  }
}

// Unlike Validators.required, also rejects whitespace-only content.
const requiredTrimmedValidator: ValidatorFn = (control: AbstractControl<string>) =>
  control.value == null || control.value.trim() === "" ? { required: true } : null;

@Component({
  selector: "importer-controls",
  templateUrl: "./import-controls.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CardContentComponent,
    I18nPipe,
    ImportControlsChromiumComponent,
    ImportControlsDirectComponent,
    ImportControlsManualComponent,
    ReactiveFormsModule,
    SegmentedCardComponent,
    SpinnerComponent,
  ],
  // Scoped to the component: they inject ImportUpgradeServiceAbstraction, which the host components provide.
  providers: [KeeperDirectImportRunner, LastPassDirectImportRunner],
})
export class ImportControlsComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly liveAnnouncer = inject(LiveAnnouncer);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly policyService = inject(PolicyService);
  private readonly accountService = inject(AccountService);
  private readonly syncService = inject(SyncService);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly importService = inject(ImportUpgradeServiceAbstraction);
  private readonly importMetadataService = inject(ImportUpgradeMetadataServiceAbstraction);
  private readonly themingService = inject(AbstractThemingService);

  /** The vendor chosen in step 1. */
  readonly importType = input.required<UpgradeImportType>();

  /** Fires once the import succeeds, not on button click. */
  readonly continue = output<void>();

  /** Fires when the user clicks Back. */
  readonly back = output<void>();

  private readonly clientType = this.platformUtilsService.getClientType();

  /** The vendor's `ImportOption`; format-specific instructions come from `activeInstructions`. */
  protected readonly vendor = computed<ImportOption>(() =>
    this.importService.getImportOption(this.importType())!,
  );

  /** The vendor name to interpolate. */
  protected readonly vendorName = computed(() => pickerDisplayNameFor(this.importType()));

  /** Some vendor marks need a dark-theme variant (`PickerVendorIcon.darkIcon`). */
  private readonly isDarkTheme = toSignal(
    this.themingService.theme$.pipe(map((theme) => theme === ThemeTypes.Dark)),
    { initialValue: false },
  );

  /** The vendor's logo on the direct-importer login screen. Absent for vendors with no icon. */
  protected readonly vendorIcon = computed<BitSvg | undefined>(() =>
    pickerIconFor(this.importType(), this.isDarkTheme()),
  );

  private readonly formatOptions = computed<ImportOption[]>(() =>
    pickerFormatsFor(this.importType())
      .map((id) => this.importService.getImportOption(id))
      .filter((option): option is ImportOption => option != null),
  );

  protected readonly acceptedFileTypes = computed(() =>
    dedupe(this.formatOptions().flatMap((option) => option.acceptedFileTypes)),
  );

  protected readonly pasteFormats = computed(() =>
    dedupe(this.formatOptions().flatMap((option) => option.pasteFormats)),
  );

  // Follows the selected format so the OS picker filter matches the hint.
  protected readonly fileAccept = computed(() =>
    (this.selectedFormat()?.acceptedFileTypes ?? this.acceptedFileTypes())
      .map((type) => `.${type}`)
      .join(","),
  );

  /** The extensions shown to the user: the selected format's (1Password's .1pux advertises only
   *  .1pux), else the vendor's union. */
  private readonly displayedFileTypes = computed<readonly string[]>(() => {
    const selected = this.selectedFormat();
    const picked = selected?.id === "1password1pux" ? ["1pux"] : selected?.acceptedFileTypes;
    return picked?.length ? picked : this.acceptedFileTypes();
  });

  protected readonly acceptedFileTypesHint = computed(() =>
    this.displayedFileTypes()
      .map((type) => `.${type}`)
      .join(", "),
  );
  protected readonly pasteFormatsHint = computed(() =>
    toHint(this.selectedFormat()?.pasteFormats, this.pasteFormats()),
  );

  private readonly importType$ = toObservable(this.importType);

  // Subscribes after init(), which discovers browsers on Desktop. `resolved` separates loading from failed.
  private readonly capabilities = toSignal(
    defer(() => this.importMetadataService.init()).pipe(
      switchMap(() => this.importMetadataService.metadata$(this.importType$)),
      // A rejected init() would make toSignal rethrow on every read and crash the template.
      catchError(() => of(undefined)),
      map((value) => ({ resolved: true, value })),
    ),
    { initialValue: { resolved: false, value: undefined } },
  );

  // Ignores the previous vendor's loaders until metadata$ re-emits after an importType() change.
  protected readonly isChromiumAvailable = computed(() => {
    const capabilities = this.capabilities().value;
    return (
      capabilities?.type === this.importType() && capabilities.loaders.includes(Loader.chromium)
    );
  });

  // Avoids flashing the manual UI for browser vendors while capabilities load.
  protected readonly capabilitiesPending = computed(
    () => this.vendor().isBrowser && !this.capabilities().resolved,
  );

  protected readonly isVendorDirectAvailable = computed(() => {
    const vendor = this.vendor();
    return (
      vendor.hasDirectImporter &&
      !vendor.isBrowser &&
      (this.clientType === ClientType.Desktop || this.clientType === ClientType.Browser)
    );
  });

  protected readonly hasAlternate = computed(
    () => this.isVendorDirectAvailable() || this.isChromiumAvailable(),
  );

  protected readonly defaultPrimaryMode = computed<ImportStrategy>(() => {
    if (this.isVendorDirectAvailable()) {
      return "direct";
    }
    if (this.isChromiumAvailable()) {
      return "chromium";
    }
    return "manual";
  });

  // `undefined` until the footer link is used
  private readonly primaryModeOverride = signal<ImportStrategy | undefined>(undefined);
  protected readonly primaryMode = computed<ImportStrategy>(
    () => this.primaryModeOverride() ?? this.defaultPrimaryMode(),
  );

  private readonly chromiumProfilesFor = computed<UpgradeImportType | undefined>(() =>
    this.primaryMode() === "chromium" ? this.importType() : undefined,
  );

  private readonly profilesResult = toSignal(
    toObservable(this.chromiumProfilesFor).pipe(
      switchMap((type) =>
        type
          ? defer(() => this.importMetadataService.getAvailableProfiles(type)).pipe(
              map((profiles) => ({
                resolved: true,
                profiles,
                error:
                  profiles.length === 0
                    ? this.i18nService.t("noBrowserProfilesFound")
                    : (undefined as string | undefined),
              })),
              catchError((error: unknown) => {
                this.logService.error("Error loading chromium profiles:", error);
                const message =
                  error instanceof Error ? error.message : this.i18nService.t("errorOccurred");
                return of({ resolved: true, profiles: [] as ImporterProfile[], error: message });
              }),
              startWith({
                resolved: false,
                profiles: [] as ImporterProfile[],
                error: undefined as string | undefined,
              }),
            )
          : of({
              resolved: true,
              profiles: [] as ImporterProfile[],
              error: undefined as string | undefined,
            }),
      ),
    ),
    {
      initialValue: {
        resolved: false,
        profiles: [] as ImporterProfile[],
        error: undefined as string | undefined,
      },
    },
  );

  protected readonly profiles = computed(() => this.profilesResult().profiles);
  protected readonly profilesError = computed(() => this.profilesResult().error);
  // requestBrowserAccess can block on an OS permission prompt; avoids an empty select meanwhile.
  protected readonly profilesPending = computed(
    () => this.primaryMode() === "chromium" && !this.profilesResult().resolved,
  );

  protected readonly directStep = signal<DirectStep>("intro");

  // No initialValue: Continue stays blocked until this resolves. "error" (null account or failed
  // lookup) fails closed without blaming the org policy.
  private readonly personalOwnershipPolicyApplies = toSignal(
    this.accountService.activeAccount$.pipe(
      switchMap((account) => {
        if (account == null) {
          return of("error" as const);
        }
        return this.policyService
          .policyAppliesToUser$(PolicyType.OrganizationDataOwnership, account.id)
          .pipe(
            catchError((error: unknown) => {
              this.logService.error("Error checking personal ownership policy:", error);
              return of("error" as const);
            }),
          );
      }),
    ),
  );

  protected readonly personalOwnershipPolicyPending = computed(
    () => this.personalOwnershipPolicyApplies() === undefined,
  );

  // Single source for submit()'s gate and the button's [disabled].
  protected readonly continueBlocked = computed(
    () =>
      this.capabilitiesPending() ||
      this.profilesPending() ||
      this.personalOwnershipPolicyPending() ||
      this.filePasswordCheckPending(),
  );

  protected readonly isKeeper = computed(() => this.importType() === "keeper");
  protected readonly isLastPass = computed(() => this.importType() === "lastpasscsv");

  /** Replaces the generic required message. */
  private readonly masterPasswordRequiredValidator: ValidatorFn = (control) =>
    (control.value ?? "").length > 0
      ? null
      : { kdbxPasswordRequired: { message: this.i18nService.t("kdbxPasswordRequired") } };

  /** Replaces the generic required message. */
  private readonly filePasswordRequiredValidator: ValidatorFn = (control) =>
    (control.value ?? "").length > 0
      ? null
      : { filePasswordRequired: { message: this.i18nService.t("filePasswordRequired") } };

  /** Pasted content must look like the selected format (dropdown vendors only; the dropdown is
   *  never changed by what is pasted). Formats with no distinguishable shape never mismatch. */
  private readonly pasteShapeValidator: ValidatorFn = (control: AbstractControl<string>) => {
    const selected = this.selectedFormat();
    const content = control.value ?? "";
    const expected = selected ? expectedPasteShapeFor(selected) : undefined;
    if (!expected || content.trim() === "" || detectPasteContentShape(content) === expected) {
      return null;
    }
    return {
      pasteContentFormatMismatch: {
        message: this.i18nService.t("pasteContentFormatMismatch"),
      },
    };
  };

  /** The chosen file's extension must be one the selected format (else the vendor) accepts. The
   *  picker's accept filter is only advisory, so this is what actually blocks a wrong file. */
  private readonly fileTypeSupportedValidator: ValidatorFn = (
    control: AbstractControl<File | null>,
  ) => {
    // Read before the early return so the effect that revalidates tracks the selection.
    const accepted = this.selectedFormat()?.acceptedFileTypes ?? this.acceptedFileTypes();
    const file = control.value;
    if (file == null) {
      return null;
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (accepted.includes(extension)) {
      return null;
    }
    const types = new Intl.ListFormat(this.document.documentElement.lang || undefined, {
      style: "long",
      type: "disjunction",
    }).format(this.displayedFileTypes().map((type) => `.${type}`));
    return {
      fileTypeNotSupported: { message: this.i18nService.t("fileTypeNotSupported", types) },
    };
  };

  protected readonly formGroup = this.formBuilder.group({
    keeperEmail: [{ value: "", disabled: true }, [Validators.required, Validators.email]],
    keeperRegion: this.formBuilder.nonNullable.control<KeeperRegion>(KeeperRegion.Us),
    lastPassEmail: [{ value: "", disabled: true }, [Validators.required, Validators.email]],
    includeSharedFolders: [false],
    // Custom validator first so its message wins.
    kdbxPassword: [
      { value: "", disabled: true },
      [this.masterPasswordRequiredValidator, Validators.required],
    ],
    keyFile: [{ value: null as File | null, disabled: true }],

    // Only for password-protected Bitwarden JSON.
    filePassword: [
      { value: "", disabled: true },
      [this.filePasswordRequiredValidator, Validators.required],
    ],

    profile: [{ value: "", disabled: true }, Validators.required],

    method: this.formBuilder.nonNullable.control<"file" | "paste">("file"),
    file: [null as File | null],
    fileContents: this.formBuilder.nonNullable.control(""),

    // See showFormatChoice().
    formatChoice: [{ value: null as ImportType | null, disabled: true }, Validators.required],
  });

  protected readonly method = toSignal(this.formGroup.controls.method.valueChanges, {
    initialValue: this.formGroup.controls.method.value,
  });

  private readonly chosenFile = toSignal(this.formGroup.controls.file.valueChanges, {
    initialValue: this.formGroup.controls.file.value,
  });
  protected readonly chosenFileName = computed(() => this.chosenFile()?.name);

  protected readonly pastedContent = toSignal(this.formGroup.controls.fileContents.valueChanges, {
    initialValue: this.formGroup.controls.fileContents.value,
  });

  /** Candidate formats: by extension (file mode) or content shape/sibling list (paste mode). */
  protected readonly candidateFormats = computed<ImportOption[]>(() => {
    if (this.method() === "paste") {
      const content = this.pastedContent();
      if (!content.trim()) {
        return [];
      }
      const candidates = this.formatOptions().filter((option) => option.pasteFormats.length > 0);
      if (!vendorSupportsPasteShapeNarrowing(this.importType())) {
        return candidates;
      }
      const shape = detectPasteContentShape(content);
      const narrowed = candidates.filter((option) => expectedPasteShapeFor(option) === shape);
      return narrowed.length > 0 ? narrowed : candidates;
    }

    // chosenFile(), not chosenFileName(): a same-named re-pick must still recompute.
    const extension = this.chosenFile()?.name.split(".").pop()?.toLowerCase();
    return extension
      ? this.formatOptions().filter((option) => option.acceptedFileTypes.includes(extension))
      : [];
  });

  protected readonly needsFormatDisambiguation = computed(() => this.candidateFormats().length > 1);

  protected readonly alwaysPromptFormat = computed(() =>
    pickerAlwaysPromptsFormat(this.importType()),
  );

  /** Shown on an extension collision, or always for always-prompt vendors. */
  protected readonly showFormatChoice = computed(
    () => this.needsFormatDisambiguation() || this.alwaysPromptFormat(),
  );

  /** Every sibling format, regardless of what was uploaded or pasted; paste mode excludes formats
   *  that can't be pasted. */
  protected readonly formatChoiceOptions = computed<ImportOption[]>(() => {
    const options = this.formatOptions();
    return this.method() === "paste"
      ? options.filter((option) => option.pasteFormats.length > 0)
      : options;
  });

  /** Primary extension (".1pif"), or the full name if it collides with another option's. */
  protected formatChoiceLabel(candidate: ImportOption): string {
    if (candidate.id === "1password1pux") {
      return candidate.acceptedFileTypes.map((extension) => `.${extension}`).join("/");
    }
    const extensionsFor = (option: ImportOption) =>
      this.method() === "paste" ? option.pasteFormats : option.acceptedFileTypes;
    const extensions = extensionsFor(candidate);
    if (extensions.length === 0) {
      return candidate.name;
    }
    const options = this.formatChoiceOptions();
    const sharesAnyExtension = extensions.some((extension) =>
      options.some(
        (option) => option.id !== candidate.id && extensionsFor(option).includes(extension),
      ),
    );
    return sharesAnyExtension ? candidate.name : `.${extensions[0]}`;
  }

  protected readonly formatChoiceItems = computed(() =>
    this.formatChoiceOptions().map((candidate) => ({
      id: candidate.id,
      label: this.formatChoiceLabel(candidate),
    })),
  );

  private readonly formatChoice = toSignal(this.formGroup.controls.formatChoice.valueChanges, {
    initialValue: this.formGroup.controls.formatChoice.value,
  });

  private readonly selectedFormat = computed<ImportOption | undefined>(() =>
    this.formatChoiceActive()
      ? this.formatOptions().find((option) => option.id === this.formatChoice())
      : undefined,
  );

  /** Distinguishes "nothing chosen yet" from "chose something matching no format". */
  private readonly hasAttemptedContent = computed(() =>
    this.method() === "paste" ? this.pastedContent().trim().length > 0 : this.chosenFile() != null,
  );

  /** Set by the effect below so the template and the control's enabled state can't diverge. */
  protected readonly formatChoiceActive = signal(false);

  protected readonly resolvedFormat = computed<ImportType | undefined>(() => {
    const candidates = this.candidateFormats();
    if (this.formatChoiceActive()) {
      // The dropdown decides; what was uploaded never does. An extension matching none of this
      // vendor's formats is still unsupported, whatever is selected.
      return candidates.length === 0 && this.hasAttemptedContent()
        ? undefined
        : (this.formatChoice() ?? undefined);
    }
    if (candidates.length === 1) {
      return candidates[0].id as ImportType;
    }
    if (candidates.length > 1) {
      return this.formatChoice() ?? undefined;
    }
    return undefined;
  });

  protected readonly activeInstructions = computed<ImportOption>(() => {
    const resolved = this.resolvedFormat();
    if (!resolved) {
      return this.vendor();
    }
    const option = this.formatOptions().find((option) => option.id === resolved);
    if (!option || (!option.instructionLink && !option.instructionKey)) {
      return this.vendor();
    }
    return option;
  });

  // kdbx can't be pasted, so this only resolves in file mode.
  protected readonly needsKdbxCredentials = computed(() => this.resolvedFormat() === "keepasskdbx");

  // Starts hidden behind an "Add key file" link — most kdbx imports don't need it.
  protected readonly showKeyFile = signal(false);

  // Peeks a chosen bitwardenjson file to detect password protection before Continue. "pending"
  // holds Continue until the read settles.
  private readonly filePasswordCheck = toSignal(
    toObservable(this.chosenFile).pipe(
      switchMap((file) => {
        // resolvedFormat(), not importType(): the Bitwarden card also covers CSV, which can't be JSON-parsed.
        if (this.resolvedFormat() !== "bitwardenjson" || file == null) {
          return of("not-protected" as const);
        }
        return defer(() => readImportFileContents("bitwardenjson", file)).pipe(
          map((contents) =>
            isPasswordProtected(JSON.parse(contents))
              ? ("protected" as const)
              : ("not-protected" as const),
          ),
          startWith("pending" as const),
          catchError((error: unknown) => {
            // Name only: JSON.parse's message embeds file content.
            this.logService.error(
              "Error peeking at chosen file for password protection:",
              error instanceof Error ? error.name : "unknown error",
            );
            return of("not-protected" as const);
          }),
        );
      }),
    ),
    { initialValue: "not-protected" as const },
  );

  protected readonly filePasswordCheckPending = computed(
    () => this.filePasswordCheck() === "pending",
  );

  // File mode only: a method switch keeps the chosen file, so without this check the field would
  // stay enabled but unrendered in paste mode and block submit.
  private readonly isFilePasswordProtected = computed(
    () =>
      this.method() === "file" &&
      this.resolvedFormat() === "bitwardenjson" &&
      this.filePasswordCheck() === "protected",
  );

  // Set by Continue, so the password card replaces the upload card then and not on file pick.
  private readonly filePasswordRequested = signal(false);

  protected readonly needsFilePassword = computed(
    () => this.isFilePasswordProtected() && this.filePasswordRequested(),
  );

  /** An always-prompt vendor's selection per method, so file, paste, file restores it even though
   *  paste can't offer every format (kdbx). */
  private readonly formatChoiceByMethod = new Map<"file" | "paste", ImportType | null>();

  constructor() {
    let previousMethod = this.formGroup.controls.method.value;
    this.formGroup.controls.method.valueChanges.pipe(takeUntilDestroyed()).subscribe((method) => {
      this.formatChoiceByMethod.set(previousMethod, this.formGroup.controls.formatChoice.value);
      previousMethod = method;
      this.filePasswordRequested.set(false);
      // An always-prompt vendor's selection is the user's and survives the switch; the seeding
      // effect replaces it only if the new method can't offer it (kdbx can't be pasted).
      if (!this.alwaysPromptFormat()) {
        this.formGroup.controls.formatChoice.reset(null);
      } else {
        const remembered = this.formatChoiceByMethod.get(method);
        if (remembered != null) {
          this.formGroup.controls.formatChoice.setValue(remembered);
        }
      }
      // Not reset(): the file and pasted content survive the switch.
      this.formGroup.controls.file.markAsUntouched();
      this.formGroup.controls.fileContents.markAsUntouched();
    });

    // For a dropdown shown only because an upload collided: first pick keeps a still-valid
    // pre-file answer; replacing a file always resets it. An always-prompt vendor's selection is
    // never touched by an upload.
    let previousFile: File | null = null;
    this.formGroup.controls.file.valueChanges.pipe(takeUntilDestroyed()).subscribe((file) => {
      this.filePasswordRequested.set(false);
      const current = this.formGroup.controls.formatChoice.value;
      const keepCurrent =
        previousFile == null && this.candidateFormats().some((option) => option.id === current);
      if (!keepCurrent && !this.alwaysPromptFormat()) {
        this.formGroup.controls.formatChoice.reset(null);
      }
      if (previousFile != null && previousFile !== file) {
        // Identity check: valueChanges can re-emit the same File. reset() also clears stale errors.
        this.formGroup.controls.kdbxPassword.reset("");
        this.formGroup.controls.keyFile.setValue(null);
        this.showKeyFile.set(false);
        this.formGroup.controls.filePassword.reset("");
      }
      previousFile = file;
    });

    // Resets only when the candidate set changes. Never keeps a pre-content pick, which would
    // always look valid and silently answer the disambiguation.
    let previousCandidateIds: string | null = null;
    this.formGroup.controls.fileContents.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const currentCandidateIds = this.candidateFormats()
        .map((option) => option.id)
        .join(",");
      if (currentCandidateIds !== previousCandidateIds && !this.alwaysPromptFormat()) {
        this.formGroup.controls.formatChoice.reset(null);
      }
      previousCandidateIds = currentCandidateIds;
    });

    effect(() => {
      const onCredentialsStep =
        this.primaryMode() === "direct" && this.directStep() === "credentials";
      const keeperActive = onCredentialsStep && this.isKeeper();
      const lastPassActive = onCredentialsStep && this.isLastPass();
      setEnabled(this.formGroup.controls.keeperEmail, keeperActive);
      setEnabled(this.formGroup.controls.keeperRegion, keeperActive);
      setEnabled(this.formGroup.controls.lastPassEmail, lastPassActive);
      setEnabled(this.formGroup.controls.includeSharedFolders, lastPassActive);
    });

    effect(() => {
      const active = this.primaryMode() === "chromium";
      setEnabled(this.formGroup.controls.profile, active);
      if (!active) {
        this.formGroup.controls.profile.reset("");
      }
    });

    effect(() => {
      const error = this.profilesError();
      if (error) {
        void this.liveAnnouncer.announce(error, "assertive");
      }
    });

    effect(() => {
      const manualActive = this.primaryMode() === "manual";
      setEnabled(this.formGroup.controls.method, manualActive);
      setEnabled(this.formGroup.controls.file, manualActive);
      setEnabled(this.formGroup.controls.fileContents, manualActive);
    });

    effect(() => {
      const fileRequired = this.method() === "file";
      this.formGroup.controls.file.setValidators(
        fileRequired ? [Validators.required, this.fileTypeSupportedValidator] : [],
      );
      this.formGroup.controls.file.updateValueAndValidity();
    });

    // Validators.required kept so the required asterisk still renders.
    effect(() => {
      const pasteRequired = this.method() === "paste";
      this.formGroup.controls.fileContents.setValidators(
        pasteRequired
          ? [Validators.required, requiredTrimmedValidator, this.pasteShapeValidator]
          : [],
      );
      this.formGroup.controls.fileContents.updateValueAndValidity();
    });

    effect(() => {
      const active = this.needsKdbxCredentials();
      setEnabled(this.formGroup.controls.kdbxPassword, active);
      setEnabled(this.formGroup.controls.keyFile, active && this.showKeyFile());
      if (!active) {
        this.showKeyFile.set(false);
        this.formGroup.controls.kdbxPassword.reset("");
        this.formGroup.controls.keyFile.setValue(null);
      }
    });

    effect(() => {
      const active = this.needsFilePassword();
      setEnabled(this.formGroup.controls.filePassword, active);
      if (!active) {
        this.formGroup.controls.filePassword.reset("");
      }
    });

    // "polite": informational, unlike profilesError.
    effect(() => {
      if (this.needsFilePassword()) {
        void this.liveAnnouncer.announce(this.i18nService.t("filePassword"), "polite");
      }
    });

    let previousImportType: UpgradeImportType | undefined;
    effect(() => {
      const current = this.importType();
      const isRealChange = previousImportType !== undefined && previousImportType !== current;
      previousImportType = current;
      if (!isRealChange) {
        return;
      }

      this.primaryModeOverride.set(undefined);
      this.directStep.set("intro");
      this.showKeyFile.set(false);
      this.formGroup.reset({
        keeperEmail: "",
        keeperRegion: KeeperRegion.Us,
        lastPassEmail: "",
        includeSharedFolders: false,
        profile: "",
        method: "file",
        file: null,
        fileContents: "",
        kdbxPassword: "",
        keyFile: null,
        filePassword: "",
        formatChoice: null,
      });
      this.formatChoiceByMethod.clear();
    });

    // Declared last so it seeds after the importType() reset effect.
    effect(() => {
      const active = this.primaryMode() === "manual" && this.showFormatChoice();
      this.formatChoiceActive.set(active);
      setEnabled(this.formGroup.controls.formatChoice, active);
      if (!active) {
        this.formGroup.controls.formatChoice.reset(null);
        return;
      }
      // A dropdown shown only because an upload collided has no default to seed; an always-prompt
      // vendor's dropdown is always seeded and keeps its selection across uploads.
      if (this.needsFormatDisambiguation() && !this.alwaysPromptFormat()) {
        return;
      }
      const options = this.formatChoiceOptions();
      const current = this.formGroup.controls.formatChoice.value;
      if (!options.some((option) => option.id === current)) {
        this.formGroup.controls.formatChoice.setValue((options[0]?.id as ImportType) ?? null);
      }
    });
  }
  protected onBack(): void {
    if (this.needsFilePassword()) {
      // Back from the password card returns to upload; clearing the file also drops the card.
      this.formGroup.controls.file.reset(null);
      return;
    }
    this.back.emit();
  }

  protected toggleToManual(): void {
    this.primaryModeOverride.set("manual");
    this.directStep.set("intro");
    // touched survives disable/enable; clear it to avoid a stale error.
    this.formGroup.controls.file.markAsUntouched();
    this.formGroup.controls.fileContents.markAsUntouched();
  }

  protected toggleToAlternate(): void {
    this.primaryModeOverride.set(undefined);
    this.directStep.set("intro");
    this.formGroup.controls.profile.markAsUntouched();
  }

  protected continueFromIntro(): void {
    // touched survives disable/enable; clear it to avoid a stale error.
    this.formGroup.controls.keeperEmail.markAsUntouched();
    this.formGroup.controls.lastPassEmail.markAsUntouched();
    this.directStep.set("credentials");
  }

  protected addKeyFile(): void {
    this.showKeyFile.set(true);
  }

  protected async onContinue(): Promise<void> {
    if (this.blockedByPersonalOwnershipPolicy()) {
      return;
    }

    let outcome: ImportOutcome;
    try {
      outcome = await this.runImport();
    } catch (error) {
      this.logService.error(error);
      // The dialog reads .message; an unmapped SDK rejection may not be an Error.
      this.dialogService.open(ImportErrorDialogComponent, {
        data: error instanceof Error ? error : new Error(String(error)),
      });
      return;
    }

    if (outcome.kind === "cancelled") {
      return;
    }

    // Before the dialog so Continue's spinner covers the wait. Failures are only logged.
    try {
      const synced = await this.syncService.fullSync(true);
      if (!synced) {
        // An ordinary failure resolves false rather than throwing.
        this.logService.warning("Post-import sync did not complete");
      }
    } catch (error) {
      this.logService.error("Post-import sync failed:", error);
    }

    if (outcome.kind === "imported" && outcome.result.errors.length > 0) {
      this.dialogService.open(ImportSkippedItemsDialogComponent, {
        data: { errors: outcome.result.errors },
      });
    } else {
      this.dialogService.open(ImportSuccessDialogComponent, {
        data:
          outcome.kind === "imported"
            ? { importResult: outcome.result }
            : { sdkSummary: outcome.sdkSummary },
      });
    }

    this.continue.emit();
  }

  // Pending and "error" both block, without blaming the org policy.
  private blockedByPersonalOwnershipPolicy(): boolean {
    const policyApplies = this.personalOwnershipPolicyApplies();
    if (policyApplies === false) {
      return false;
    }

    this.toastService.showToast({
      variant: "error",
      title: undefined,
      message: this.i18nService.t(
        policyApplies === true ? "personalOwnershipPolicyInEffectImports" : "errorOccurred",
      ),
    });
    return true;
  }

  private async runImport(): Promise<ImportOutcome> {
    if (this.primaryMode() === "direct") {
      if (this.isKeeper()) {
        return this.injector
          .get(KeeperDirectImportRunner)
          .run(this.formGroup.controls.keeperEmail, this.formGroup.controls.keeperRegion);
      }
      if (this.isLastPass()) {
        return this.injector
          .get(LastPassDirectImportRunner)
          .run(
            this.formGroup.controls.lastPassEmail,
            this.formGroup.controls.includeSharedFolders,
            (csv) => this.runGenericImport("lastpasscsv", csv),
          );
      }
      // Direct vendor with no handler wired up.
      throw new Error(`No direct-import handler is wired up for vendor: ${this.importType()}`);
    }
    if (this.primaryMode() === "chromium") {
      return this.runChromiumImport();
    }
    return this.runManualImport();
  }

  private async runChromiumImport(): Promise<ImportOutcome> {
    const logins = await this.importMetadataService.getChromiumLogins(
      this.importType(),
      this.formGroup.controls.profile.value!,
    );

    const csvResult = chromiumLoginsToCsv(logins);
    if ("errorKey" in csvResult) {
      if (csvResult.errorKey === "errorOccurred") {
        this.logService.error("Chromium importer failure:", csvResult.failureDetail);
      }
      throw new Error(this.i18nService.t(csvResult.errorKey));
    }

    return {
      kind: "imported",
      result: await this.runGenericImport(this.importType(), csvResult.csv),
    };
  }

  private unresolvedImportMessageKey(): string {
    if (this.candidateFormats().length > 1) {
      return "selectFormat";
    }
    if (this.method() === "paste") {
      return "pasteContentRequired";
    }
    return this.chosenFileName() != null ? "selectFileUnsupportedType" : "selectFile";
  }

  private async runManualImport(): Promise<ImportOutcome> {
    const format = this.resolvedFormat();
    if (format == null) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t(this.unresolvedImportMessageKey()),
      });
      return { kind: "cancelled" };
    }

    if (this.filePasswordCheckPending()) {
      // Defensive: submit() already gates on continueBlocked().
      return { kind: "cancelled" };
    }

    if (this.importService.getImportOption(format)?.sdk != null) {
      return this.runSdkImport(format);
    }

    // Read before the await: the peek can resolve mid-await and reset filePassword.
    const needsPassword = this.needsFilePassword();
    const password = this.formGroup.controls.filePassword.value ?? "";

    const contents =
      this.method() === "paste" ? this.pastedContent() : await this.readChosenFileContents(format);

    if (needsPassword) {
      return this.runFilePasswordProtectedImport(format, contents, password);
    }

    try {
      return { kind: "imported", result: await this.runGenericImport(format, contents) };
    } catch (error) {
      // Set only by UpgradeBitwardenEncryptedJsonImporter; shown as a toast, not the error dialog.
      if (
        error instanceof ImportResultError &&
        error.errorKey === ImportResultErrorKey.AccountMismatch
      ) {
        this.toastService.showToast({
          variant: "error",
          title: undefined,
          message: this.i18nService.t("importAccountMismatchError"),
        });
        return { kind: "cancelled" };
      }
      throw error;
    }
  }

  /** Uses the inline password; a wrong one is shown inline, not in the error dialog. */
  private async runFilePasswordProtectedImport(
    format: ImportType,
    contents: string,
    password: string,
  ): Promise<ImportOutcome> {
    try {
      const result = await this.runGenericImport(format, contents, () => Promise.resolve(password));
      return { kind: "imported", result };
    } catch (error) {
      if (
        error instanceof ImportResultError &&
        error.errorKey === ImportResultErrorKey.InvalidFilePassword
      ) {
        this.formGroup.controls.filePassword.setErrors({
          invalidFilePassword: { message: this.i18nService.t("filePasswordInvalid") },
        });
        this.formGroup.controls.filePassword.markAsTouched();
        return { kind: "cancelled" };
      }
      throw error;
    }
  }

  // Caller guarantees a chosen file exists here; empty/unreadable content throws errorReadingFile.
  private async readChosenFileContents(format: ImportType): Promise<string> {
    const file = this.chosenFile()!;
    let contents: string;
    try {
      contents = await readImportFileContents(format, file);
    } catch (error) {
      this.logService.error(error);
      throw new Error(this.i18nService.t("errorReadingFile"));
    }
    if (contents.trim() === "") {
      throw new Error(this.i18nService.t("errorReadingFile"));
    }
    return contents;
  }

  private async runSdkImport(format: ImportType): Promise<ImportOutcome> {
    const file = this.chosenFile();
    if (file == null) {
      // Defensive: unreachable through the UI.
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("selectFile"),
      });
      return { kind: "cancelled" };
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    if (fileBytes.length === 0) {
      // A file was chosen, so this is a bad-file error.
      throw new Error(this.i18nService.t("errorReadingFile"));
    }

    const credentials = await this.collectSdkCredentials(
      this.importService.getImportOption(format)?.sdk?.credentialKind,
    );
    if (credentials == null) {
      // Credentials dialog dismissed.
      return { kind: "cancelled" };
    }

    try {
      const sdkSummary = await this.importService.importWithSdk(
        format,
        fileBytes,
        credentials,
        undefined,
        undefined,
        false,
      );
      return { kind: "importedWithSdk", sdkSummary };
    } catch (error) {
      // Mirrors legacy's SDK error mapping.
      this.logService.error("SDK importer error:", error);
      const messageKey = this.importService.sdkErrorMessageKey(format, error);
      if (messageKey === "invalidFilePassword") {
        // Only the kdbx importer maps to this key; shown inline.
        this.formGroup.controls.kdbxPassword.setErrors({
          kdbxPasswordInvalid: { message: this.i18nService.t("kdbxPasswordInvalid") },
        });
        this.formGroup.controls.kdbxPassword.markAsTouched();
        return { kind: "cancelled" };
      }
      throw messageKey != null ? new Error(this.i18nService.t(messageKey)) : error;
    }
  }

  /** Dispatches on the format's declared SDK credential kind, matching legacy's own logic. */
  private async collectSdkCredentials(
    kind: CredentialKind | undefined,
  ): Promise<SdkImportCredentials | null> {
    switch (kind) {
      case CredentialKind.none:
        return { kind: "none" };
      case CredentialKind.password: {
        const password = await this.promptForPassword();
        return password === "" ? null : { kind: "password", password };
      }
      case CredentialKind.passwordWithKeyFile: {
        const keyFile = this.formGroup.controls.keyFile.value;
        return {
          kind: "passwordWithKeyFile",
          password: this.formGroup.controls.kdbxPassword.value ?? "",
          keyFile: keyFile ? new Uint8Array(await keyFile.arrayBuffer()) : null,
        };
      }
      default:
        // SDK credential kind with no collector wired up.
        throw new Error(`No SDK credential collector is wired up for kind: ${kind}`);
    }
  }

  private async promptForPassword(): Promise<string> {
    const dialog = this.dialogService.open<string>(FilePasswordPromptComponent, {
      ariaModal: true,
    });
    return (await firstValueFrom(dialog.closed)) ?? "";
  }

  private async runGenericImport(
    format: UpgradeImportType,
    contents: string,
    promptForPassword_callback: () => Promise<string> = () => this.promptForPassword(),
  ): Promise<ImportResult> {
    const importer = this.importService.getImporter(format, promptForPassword_callback, undefined);
    if (importer == null) {
      throw new Error(this.i18nService.t("selectFormat"));
    }

    return this.importService.import(importer, contents, undefined, undefined, false);
  }

  protected readonly submit = async (): Promise<void> => {
    if (this.continueBlocked()) {
      return;
    }
    if (this.primaryMode() === "direct" && this.directStep() === "intro") {
      this.continueFromIntro();
      return;
    }

    // Clears a stale login-failure error while still re-running the real validators.
    this.formGroup.controls.keeperEmail.updateValueAndValidity();
    this.formGroup.controls.lastPassEmail.updateValueAndValidity();

    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }
    if (this.isFilePasswordProtected() && !this.filePasswordRequested()) {
      this.filePasswordRequested.set(true);
      return;
    }
    await this.onContinue();
  };
}
