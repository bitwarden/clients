// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgForOf, NgIf } from "@angular/common";
import {
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  Output,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ControlValueAccessor,
  FormBuilder,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  FormFieldModule,
  IconButtonModule,
  SelectComponent,
  SelectModule,
} from "@bitwarden/components";

@Component({
  selector: "vault-autofill-uri-option",
  templateUrl: "./uri-option.component.html",
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UriOptionComponent),
      multi: true,
    },
  ],
  imports: [
    FormFieldModule,
    ReactiveFormsModule,
    IconButtonModule,
    JslibModule,
    SelectModule,
    NgForOf,
    NgIf,
  ],
})
export class UriOptionComponent implements ControlValueAccessor {
  @ViewChild("uriInput")
  private inputElement: ElementRef<HTMLInputElement>;

  @ViewChild("matchDetectionSelect")
  private matchDetectionSelect: SelectComponent<UriMatchStrategySetting>;

  protected uriForm = this.formBuilder.group({
    uri: [null as string],
    matchDetection: [null as UriMatchStrategySetting],
  });

  protected uriMatchOptions: { label: string; value: UriMatchStrategySetting }[] = [
    { label: this.i18nService.t("default"), value: null },
    { label: this.i18nService.t("baseDomain"), value: UriMatchStrategy.Domain },
    { label: this.i18nService.t("host"), value: UriMatchStrategy.Host },
    { label: this.i18nService.t("startsWith"), value: UriMatchStrategy.StartsWith },
    { label: this.i18nService.t("regEx"), value: UriMatchStrategy.RegularExpression },
    { label: this.i18nService.t("exact"), value: UriMatchStrategy.Exact },
    { label: this.i18nService.t("never"), value: UriMatchStrategy.Never },
  ];

  /**
   * Whether the URI can be removed from the form. If false, the remove button will be hidden.
   */
  @Input({ required: true })
  canRemove: boolean;

  /**
   * The user's current default match detection strategy. Will be displayed in () after "Default"
   */
  @Input({ required: true })
  set defaultMatchDetection(value: UriMatchStrategySetting) {
    // The default selection has a value of `null` avoid showing "Default (Default)"
    if (value === null) {
      return;
    }

    this.uriMatchOptions[0].label = this.i18nService.t(
      "defaultLabel",
      this.uriMatchOptions.find((o) => o.value === value)?.label,
    );
  }

  /**
   * The index of the URI in the form. Used to render the correct label.
   */
  @Input({ required: true }) index: number;

  /**
   * Emits when the remove button is clicked and URI should be removed from the form.
   */
  @Output()
  remove = new EventEmitter<void>();

  protected showMatchDetection = false;

  protected toggleMatchDetection() {
    this.showMatchDetection = !this.showMatchDetection;
    if (this.showMatchDetection) {
      setTimeout(() => this.matchDetectionSelect?.select?.focus(), 0);
    }
  }

  protected get uriLabel() {
    return this.index === 0
      ? this.i18nService.t("websiteUri")
      : this.i18nService.t("websiteUriCount", this.index + 1);
  }

  protected get toggleTitle() {
    return this.showMatchDetection
      ? this.i18nService.t("hideMatchDetection", this.uriForm.value.uri)
      : this.i18nService.t("showMatchDetection", this.uriForm.value.uri);
  }

  // NG_VALUE_ACCESSOR implementation
  private onChange: any = () => {};
  private onTouched: any = () => {};

  constructor(
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
  ) {
    this.uriForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.onChange(value);
    });

    this.uriForm.statusChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.onTouched();
    });
  }

  focusInput() {
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
    }
  }

  registerOnChange(fn: () => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    isDisabled ? this.uriForm.disable() : this.uriForm.enable();
  }
}
