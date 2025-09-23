// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DragDropModule } from "@angular/cdk/drag-drop";
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
import { concatMap, pairwise, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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

import { AdvancedUriOptionDialogComponent } from "./advanced-uri-option-dialog.component";

@Component({
  selector: "vault-autofill-uri-option",
  templateUrl: "./uri-option.component.html",
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
  @Input({ required: true })
  canReorder: boolean;

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

  @Output()
  onKeydown = new EventEmitter<KeyboardEvent>();

  /**
   * Emits when the remove button is clicked and URI should be removed from the form.
   */
  @Output()
  remove = new EventEmitter<void>();

  protected showMatchDetection = false;

  protected toggleMatchDetection() {
    this.showMatchDetection = !this.showMatchDetection;
    if (this.showMatchDetection) {
      setTimeout(() => this.matchDetectionSelect?.select()?.focus(), 0);
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

  protected handleKeydown(event: KeyboardEvent) {
    this.onKeydown.emit(event);
  }

  constructor(
    private dialogService: DialogService,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private policyService: PolicyService,
    private accountService: AccountService,
  ) {
    this.uriForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.onChange(value);
    });

    this.uriForm.statusChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.onTouched();
    });

    this.uriForm.controls.matchDetection.valueChanges
      .pipe(
        pairwise(),
        concatMap(([previous, current]) => this.handleAdvancedMatch(previous, current)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  applyUriMatchPolicy(existingMatchDetection?: UriMatchStrategySetting | null) {
    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policiesByType$(PolicyType.UriMatchDefaults, userId),
        ),
        getFirstPolicy,
        takeUntilDestroyed(),
      )
      .subscribe((policy) => {
        if (policy?.enabled && policy.data?.defaultMatchType !== undefined) {
          const defaultMatchType = policy.data.defaultMatchType;

          if (Object.values(UriMatchStrategy).includes(defaultMatchType)) {
            // Update the "Default" label to show what policy sets
            this.defaultMatchDetection = defaultMatchType;

            // Only set to policy default if not previously set by user
            if (existingMatchDetection === null || existingMatchDetection === undefined) {
              this.uriForm.controls.matchDetection.setValue(null, { emitEvent: false });
            }
          }
        }
      });
  }

  private async handleAdvancedMatch(
    previous: UriMatchStrategySetting,
    current: UriMatchStrategySetting,
  ) {
    const valueChange = previous !== current;
    const isAdvanced =
      current === UriMatchStrategy.StartsWith || current === UriMatchStrategy.RegularExpression;

    if (!valueChange || !isAdvanced) {
      return;
    }
    AdvancedUriOptionDialogComponent.open(this.dialogService, {
      contentKey: this.advancedOptionWarningMap[current],
      onContinue: () => {
        this.uriForm.controls.matchDetection.setValue(current);
      },
      onCancel: () => {
        this.uriForm.controls.matchDetection.setValue(previous);
      },
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
    this.applyUriMatchPolicy(value?.matchDetection);
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
