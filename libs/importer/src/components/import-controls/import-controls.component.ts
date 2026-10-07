import { LiveAnnouncer } from "@angular/cdk/a11y";
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
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import {
  AsyncActionsModule,
  BadgeModule,
  ButtonModule,
  CalloutModule,
  CardContentComponent,
  CheckboxModule,
  DialogService,
  FileUploadComponent,
  FormFieldModule,
  IconButtonModule,
  IconComponent,
  LinkModule,
  RadioButtonModule,
  SegmentedCardComponent,
  SelectModule,
  SpinnerComponent,
  SvgModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { KeeperRegion } from "../../importers/keeper/access";
import { Loader } from "../../metadata";
import {
  CredentialKind,
  ImportOption,
  ImportRecordError,
  ImportResult,
  ImportType,
  SdkImportCredentials,
  SdkImportSummary,
} from "../../models";
import {
  ImporterProfile,
  ImportMetadataServiceAbstraction,
  ImportServiceAbstraction,
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
import { KeeperDirectImportService } from "../keeper/keeper-direct-import.service";
import { keeperImportGate, shouldSubmitAfterDialog } from "../keeper/keeper-import-gate";
import { KEEPER_REGION_OPTIONS } from "../keeper/keeper-region-options";
import { keeperValidationErrorI18nKey } from "../keeper/keeper-validation-error";
import {
  PartialImportDialogComponent,
  PartialImportDialogData,
} from "../keeper/partial-import-dialog.component";
import { LastPassDirectImportService } from "../lastpass/lastpass-direct-import.service";
import { lastPassValidationErrorI18nKey } from "../lastpass/lastpass-validation-error";

import {
  detectPasteContentShape,
  expectedPasteShapeFor,
  vendorSupportsPasteShapeNarrowing,
} from "./paste-content-shape";

/** How import data will be provided: direct uses a vendor-specific direct importer,
 * chromium will use our Chromium importer, manual will use either a file or pasted text. */
type ImportStrategy = "direct" | "chromium" | "manual";

/** The current phase of a direct importer flow */
type DirectStep = "intro" | "credentials";

/** Real discriminated union of distinct `kind`s. `cancelled` means feedback was already shown
 *  (toast, inline error, dismissed dialog) — the caller does nothing further. */
type ImportOutcome =
  | { kind: "imported"; result: ImportResult }
  | { kind: "importedWithSdk"; sdkSummary: SdkImportSummary }
  | { kind: "cancelled" };

const dedupe = (values: readonly string[]): readonly string[] => Array.from(new Set(values));

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
    BadgeModule,
    ButtonModule,
    CalloutModule,
    CardContentComponent,
    CheckboxModule,
    FileUploadComponent,
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    IconComponent,
    LinkModule,
    ReactiveFormsModule,
    RadioButtonModule,
    SegmentedCardComponent,
    SelectModule,
    SpinnerComponent,
    SvgModule,
    TypographyModule,
  ],
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
  // Lazy (see runKeeperDirectImport/runLastPassDirectImport): both are root singletons with
  // constructor side effects, so eager injection would run those on every mount, incl. Web.
  private readonly injector = inject(Injector);
  private readonly importService = inject(ImportServiceAbstraction);
  private readonly importMetadataService = inject(ImportMetadataServiceAbstraction);
  private readonly themingService = inject(AbstractThemingService);

  /** The vendor chosen in step 1 — the picker's canonical `ImportType` for that vendor's card. */
  readonly importType = input.required<ImportType>();

  /** Fires once the import actually succeeds, not on button click, so the parent navigates only
   *  when there's something to see. */
  readonly continue = output<void>();

  /** Tells the parent component the user clicked back so that it can react.  */
  readonly back = output<void>();

  private readonly clientType = this.platformUtilsService.getClientType();

  /** The vendor's canonical `ImportOption` — the source for every vendor-level concern (heading,
   *  `hasDirectImporter`/`isBrowser`) except format-specific instructions, for these
   *  see `activeInstructions`. */
  protected readonly vendor = computed<ImportOption>(() =>
    this.importService.getImportOption(this.importType())!,
  );

  /** The vendor name to interpolate. */
  protected readonly vendorName = computed(() => pickerDisplayNameFor(this.importType()));

  /** A handful of vendor marks are a single fixed color and need a swapped variant against a dark
   *  background — see `PickerVendorIcon.darkIcon`. Mirrors import-source-select.component.ts. */
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

  protected readonly fileAccept = computed(() =>
    this.acceptedFileTypes()
      .map((type) => `.${type}`)
      .join(","),
  );

  protected readonly acceptedFileTypesHint = computed(() =>
    this.acceptedFileTypes()
      .map((type) => `.${type}`)
      .join(", "),
  );
  protected readonly pasteFormatsHint = computed(() =>
    this.pasteFormats()
      .map((type) => `.${type}`)
      .join(", "),
  );

  private readonly importType$ = toObservable(this.importType);

  // Waits for init() before subscribing to metadata$ — on Desktop that's what discovers real
  // browsers, so subscribing earlier would miss chromium availability.
  //
  // { resolved, value } instead of bare value: lets capabilitiesPending tell "still loading" apart
  // from "failed, no capabilities" — both would otherwise look like value: undefined.
  private readonly capabilities = toSignal(
    defer(() => this.importMetadataService.init()).pipe(
      switchMap(() => this.importMetadataService.metadata$(this.importType$)),
      // Without this, a rejected init() would make toSignal rethrow on every read — crashing the
      // whole template, since primaryMode() (read at the top level) depends on this.
      catchError(() => of(undefined)),
      map((value) => ({ resolved: true, value })),
    ),
    { initialValue: { resolved: false, value: undefined } },
  );

  // Guards against the previous vendor's loaders being read during the window between a live
  // importType() change and metadata$ re-emitting for the new vendor
  protected readonly isChromiumAvailable = computed(() => {
    const capabilities = this.capabilities().value;
    return (
      capabilities?.type === this.importType() && capabilities.loaders.includes(Loader.chromium)
    );
  });

  // Only browser-family vendors can hit "unresolved" — this avoids flashing the manual
  // (file/paste) UI while NAPI capabilities call completes.
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

  private readonly chromiumProfilesFor = computed<ImportType | undefined>(() =>
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
  // requestBrowserAccess can block indefinitely on a native OS permission prompt (sandboxed
  // macOS builds) — without this, the select renders empty during that wait, indistinguishable
  // from "this vendor genuinely has no profiles."
  protected readonly profilesPending = computed(
    () => this.primaryMode() === "chromium" && !this.profilesResult().resolved,
  );

  protected readonly directStep = signal<DirectStep>("intro");

  protected readonly isKeeper = computed(() => this.importType() === "keeper");
  protected readonly isLastPass = computed(() => this.importType() === "lastpasscsv");

  protected readonly keeperRegions = KEEPER_REGION_OPTIONS;

  /** Shows `kdbxPasswordRequired` instead of the generic required message, per design review. */
  private readonly masterPasswordRequiredValidator: ValidatorFn = (control) =>
    (control.value ?? "").length > 0
      ? null
      : { kdbxPasswordRequired: { message: this.i18nService.t("kdbxPasswordRequired") } };

  protected readonly formGroup = this.formBuilder.group({
    keeperEmail: [{ value: "", disabled: true }, [Validators.required, Validators.email]],
    keeperRegion: this.formBuilder.nonNullable.control<KeeperRegion>(KeeperRegion.Us),
    lastPassEmail: [{ value: "", disabled: true }, [Validators.required, Validators.email]],
    includeSharedFolders: [false],
    // Validators.required listed second: compose() preserves order, so the custom validator's
    // "password is required" message wins over the generic one.
    kdbxPassword: [
      { value: "", disabled: true },
      [this.masterPasswordRequiredValidator, Validators.required],
    ],
    keyFile: [{ value: null as File | null, disabled: true }],

    profile: [{ value: "", disabled: true }, Validators.required],

    method: this.formBuilder.nonNullable.control<"file" | "paste">("file"),
    file: [null as File | null],
    fileContents: this.formBuilder.nonNullable.control(""),

    // Active on a genuine extension collision (1Password's Windows vs. Mac csv) or for a vendor
    // that always prompts regardless of collision (KeePass, 1Password) — see showFormatChoice().
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

    // chosenFile(), not chosenFileName(): a same-named re-pick is a new File object but an
    // unchanged name string, which chosenFileName()'s dedup would never mark dirty.
    const extension = this.chosenFile()?.name.split(".").pop()?.toLowerCase();
    return extension
      ? this.formatOptions().filter((option) => option.acceptedFileTypes.includes(extension))
      : [];
  });

  protected readonly needsFormatDisambiguation = computed(() => this.candidateFormats().length > 1);

  protected readonly alwaysPromptFormat = computed(() =>
    pickerAlwaysPromptsFormat(this.importType()),
  );

  /** Whether the format picker renders: a genuine extension collision, or a vendor that always
   *  prompts regardless (KeePass's formats never collide; 1Password's wincsv/maccsv do, but
   *  `alwaysPromptFormat` also shows the control before a file narrows it down). */
  protected readonly showFormatChoice = computed(
    () => this.needsFormatDisambiguation() || this.alwaysPromptFormat(),
  );

  /** Options to list: the real candidates once any exist, else every sibling format — so an
   *  always-prompt vendor's picker isn't empty before a file/paste narrows it down. */
  protected readonly formatChoiceOptions = computed<ImportOption[]>(() => {
    const candidates = this.candidateFormats();
    if (candidates.length > 0) {
      return candidates;
    }
    // Pre-content fallback: don't list a format the accepted-formats hint above it excludes.
    const options = this.formatOptions();
    return this.method() === "paste"
      ? options.filter((option) => option.pasteFormats.length > 0)
      : options;
  });

  /** Every extension this candidate accepts, joined (".1pux, .json") — or the full descriptive
   *  name if any of them collides with another listed option's (e.g. Windows vs. Mac csv). Reads
   *  pasteFormats in paste mode; there's no file extension to show there. */
  protected formatChoiceLabel(candidate: ImportOption): string {
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
    return sharesAnyExtension
      ? candidate.name
      : extensions.map((extension) => `.${extension}`).join(", ");
  }

  private readonly formatChoice = toSignal(this.formGroup.controls.formatChoice.valueChanges, {
    initialValue: this.formGroup.controls.formatChoice.value,
  });

  /** Whether the user has actually chosen a file or typed/pasted content yet, independent of
   *  whether it resolved to anything — distinguishes "nothing selected yet" from "selected
   *  something that matches zero formats" for resolvedFormat()'s 0-candidate case below. */
  private readonly hasAttemptedContent = computed(() =>
    this.method() === "paste" ? this.pastedContent().trim().length > 0 : this.chosenFile() != null,
  );

  /** Whether the format control should be shown/enabled at all. Written by the effect below (not
   *  a computed(): the template must use the exact same value the effect acted on, not its own
   *  independently-derived copy, or the control can render visible-but-dead). */
  protected readonly formatChoiceActive = signal(false);

  protected readonly resolvedFormat = computed<ImportType | undefined>(() => {
    const candidates = this.candidateFormats();
    if (candidates.length === 1) {
      return candidates[0].id as ImportType;
    }
    if (candidates.length > 1) {
      return this.formatChoice() ?? undefined;
    }
    // 0 candidates: only an always-prompt vendor's own pre-file dropdown pick counts, and only
    // before anything's been attempted — once something's chosen, 0 candidates means unsupported.
    if (this.alwaysPromptFormat() && !this.hasAttemptedContent()) {
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

  // kdbx can't be pasted (keepasskdbx.pasteFormats is empty), so this only resolves via file method.
  protected readonly needsKdbxCredentials = computed(() => this.resolvedFormat() === "keepasskdbx");

  // Starts hidden behind an "Add key file" link — most kdbx imports don't need it.
  protected readonly showKeyFile = signal(false);

  constructor() {
    this.formGroup.controls.method.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.formGroup.controls.formatChoice.reset(null);
      // Not reset(): the value (chosen file, typed paste content) must survive the switch.
      this.formGroup.controls.file.markAsUntouched();
      this.formGroup.controls.fileContents.markAsUntouched();
    });

    // previousFile: null means the first-ever pick (preserve a still-valid pre-file answer);
    // non-null means replacing a file (always re-opens disambiguation, even if still valid).
    let previousFile: File | null = null;
    this.formGroup.controls.file.valueChanges.pipe(takeUntilDestroyed()).subscribe((file) => {
      const current = this.formGroup.controls.formatChoice.value;
      const keepCurrent =
        previousFile == null && this.candidateFormats().some((option) => option.id === current);
      if (!keepCurrent) {
        this.formGroup.controls.formatChoice.reset(null);
      }
      if (previousFile != null && previousFile !== file) {
        // reset() also clears touched, so a new kdbx file doesn't show the old one's stale error.
        // Identity check, not just non-null: file.valueChanges can re-emit the same File object
        // (e.g. updateValueAndValidity() on a method change), which isn't a real replacement.
        this.formGroup.controls.kdbxPassword.reset("");
        this.formGroup.controls.keyFile.setValue(null);
        this.showKeyFile.set(false);
      }
      previousFile = file;
    });

    // Resets only when the candidate *set* changes (not on every ambiguous keystroke or an
    // identical re-paste). Unlike the file subscriber below, never preserves a pre-content pick:
    // 1Password's paste-mode set is always either empty or the same full 4 items, so a cosmetic
    // default would always look "still valid" and silently answer the disambiguation it's meant
    // to stay unforced against.
    let previousCandidateIds: string | null = null;
    this.formGroup.controls.fileContents.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const currentCandidateIds = this.candidateFormats()
        .map((option) => option.id)
        .join(",");
      if (currentCandidateIds !== previousCandidateIds) {
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
      this.formGroup.controls.file.setValidators(fileRequired ? Validators.required : []);
      this.formGroup.controls.file.updateValueAndValidity();
    });

    // Validators.required kept alongside requiredTrimmedValidator so hasValidator(Validators.
    // required) still matches (drives the asterisk/required attribute).
    effect(() => {
      const pasteRequired = this.method() === "paste";
      this.formGroup.controls.fileContents.setValidators(
        pasteRequired ? [Validators.required, requiredTrimmedValidator] : [],
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

    let previousImportType: ImportType | undefined;
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
        formatChoice: null,
      });
    });

    // Declared last so a live importType() switch always seeds against the vendor-reset effect's
    // post-reset state, not the other way around (effects run in creation order within a flush).
    effect(() => {
      const genuinelyUnsupported =
        this.candidateFormats().length === 0 && this.hasAttemptedContent();
      const active =
        this.primaryMode() === "manual" && this.showFormatChoice() && !genuinelyUnsupported;
      this.formatChoiceActive.set(active);
      setEnabled(this.formGroup.controls.formatChoice, active);
      if (!active) {
        this.formGroup.controls.formatChoice.reset(null);
        return;
      }
      // Outside genuine disambiguation: with one candidate, resolvedFormat() ignores this value
      // anyway; with zero (always-prompt, nothing chosen yet), resolvedFormat() does read it.
      if (this.needsFormatDisambiguation()) {
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
    this.back.emit();
  }

  protected toggleToManual(): void {
    this.primaryModeOverride.set("manual");
    this.directStep.set("intro");
    // touched survives disable/enable; clear it so a prior blocked submit doesn't flash here.
    this.formGroup.controls.file.markAsUntouched();
    this.formGroup.controls.fileContents.markAsUntouched();
  }

  protected toggleToAlternate(): void {
    this.primaryModeOverride.set(undefined);
    this.directStep.set("intro");
    this.formGroup.controls.profile.markAsUntouched();
  }

  protected continueFromIntro(): void {
    // touched survives disable/enable, so a stale error would otherwise flash on re-entry.
    this.formGroup.controls.keeperEmail.markAsUntouched();
    this.formGroup.controls.lastPassEmail.markAsUntouched();
    this.directStep.set("credentials");
  }

  protected addKeyFile(): void {
    this.showKeyFile.set(true);
  }

  protected async onContinue(): Promise<void> {
    if (await this.blockedByPersonalOwnershipPolicy()) {
      return;
    }

    let outcome: ImportOutcome;
    try {
      outcome = await this.runImport();
    } catch (error) {
      this.logService.error(error);
      this.dialogService.open(ImportErrorDialogComponent, { data: error as Error });
      return;
    }

    if (outcome.kind === "cancelled") {
      return;
    }

    // Before the dialog, not after: keeps Continue's spinner (not the dialog) up during the
    // wait. Failures are only logged — the import already succeeded, so this shouldn't block.
    try {
      const synced = await this.syncService.fullSync(true);
      if (!synced) {
        // fullSync(true) sets forceSync only, so an ordinary failure resolves false, not throws.
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

  private async blockedByPersonalOwnershipPolicy(): Promise<boolean> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const policyApplies = await firstValueFrom(
      this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
    );
    if (!policyApplies) {
      return false;
    }

    this.toastService.showToast({
      variant: "error",
      title: undefined,
      message: this.i18nService.t("personalOwnershipPolicyInEffectImports"),
    });
    return true;
  }

  private async runImport(): Promise<ImportOutcome> {
    if (this.primaryMode() === "direct") {
      if (this.isKeeper()) {
        return this.runKeeperDirectImport();
      }
      if (this.isLastPass()) {
        return this.runLastPassDirectImport();
      }
      // Reaching here means a direct vendor was added with no handler wired up — fail loudly.
      throw new Error(`No direct-import handler is wired up for vendor: ${this.importType()}`);
    }
    if (this.primaryMode() === "chromium") {
      return this.runChromiumImport();
    }
    return this.runManualImport();
  }

  private async runKeeperDirectImport(): Promise<ImportOutcome> {
    let handled: { result: ImportResult; errors: ImportRecordError[] };
    try {
      handled = await this.injector
        .get(KeeperDirectImportService)
        .handleImport(
          this.formGroup.controls.keeperEmail.value!,
          this.formGroup.controls.keeperRegion.value,
          undefined,
        );
    } catch (error) {
      this.logService.error(`Keeper importer error: ${error}`);
      this.formGroup.controls.keeperEmail.setErrors({
        errors: { message: this.i18nService.t(keeperValidationErrorI18nKey(error)) },
      });
      this.formGroup.controls.keeperEmail.markAsTouched();
      return { kind: "cancelled" };
    }

    const { result, errors } = handled;
    const { needsConfirmation, canImport } = keeperImportGate(result, errors);
    if (needsConfirmation) {
      const dialog = this.dialogService.open<boolean, PartialImportDialogData>(
        PartialImportDialogComponent,
        { data: { errors, canImport } },
      );
      const confirmed = await firstValueFrom(dialog.closed);
      if (!shouldSubmitAfterDialog(canImport, confirmed)) {
        return { kind: "cancelled" };
      }
    }

    return {
      kind: "imported",
      result: await this.importService.importImportResult(result, undefined, undefined, false),
    };
  }

  private async runLastPassDirectImport(): Promise<ImportOutcome> {
    let csv: string;
    try {
      csv = await this.injector
        .get(LastPassDirectImportService)
        .handleImport(
          this.formGroup.controls.lastPassEmail.value!,
          this.formGroup.controls.includeSharedFolders.value ?? false,
        );
    } catch (error) {
      this.logService.error(`LP importer error: ${error}`);
      this.formGroup.controls.lastPassEmail.setErrors({
        errors: { message: this.i18nService.t(lastPassValidationErrorI18nKey(error)) },
      });
      this.formGroup.controls.lastPassEmail.markAsTouched();
      return { kind: "cancelled" };
    }

    return { kind: "imported", result: await this.runGenericImport("lastpasscsv", csv) };
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

    if (this.importService.getImportOption(format)?.sdk != null) {
      return this.runSdkImport(format);
    }

    const contents =
      this.method() === "paste" ? this.pastedContent() : await this.readChosenFileContents(format);

    return { kind: "imported", result: await this.runGenericImport(format, contents) };
  }

  // Caller guarantees a chosen file exists here; empty/unreadable content throws errorReadingFile.
  private async readChosenFileContents(format: ImportType): Promise<string> {
    let contents: string;
    try {
      contents = await readImportFileContents(format, this.chosenFile()!);
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
      // A file was chosen — this is a bad-file error, not "nothing selected".
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
      // Mirrors legacy's SDK error mapping — else a wrong kdbx password shows the raw SDK string.
      this.logService.error("SDK importer error:", error);
      const messageKey = this.importService.sdkErrorMessageKey(format, error);
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
        // A new SDK credential kind was declared with no collector wired up — fail loudly.
        throw new Error(`No SDK credential collector is wired up for kind: ${kind}`);
    }
  }

  private async promptForPassword(): Promise<string> {
    const dialog = this.dialogService.open<string>(FilePasswordPromptComponent, {
      ariaModal: true,
    });
    return (await firstValueFrom(dialog.closed)) ?? "";
  }

  private async runGenericImport(format: ImportType, contents: string): Promise<ImportResult> {
    const importer = this.importService.getImporter(
      format,
      () => this.promptForPassword(),
      undefined,
    );
    if (importer == null) {
      throw new Error(this.i18nService.t("selectFormat"));
    }

    return this.importService.import(importer, contents, undefined, undefined, false);
  }

  protected readonly submit = async (): Promise<void> => {
    if (this.capabilitiesPending() || this.profilesPending()) {
      return;
    }
    if (this.primaryMode() === "direct" && this.directStep() === "intro") {
      this.continueFromIntro();
      return;
    }

    // Clears a stale login-failure error before revalidating; updateValueAndValidity() (not
    // setErrors(null)) re-runs real validators too, so a genuinely invalid email still blocks.
    this.formGroup.controls.keeperEmail.updateValueAndValidity();
    this.formGroup.controls.lastPassEmail.updateValueAndValidity();

    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }
    await this.onContinue();
  };
}
