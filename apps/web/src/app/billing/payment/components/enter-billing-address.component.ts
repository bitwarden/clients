import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { map, Observable, startWith, Subject, takeUntil } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  TaxIdWarningType,
  TaxIdWarningTypes,
} from "@bitwarden/web-vault/app/billing/warnings/types";

import { SharedModule } from "../../../shared";
import { BillingAddress, getTaxIdTypeForCountry, selectableCountries, taxIdTypes } from "../types";

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
  const taxIdType = taxId ? getTaxIdTypeForCountry(addressFields.country) : null;
  return taxIdType
    ? { ...addressFields, taxId: { code: taxIdType.code, value: taxId! } }
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
            <bit-label>{{ "zipPostalCode" | i18n }}</bit-label>
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
              @let hint = taxIdWarningHint;
              @if (hint) {
                <bit-hint
                  ><i
                    class="bwi bwi-exclamation-triangle tw-mr-1"
                    title="{{ hint }}"
                    aria-hidden="true"
                  ></i
                  >{{ hint }}</bit-hint
                >
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

    this.supportsTaxId$.pipe(takeUntil(this.destroy$)).subscribe((supportsTaxId) => {
      if (supportsTaxId) {
        this.group.controls.taxId.enable();
      } else {
        this.group.controls.taxId.disable();
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

  get taxIdWarningHint() {
    if (
      this.scenario.type === "checkout" ||
      !this.scenario.supportsTaxId ||
      !this.group.value.country ||
      this.scenario.taxIdWarning !== TaxIdWarningTypes.FailedVerification
    ) {
      return null;
    }

    const taxIdType = getTaxIdTypeForCountry(this.group.value.country);

    if (!taxIdType) {
      return null;
    }

    const checkInputFormat = this.i18nService.t("checkInputFormat");

    switch (taxIdType.code) {
      case "au_abn": {
        const exampleFormat = this.i18nService.t("exampleTaxIdFormat", "ABN", taxIdType.example);
        return `${checkInputFormat} ${exampleFormat}`;
      }
      case "eu_vat": {
        const exampleFormat = this.i18nService.t("exampleTaxIdFormat", "EU VAT", taxIdType.example);
        return `${checkInputFormat} ${exampleFormat}`;
      }
      case "gb_vat": {
        const exampleFormat = this.i18nService.t("exampleTaxIdFormat", "GB VAT", taxIdType.example);
        return `${checkInputFormat} ${exampleFormat}`;
      }
    }
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
