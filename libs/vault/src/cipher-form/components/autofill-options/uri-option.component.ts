// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DragDropModule } from "@angular/cdk/drag-drop";
import {
  Component,
  effect,
  ElementRef,
  EventEmitter,
  forwardRef,
  inject,
  Input,
  input,
  Output,
  untracked,
  ViewChild,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ControlValueAccessor,
  FormBuilder,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from "@angular/forms";
import { concatMap, EMPTY, ObservableInput } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DESKTOP_APP_URI_PREFIX,
  DesktopAutotypePairingUri,
} from "@bitwarden/common/desktop-native/models/desktop-autotype-pairing-uri";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DialogService,
  FormFieldModule,
  IconButtonModule,
  SelectComponent,
  SelectModule,
} from "@bitwarden/components";

import { CipherFormHTTPAuthenticationService } from "../../services/cipher-form-http-authentication.service";

import { AdvancedUriOptionDialogComponent } from "./advanced-uri-option-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-autofill-uri-option",
  templateUrl: "./uri-option.component.html",
  host: {
    class:
      "tw-flex tw-flex-col tw-p-3 -tw-mx-3 tw-gap-4 tw-bg-background tw-text-main tw-rounded-lg first:-tw-mt-3 last-of-type:tw-mb-0",
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UriOptionComponent),
      multi: true,
    },
  ],
  imports: [
    DragDropModule,
    FormFieldModule,
    ReactiveFormsModule,
    IconButtonModule,
    JslibModule,
    SelectModule,
  ],
})
export class UriOptionComponent implements ControlValueAccessor {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("uriInput")
  private inputElement: ElementRef<HTMLInputElement>;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("matchDetectionSelect")
  private matchDetectionSelect: SelectComponent<UriMatchStrategySetting>;

  private readonly appSelect = viewChild<SelectComponent<string>>("appSelect");

  protected uriForm = this.formBuilder.group({
    uri: [null as string],
    matchDetection: [null as UriMatchStrategySetting],
  });

  /**
   * The desktop apps that can be selected for a desktop app URI. Each option is labeled with the
   * app's name, and its value is the Desktop Autotype Pairing URI string saved as the login URI.
   */
  // TODO: Add the apps that can be paired to the options for new desktop app URIs
  protected appOptions: { label: string; value: string }[] = [];

  protected uriMatchOptions: {
    label: string;
    value: UriMatchStrategySetting;
    disabled?: boolean;
  }[] = [
    { label: this.i18nService.t("default"), value: null },
    { label: this.i18nService.t("baseDomain"), value: UriMatchStrategy.Domain },
    { label: this.i18nService.t("host"), value: UriMatchStrategy.Host },
    { label: this.i18nService.t("exact"), value: UriMatchStrategy.Exact },
    { label: this.i18nService.t("never"), value: UriMatchStrategy.Never },
    { label: this.i18nService.t("uriAdvancedOption"), value: null, disabled: true },
    { label: this.i18nService.t("startsWith"), value: UriMatchStrategy.StartsWith },
    { label: this.i18nService.t("regEx"), value: UriMatchStrategy.RegularExpression },
  ];

  protected advancedOptionWarningMap: Partial<Record<UriMatchStrategySetting, string>> = {
    [UriMatchStrategy.StartsWith]: "startsWithAdvancedOptionWarning",
    [UriMatchStrategy.RegularExpression]: "regExAdvancedOptionWarning",
  };

