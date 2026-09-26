import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { catchError, defer, map, of, switchMap } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  CardContentComponent,
  CheckboxModule,
  FileUploadComponent,
  FormFieldModule,
  IconButtonModule,
  IconComponent,
  LinkModule,
  ProgressBarComponent,
  RadioButtonModule,
  SegmentedCardComponent,
  SelectModule,
  SpinnerComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { KeeperRegion } from "../../importers/keeper/access";
import { Loader } from "../../metadata";
import { ImportOption, ImportType } from "../../models";
import { ImportMetadataServiceAbstraction, ImportServiceAbstraction } from "../../services";
import { pickerDisplayNameFor, pickerFormatsFor } from "../import-source-select/picker-vendor-data";
import { KEEPER_REGION_OPTIONS } from "../keeper/keeper-region-options";

/** How import data will be provided: direct uses a vendor-specific direct importer,
 * chromium will use our Chromium importer, manual will use either a file or pasted text. */
type ImportStrategy = "direct" | "chromium" | "manual";

/** The current phase of a direct importer flow */
type DirectStep = "intro" | "credentials";

const dedupe = (values: readonly string[]): readonly string[] => Array.from(new Set(values));

function setEnabled(control: FormControl<unknown>, enabled: boolean): void {
  if (enabled && control.disabled) {
    control.enable();
  } else if (!enabled && control.enabled) {
    control.disable();
  }
}

