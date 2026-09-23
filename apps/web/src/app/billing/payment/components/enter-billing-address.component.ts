import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { map, Observable, pairwise, startWith, Subject, takeUntil } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  TaxIdWarningType,
  TaxIdWarningTypes,
} from "@bitwarden/web-vault/app/billing/warnings/types";

import { SharedModule } from "../../../shared";
import {
  BillingAddress,
  findTaxIdTypeByValue,
  getTaxIdTypeForCountry,
  normalizeTaxIdValue,
  selectableCountries,
  taxIdTypes,
} from "../types";

export interface BillingAddressControls {
  country: string;
  postalCode: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  taxId: string | null;
}

export type BillingAddressFormGroup = FormGroup<ControlsOf<BillingAddressControls>>;

export const getBillingAddressFromForm = (formGroup: BillingAddressFormGroup): BillingAddress =>
  getBillingAddressFromControls(formGroup.getRawValue());

export const getBillingAddressFromControls = (controls: BillingAddressControls) => {
  const { taxId, ...addressFields } = controls;
  const normalizedTaxId = taxId ? normalizeTaxIdValue(taxId) : null;
  const taxIdType = normalizedTaxId
    ? getTaxIdTypeForCountry(addressFields.country, normalizedTaxId)
    : null;
  return taxIdType
    ? { ...addressFields, taxId: { code: taxIdType.code, value: normalizedTaxId! } }
    : { ...addressFields, taxId: null };
};

