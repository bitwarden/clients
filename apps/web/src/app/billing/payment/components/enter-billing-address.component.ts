import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { map, Observable, startWith, Subject, takeUntil } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";

import { SharedModule } from "../../../shared";
import { BillingAddress, selectableCountries, taxIdTypes } from "../types";

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

type Scenario =
  | {
      type: "checkout";
      supportsTaxId: boolean;
    }
  | {
      type: "update";
      existing?: BillingAddress;
      supportsTaxId: boolean;
    };

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
        @if (supportsTaxId$ | async) {
          <div class="tw-col-span-6">
            <bit-form-field [disableMargin]="true">
              <bit-label>{{ "taxIdNumber" | i18n }}</bit-label>
              <input
                bitInput
                type="text"
                [formControl]="group.controls.taxId"
                data-testid="tax-id"
              />
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
  @Input({ required: true }) scenario!: Scenario;
  @Input({ required: true }) group!: BillingAddressFormGroup;

  protected selectableCountries = selectableCountries;
  protected supportsTaxId$!: Observable<boolean>;

  private destroy$ = new Subject<void>();

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
        if (!this.scenario.supportsTaxId) {
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