@Component({
  selector: "importer-controls",
  templateUrl: "./import-controls.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
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
    ProgressBarComponent,
    ReactiveFormsModule,
    RadioButtonModule,
    SegmentedCardComponent,
    SelectModule,
    SpinnerComponent,
    TypographyModule,
  ],
})
export class ImportControlsComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly i18nService = inject(I18nService);
  private readonly importService = inject(ImportServiceAbstraction);
  private readonly importMetadataService = inject(ImportMetadataServiceAbstraction);

  /** The vendor chosen in step 1 — the picker's canonical `ImportType` for that vendor's card. */
  readonly importType = input.required<ImportType>();

  /** Current position in the overall import flow, for the step progress bar. */
  readonly currentStep = input(2);
  readonly totalSteps = input(3);

  /** Fires when Continue is pressed. TODO this does nothing for now.  */
  readonly continue = output<void>();

  /** Tells the parent component the user clicked back so that it can react.  */
  readonly back = output<void>();

  protected readonly progressValue = computed(() => (this.currentStep() / this.totalSteps()) * 100);
  protected readonly stepText = computed(() =>
    this.i18nService.t("importSourceStepCount", this.currentStep(), this.totalSteps()),
  );

  private readonly clientType = this.platformUtilsService.getClientType();

  /** The vendor's canonical `ImportOption` — the source for every vendor-level concern (heading,
   *  `hasDirectImporter`/`isBrowser`) except format-specific instructions, for these
   *  see `activeInstructions`. */
  protected readonly vendor = computed<ImportOption>(() =>
    this.importService.getImportOption(this.importType())!,
  );

  /** The vendor name to interpolate. */
  protected readonly vendorName = computed(() => pickerDisplayNameFor(this.importType()));

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

  protected readonly acceptedFileTypesHint = computed(() => this.acceptedFileTypes().join(", "));
  protected readonly pasteFormatsHint = computed(() => this.pasteFormats().join(", "));

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

  protected readonly directStep = signal<DirectStep>("intro");

  protected readonly isKeeper = computed(() => this.importType() === "keeper");
  protected readonly isLastPass = computed(() => this.importType() === "lastpasscsv");

  protected readonly keeperRegions = KEEPER_REGION_OPTIONS;

  protected readonly formGroup = this.formBuilder.group({
    keeperEmail: [{ value: "", disabled: true }, [Validators.required, Validators.email]],
    keeperRegion: this.formBuilder.nonNullable.control<KeeperRegion>(KeeperRegion.Us),
    lastPassEmail: [{ value: "", disabled: true }, [Validators.required, Validators.email]],
    includeSharedFolders: [false],
    kdbxPassword: [{ value: "", disabled: true }, Validators.required],
    keyFile: [{ value: null as File | null, disabled: true }],

    profile: [{ value: "", disabled: true }, Validators.required],

    method: this.formBuilder.nonNullable.control<"file" | "paste">("file"),
    file: [null as File | null],
    fileContents: [""],

    // Only ever active when the resolved candidate set for the current file/paste content has
    // more than one entry — today, only 1Password's Windows vs. Mac legacy CSV export.
    formatChoice: [{ value: null as ImportType | null, disabled: true }],
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

  /** The formats the current input could belong to. In `file` method this narrows precisely, by
   *  the chosen file's extension. In `paste` method there's no filename to read an extension
   *  from, so — rather than guessing from content shape — every paste-capable sibling format is
   *  offered once any content is present; the disambiguation control (below) then always appears
   *  for a vendor with more than one paste-capable format, not just the ones whose labels happen
   *  to collide. Length 0 before anything is provided; length 1 for every vendor in `file` method
   *  except 1Password's Windows/Mac csv collision. */
  protected readonly candidateFormats = computed<ImportOption[]>(() => {
    if (this.method() === "paste") {
      if (!this.pastedContent()?.trim()) {
        return [];
      }
      return this.formatOptions().filter((option) => option.pasteFormats.length > 0);
    }

    const extension = this.chosenFileName()?.split(".").pop()?.toLowerCase();
    return extension
      ? this.formatOptions().filter((option) => option.acceptedFileTypes.includes(extension))
      : [];
  });

  protected readonly needsFormatDisambiguation = computed(() => this.candidateFormats().length > 1);

  private readonly formatChoice = toSignal(this.formGroup.controls.formatChoice.valueChanges, {
    initialValue: this.formGroup.controls.formatChoice.value,
  });

  protected readonly resolvedFormat = computed<ImportType | undefined>(() => {
    const candidates = this.candidateFormats();
    if (candidates.length === 1) {
      return candidates[0].id as ImportType;
    }
    if (candidates.length > 1) {
      return this.formatChoice() ?? undefined;
    }
    return undefined;
  });

  // Falls back to vendor() when the resolved sibling has no instructions of its own (e.g.
  // Keeper's keepercsv/keeperjson) — otherwise resolving to one would blank a callout that was
  // just showing.
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
    this.formGroup.controls.method.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formGroup.controls.formatChoice.reset(null));

    this.formGroup.controls.file.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.formGroup.controls.formatChoice.reset(null);
      this.formGroup.controls.kdbxPassword.setValue("");
      this.formGroup.controls.keyFile.setValue(null);
      this.showKeyFile.set(false);
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
      setEnabled(this.formGroup.controls.profile, this.primaryMode() === "chromium");
    });

    effect(() => {
      const manualActive = this.primaryMode() === "manual";
      setEnabled(this.formGroup.controls.method, manualActive);
      setEnabled(this.formGroup.controls.file, manualActive);
      setEnabled(this.formGroup.controls.fileContents, manualActive);
    });

    effect(() => {
      setEnabled(this.formGroup.controls.formatChoice, this.needsFormatDisambiguation());
    });

    effect(() => {
      const active = this.needsKdbxCredentials();
      setEnabled(this.formGroup.controls.kdbxPassword, active);
      setEnabled(this.formGroup.controls.keyFile, active && this.showKeyFile());
      if (!active) {
        this.showKeyFile.set(false);
        this.formGroup.controls.kdbxPassword.setValue("");
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
  }
  protected onBack(): void {
    this.back.emit();
  }

  protected toggleToManual(): void {
    this.primaryModeOverride.set("manual");
    this.directStep.set("intro");
  }

  protected toggleToAlternate(): void {
    this.primaryModeOverride.set(undefined);
    this.directStep.set("intro");
  }

  protected continueFromIntro(): void {
    this.directStep.set("credentials");
  }

  protected addKeyFile(): void {
    this.showKeyFile.set(true);
  }

  protected onContinue(): void {
    this.continue.emit();
  }

  protected readonly submit = async (): Promise<void> => {
    if (this.capabilitiesPending()) {
      return;
    }
    if (this.primaryMode() === "direct" && this.directStep() === "intro") {
      this.continueFromIntro();
    } else {
      this.onContinue();
    }
  };
}