type Scenario =
  | {
      type: "checkout";
      supportsTaxId: boolean;
    }
  | {
      type: "update";
      existing?: BillingAddress;
      supportsTaxId: boolean;
      taxIdWarning?: TaxIdWarningType;
    };

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-enter-billing-address",
  template: `
    <form [formGroup]="group">
      <div class="tw-grid tw-grid-cols-12 tw-gap-4">
        <div class="tw-col-span-6">
          <bit-form-field [disableMargin]="true">
            <bit-label>{{ "country" | i18n }}</bit-label>
            <bit-select [formControl]="group.controls.country" data-testid="country">
              @for (selectableCountry of selectableCountries; track selectableCountry.value) {
                <bit-option
                  [value]="selectableCountry.value"
                  [disabled]="selectableCountry.disabled"
                  [label]="selectableCountry.name"
                ></bit-option>
              }
            </bit-select>
          </bit-form-field>
        </div>
        <div class="tw-col-span-6">
          <bit-form-field [disableMargin]="true">
            <bit-label>{{ "zipPostalCodeLabel" | i18n }}</bit-label>
            <input
              bitInput
              type="text"
              [formControl]="group.controls.postalCode"
              autocomplete="postal-code"
              data-testid="postal-code"
            />
          </bit-form-field>
        </div>
        @if (scenario.type === "update") {
          <div class="tw-col-span-6">
            <bit-form-field [disableMargin]="true">
              <bit-label>{{ "address1" | i18n }}</bit-label>
              <input
                bitInput
                type="text"
                [formControl]="group.controls.line1"
                autocomplete="address-line1"
                data-testid="address-line1"
              />
            </bit-form-field>
          </div>
          <div class="tw-col-span-6">
            <bit-form-field [disableMargin]="true">
              <bit-label>{{ "address2" | i18n }}</bit-label>
              <input
                bitInput
                type="text"
                [formControl]="group.controls.line2"
                autocomplete="address-line2"
                data-testid="address-line2"
              />
            </bit-form-field>
          </div>
          <div class="tw-col-span-6">
            <bit-form-field [disableMargin]="true">
              <bit-label>{{ "cityTown" | i18n }}</bit-label>
              <input
                bitInput
                type="text"
                [formControl]="group.controls.city"
                autocomplete="address-level2"
                data-testid="city"
              />
            </bit-form-field>
          </div>
          <div class="tw-col-span-6">
            <bit-form-field [disableMargin]="true">
              <bit-label>{{ "stateProvince" | i18n }}</bit-label>
              <input
                bitInput
                type="text"
                [formControl]="group.controls.state"
                autocomplete="address-level1"
                data-testid="state"
              />
            </bit-form-field>
          </div>
        }
        @if (supportsTaxId$ | async) {
          <div class="tw-col-span-12">
            <bit-form-field [disableMargin]="true">
              <bit-label>{{ "taxIdNumber" | i18n }}</bit-label>
              <input
                bitInput
                type="text"
                [formControl]="group.controls.taxId"
                data-testid="tax-id"
              />
              @let hint = taxIdHint;
              @if (hint) {
                <bit-hint>
                  @if (taxIdWarningActive) {
                    <bit-icon
                      name="bwi-exclamation-triangle"
                      class="tw-mr-1"
                      title="{{ hint }}"
                    ></bit-icon>
                  }
                  {{ hint }}
                </bit-hint>
              }
            </bit-form-field>
          </div>
        }
      </div>
    </form>
  `,
  standalone: true,
  imports: [SharedModule],
})
export class EnterBillingAddressComponent implements OnInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) scenario!: Scenario;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) group!: BillingAddressFormGroup;

  protected selectableCountries = selectableCountries;
  protected supportsTaxId$!: Observable<boolean>;

  private destroy$ = new Subject<void>();

  constructor(private i18nService: I18nService) {}

  ngOnInit() {
    switch (this.scenario.type) {
      case "checkout": {
        this.disableAddressControls();
        break;
      }
      case "update": {
        if (this.scenario.existing) {
          this.group.patchValue({
            ...this.scenario.existing,
            taxId: this.scenario.existing.taxId?.value,
          });
        }
      }
    }

    this.supportsTaxId$ = this.group.controls.country.valueChanges.pipe(
      startWith(this.group.value.country ?? this.selectableCountries[0].value),
      map((country) => {
        if (!this.scenario.supportsTaxId || country === "US") {
          return false;
        }

        return taxIdTypes.filter((taxIdType) => taxIdType.iso === country).length > 0;
      }),
    );

    this.supportsTaxId$
      .pipe(startWith(undefined), pairwise(), takeUntil(this.destroy$))
      .subscribe(([previouslySupported, supportsTaxId]) => {
        if (supportsTaxId) {
          this.group.controls.taxId.enable();
        } else {
          this.group.controls.taxId.disable();
          if (previouslySupported) {
            this.group.controls.taxId.reset();
          }
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  disableAddressControls = () => {
    this.group.controls.line1.disable();
    this.group.controls.line2.disable();
    this.group.controls.city.disable();
    this.group.controls.state.disable();
  };

  get taxIdHint(): string | null {
    return this.computeTaxIdHint(this.group.value.country, this.group.value.taxId);
  }

  get taxIdWarningActive(): boolean {
    return (
      this.scenario.type === "update" &&
      this.scenario.taxIdWarning === TaxIdWarningTypes.FailedVerification
    );
  }

  private computeTaxIdHint(country: string | null | undefined, taxId: string | null | undefined) {
    if (!this.scenario.supportsTaxId || !country || country === "US") {
      return null;
    }
    const types = taxIdTypes.filter((type) => type.iso === country);
    if (types.length === 0) {
      return null;
    }
    const resolved =
      types.length === 1 ? types[0] : taxId ? findTaxIdTypeByValue(types, taxId) : undefined;

    if (this.taxIdWarningActive) {
      const check = this.i18nService.t("checkInputFormat");
      return resolved
        ? `${check} ${this.i18nService.t("taxIdFormatExample", resolved.example)}`
        : check;
    }

    if (types.length === 1) {
      return this.i18nService.t("taxIdFormatExample", types[0].example);
    }

    return resolved ? this.i18nService.t("recognizedTaxIdFormat", resolved.description) : null;
  }

  static getFormGroup = (): BillingAddressFormGroup =>
    new FormGroup({
      country: new FormControl<string>("", {
        nonNullable: true,
        validators: [Validators.required],
      }),
      postalCode: new FormControl<string>("", {
        nonNullable: true,
        validators: [Validators.required],
      }),
      line1: new FormControl<string | null>(null),
      line2: new FormControl<string | null>(null),
      city: new FormControl<string | null>(null),
      state: new FormControl<string | null>(null),
      taxId: new FormControl<string | null>(null),
    });
}
