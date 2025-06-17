import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { map, Observable, Subject, takeUntil } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";

import { SharedModule } from "../../../shared";
import { BillableEntity, getUseCase } from "../../domain";
import { taxIdTypes } from "../../tax/domain";
import { BillingAddress, selectableCountries } from "../domain";

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

export type EnterBillingAddressScenario =
  | {
      type: "checkout";
      useCase: "personal" | "business";
    }
  | {
      type: "update";
      owner: BillableEntity;
      billingAddress: BillingAddress | null;
    };

@Component({
  selector: "app-enter-billing-address",
  templateUrl: "./enter-billing-address.component.html",
  standalone: true,
  imports: [SharedModule],
})
export class EnterBillingAddressComponent implements OnInit, OnDestroy {
  @Input({ required: true }) scenario!: EnterBillingAddressScenario;
  @Input({ required: true }) group!: BillingAddressFormGroup;

  protected selectableCountries = selectableCountries;

  protected supportsTaxId$!: Observable<boolean>;

  private destroy$ = new Subject<void>();
  private useCase!: "personal" | "business";

  constructor() {}

  ngOnInit() {
    switch (this.scenario.type) {
      case "checkout": {
        this.useCase = this.scenario.useCase;
        this.disableAddressControls();
        break;
      }
      case "update": {
        this.useCase = getUseCase(this.scenario.owner);
        if (this.scenario.billingAddress) {
          this.group.patchValue({ ...this.scenario.billingAddress });
        }
      }
    }

    this.supportsTaxId$ = this.group.controls.country.valueChanges.pipe(
      map((country) => {
        if (this.useCase === "personal") {
          return false;
        }

        const taxIdTypesForCountry = taxIdTypes.filter((taxIdType) => taxIdType.iso === country);
        return taxIdTypesForCountry.length > 0;
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