  /**
   * Whether the option can be reordered. If false, the reorder button will be hidden.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true })
  canReorder: boolean;

  /**
   * Whether the URI can be removed from the form. If false, the remove button will be hidden.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true })
  canRemove: boolean;

  /**
   * The user's current default match detection strategy. Will be displayed in () after "Default"
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true })
  set defaultMatchDetection(value: UriMatchStrategySetting) {
    // The default selection has a value of `null` avoid showing "Default (Default)"
    if (value === null) {
      return;
    }

    this.uriMatchOptions[0].label = this.i18nService.t(
      "defaultLabelWithValue",
      this.uriMatchOptions.find((o) => o.value === value)?.label,
    );
  }

  /**
   * The index of the URI in the form. Used to render the correct label.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) index: number;

  /**
   * When true, URIs prefixed with the desktop app scheme are shown as desktop apps: a dropdown of
   * desktop app names labeled "Desktop app (URI)", instead of a "Website (URI)" text input. Should
   * only be true when the WindowsDesktopAutotypeGA feature flag is enabled.
   */
  readonly showDesktopApps = input(false);

  /**
   * When true and the URI is shown as a desktop app, the desktop app can't be changed. The URI can
   * still be removed and reordered. Desktop apps already saved on the cipher are locked.
   */
  readonly appUriLocked = input(false);

  /** Whether the whole row is disabled, e.g. because the cipher form is disabled. */
  private rowDisabled = false;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  onKeydown = new EventEmitter<KeyboardEvent>();

  /**
   * Emits when the remove button is clicked and URI should be removed from the form.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  remove = new EventEmitter<void>();

  protected showMatchDetection = false;

  /** The most recent match strategy, used to restore it when a change is declined or cancelled */
  private lastMatchDetection: UriMatchStrategySetting = null;

  private httpAuthenticationService = inject(CipherFormHTTPAuthenticationService);

  protected toggleMatchDetection() {
    this.showMatchDetection = !this.showMatchDetection;
    if (this.showMatchDetection) {
      setTimeout(() => this.matchDetectionSelect?.select()?.focus(), 0);
    }
  }

  /** Whether this URI pairs the login with a desktop app and should be shown as one. */
  protected get isAppUri(): boolean {
    return (
      this.showDesktopApps() &&
      (this.uriForm.controls.uri.value?.startsWith(DESKTOP_APP_URI_PREFIX) ?? false)
    );
  }

  protected get uriLabel() {
    if (this.isAppUri) {
      return this.index === 0
        ? this.i18nService.t("desktopAppUri")
        : this.i18nService.t("desktopAppUriCount", this.index + 1);
    }

    return this.index === 0
      ? this.i18nService.t("websiteUri")
      : this.i18nService.t("websiteUriCount", this.index + 1);
  }

  protected get toggleTitle() {
    return this.i18nService.t(
      this.showMatchDetection
        ? "hideMatchDetectionNoPlaceholder"
        : "showMatchDetectionNoPlaceholder",
    );
  }

  // NG_VALUE_ACCESSOR implementation
  private onChange: any = () => {};
  private onTouched: any = () => {};

  protected handleKeydown(event: KeyboardEvent) {
    this.onKeydown.emit(event);
  }

  constructor(
    private dialogService: DialogService,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
  ) {
    // The raw value includes the URI of a locked desktop app, which is disabled
    this.uriForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.onChange(this.uriForm.getRawValue());
    });

    this.uriForm.statusChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.onTouched();
    });

    effect(() => {
      this.appUriLocked();
      this.showDesktopApps();
      untracked(() => this.applyAppUriLock());
    });

    this.uriForm.controls.matchDetection.valueChanges
      .pipe(
        concatMap((current) => this.handleMatchDetectionChange(current)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /**
   * Compares a user-selected match strategy against the last known strategy, which `writeValue` and silent
   * restores also keep current, and runs the confirmation for the newly selected strategy.
   */
  private handleMatchDetectionChange(current: UriMatchStrategySetting): ObservableInput<void> {
    const previous = this.lastMatchDetection;
    this.lastMatchDetection = current;

    if (previous === current) {
      return EMPTY;
    }

    if (current == null) {
      return this.handleDefaultMatch(previous);
    }

    this.handleAdvancedMatch(previous, current);

    return EMPTY;
  }

  /**
   * HTTP authentication can't be used while a URI uses the default match strategy. Switching to the default
   * strategy while HTTP authentication is on asks the user to confirm turning HTTP authentication off; declining
   * restores the previous strategy.
   */
  private async handleDefaultMatch(previous: UriMatchStrategySetting) {
    if (await this.httpAuthenticationService.confirmDefaultMatchStrategy()) {
      return;
    }

    this.restoreMatchDetection(previous);
  }

  private handleAdvancedMatch(previous: UriMatchStrategySetting, current: UriMatchStrategySetting) {
    const isAdvanced =
      current === UriMatchStrategy.StartsWith || current === UriMatchStrategy.RegularExpression;

    if (!isAdvanced) {
      return;
    }

    AdvancedUriOptionDialogComponent.open(this.dialogService, {
      contentKey: this.advancedOptionWarningMap[current],
      // The control already holds the selected advanced strategy
      onContinue: () => {},
      onCancel: () => {
        this.restoreMatchDetection(previous);
      },
    });
  }

  /**
   * Sets the match strategy without emitting a change, so restoring a declined strategy does not re-run the
   * default or advanced option confirmations, then notifies the parent form of the restored value.
   */
  private restoreMatchDetection(value: UriMatchStrategySetting) {
    this.uriForm.controls.matchDetection.setValue(value, { emitEvent: false });
    this.lastMatchDetection = value;
    this.onChange(this.uriForm.getRawValue());
  }

  focusInput() {
    if (this.isAppUri) {
      this.appSelect()?.select()?.focus();
      return;
    }

    if (this.inputElement?.nativeElement) {
      this.inputElement.nativeElement.focus();
    }
  }

  removeUri() {
    this.remove.emit();
  }

  // NG_VALUE_ACCESSOR implementation
  writeValue(value: { uri: string; matchDetection: UriMatchStrategySetting | null }): void {
    if (value) {
      this.uriForm.setValue(
        {
          uri: value.uri ?? "",
          matchDetection: value.matchDetection ?? null,
        },
        { emitEvent: false },
      );
      this.lastMatchDetection = value.matchDetection ?? null;
      this.addSavedAppOption(value.uri);
      this.applyAppUriLock();
    }
  }

  /**
   * Adds the desktop app of a saved Desktop Autotype Pairing URI to the dropdown options, so the
   * dropdown shows the paired app's name.
   */
  private addSavedAppOption(uri: string | null) {
    const pairingUri = uri == null ? null : DesktopAutotypePairingUri.fromString(uri);
    if (pairingUri == null || this.appOptions.some((option) => option.value === uri)) {
      return;
    }

    // The saved string is the option's value, so the selection matches it exactly and it is saved
    // unchanged
    this.appOptions = [...this.appOptions, { label: pairingUri.data.appData.name, value: uri }];
  }

  registerOnChange(fn: () => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.rowDisabled = isDisabled;
    isDisabled ? this.uriForm.disable() : this.uriForm.enable();
    // Enabling the row enables every control, so a locked desktop app is locked again
    this.applyAppUriLock();
  }

  /**
   * Disables only the URI of a locked desktop app, so the desktop app can't be changed but the row
   * can still be removed and reordered.
   */
  private applyAppUriLock() {
    const uriControl = this.uriForm.controls.uri;
    const disabled = this.rowDisabled || (this.appUriLocked() && this.isAppUri);
    if (disabled === uriControl.disabled) {
      return;
    }

    if (disabled) {
      uriControl.disable({ emitEvent: false });
    } else {
      uriControl.enable({ emitEvent: false });
    }
  }

  getMatchHints() {
    const hints = ["uriMatchDefaultStrategyHint"];
    const strategy = this.uriForm.get("matchDetection")?.value;
    if (
      strategy === UriMatchStrategy.StartsWith ||
      strategy === UriMatchStrategy.RegularExpression
    ) {
      hints.push(this.advancedOptionWarningMap[strategy]);
    }
    return hints;
  }
}
