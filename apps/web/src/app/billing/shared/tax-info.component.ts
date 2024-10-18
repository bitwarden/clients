import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { from, Subject, takeUntil, tap } from "rxjs";
import { debounceTime, switchMap } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import { TaxableCountry } from "@bitwarden/common/billing/models/domain/taxable-country";
import { CalculateTaxRequest } from "@bitwarden/common/billing/models/request/calculate-tax.request";
import { ExpandedTaxInfoUpdateRequest } from "@bitwarden/common/billing/models/request/expanded-tax-info-update.request";
import { TaxInfoUpdateRequest } from "@bitwarden/common/billing/models/request/tax-info-update.request";
import { TaxInfoResponse } from "@bitwarden/common/billing/models/response/tax-info.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { SharedModule } from "../../shared";

type TaxInfoView = Omit<TaxInfoResponse, "taxIdType"> & {
  includeTaxId: boolean;
  [key: string]: unknown;
};

@Component({
  selector: "app-tax-info",
  templateUrl: "tax-info.component.html",
  standalone: true,
  imports: [SharedModule],
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class TaxInfoComponent implements OnInit {
  @Input() trialFlow = false;
  @Output() onCountryChanged = new EventEmitter();
  private destroy$ = new Subject<void>();

  taxFormGroup = new FormGroup({
    country: new FormControl(null, [Validators.required]),
    postalCode: new FormControl(null),
    includeTaxId: new FormControl(null),
    taxId: new FormControl(null),
    line1: new FormControl(null),
    line2: new FormControl(null),
    city: new FormControl(null),
    state: new FormControl(null),
  });

  loading = false;
  organizationId: string;
  providerId: string;
  taxInfo: TaxInfoView = {
    taxId: null,
    line1: null,
    line2: null,
    city: null,
    state: null,
    postalCode: null,
    country: "US",
    includeTaxId: false,
  };
  readonly countryList: TaxableCountry[];
  taxRate: number;

  constructor(
    private apiService: ApiService,
    private billingApiService: BillingApiServiceAbstraction,
    private taxService: TaxServiceAbstraction,
    private route: ActivatedRoute,
    private logService: LogService,
    private organizationApiService: OrganizationApiServiceAbstraction,
  ) {
    this.countryList = this.taxService.getSelectableCountries();
  }

  get country(): string {
    return this.taxFormGroup.get("country").value;
  }

  set country(country: string) {
    this.taxFormGroup.get("country").setValue(country);
  }

  get postalCode(): string {
    return this.taxFormGroup.get("postalCode").value;
  }

  set postalCode(postalCode: string) {
    this.taxFormGroup.get("postalCode").setValue(postalCode);
  }

  get includeTaxId(): boolean {
    return this.taxFormGroup.get("includeTaxId").value;
  }

  set includeTaxId(includeTaxId: boolean) {
    this.taxFormGroup.get("includeTaxId").setValue(includeTaxId);
  }

  get taxId(): string {
    return this.taxFormGroup.get("taxId").value;
  }

  set taxId(taxId: string) {
    this.taxFormGroup.get("taxId").setValue(taxId);
  }

  get line1(): string {
    return this.taxFormGroup.get("line1").value;
  }

  set line1(line1: string) {
    this.taxFormGroup.get("line1").setValue(line1);
  }

  get line2(): string {
    return this.taxFormGroup.get("line2").value;
  }

  set line2(line2: string) {
    this.taxFormGroup.get("line2").setValue(line2);
  }

  get city(): string {
    return this.taxFormGroup.get("city").value;
  }

  set city(city: string) {
    this.taxFormGroup.get("city").setValue(city);
  }

  get state(): string {
    return this.taxFormGroup.get("state").value;
  }

  set state(state: string) {
    this.taxFormGroup.get("state").setValue(state);
  }

  async ngOnInit() {
    // Provider setup
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.subscribe((params) => {
      this.providerId = params.providerId;
    });

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent?.parent?.params.subscribe(async (params) => {
      this.organizationId = params.organizationId;
      if (this.organizationId) {
        try {
          const taxInfo = await this.organizationApiService.getTaxInfo(this.organizationId);
          if (taxInfo) {
            this.taxId = taxInfo.taxId;
            this.state = taxInfo.state;
            this.line1 = taxInfo.line1;
            this.line2 = taxInfo.line2;
            this.city = taxInfo.city;
            this.state = taxInfo.state;
            this.postalCode = taxInfo.postalCode;
            this.country = taxInfo.country || "US";
            this.includeTaxId =
              this.taxService.isSupportedCountry(this.country) &&
              (!!taxInfo.taxId ||
                !!taxInfo.line1 ||
                !!taxInfo.line2 ||
                !!taxInfo.city ||
                !!taxInfo.state);
            this.setTaxInfoObject();
          }
        } catch (e) {
          this.logService.error(e);
        }
      } else {
        try {
          const taxInfo = await this.apiService.getTaxInfo();
          if (taxInfo) {
            this.postalCode = taxInfo.postalCode;
            this.country = taxInfo.country || "US";
          }
          this.setTaxInfoObject();
        } catch (e) {
          this.logService.error(e);
        }
      }

      if (this.country === "US") {
        this.taxFormGroup.get("postalCode").setValidators([Validators.required]);
        this.taxFormGroup.get("postalCode").updateValueAndValidity();
      }

      if (this.country !== "US") {
        this.onCountryChanged.emit();
      }
    });

    this.taxFormGroup
      .get("country")
      .valueChanges.pipe(
        tap((value) => {
          if (value === "US") {
            this.taxFormGroup.get("postalCode").setValidators([Validators.required]);
          } else {
            this.taxFormGroup.get("postalCode").clearValidators();
          }
          this.taxFormGroup.get("postalCode").updateValueAndValidity();
        }),
        debounceTime(1000),
        switchMap(() => from(this.calculateSalesTax())),
        takeUntil(this.destroy$),
      )
      .subscribe();
    this.taxFormGroup
      .get("postalCode")
      .valueChanges.pipe(
        debounceTime(1000),
        switchMap(() => from(this.calculateSalesTax())),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  setTaxInfoObject() {
    this.taxInfo.country = this.country;
    this.taxInfo.postalCode = this.postalCode;
    this.taxInfo.includeTaxId = this.includeTaxId;
    this.taxInfo.taxId = this.taxId;
    this.taxInfo.line1 = this.line1;
    this.taxInfo.line2 = this.line2;
    this.taxInfo.city = this.city;
    this.taxInfo.state = this.state;
  }

  get showTaxIdCheckbox() {
    return (
      (this.organizationId || this.providerId) &&
      this.country !== "US" &&
      this.taxService.isSupportedCountry(this.taxInfo.country)
    );
  }

  get showTaxIdFields() {
    return (
      (this.organizationId || this.providerId) &&
      this.includeTaxId &&
      this.taxService.isSupportedCountry(this.country)
    );
  }

  getTaxInfoRequest(): TaxInfoUpdateRequest {
    if (this.organizationId || this.providerId) {
      const request = new ExpandedTaxInfoUpdateRequest();
      request.country = this.country;
      request.postalCode = this.postalCode;

      if (this.includeTaxId) {
        request.taxId = this.taxId;
        request.line1 = this.line1;
        request.line2 = this.line2;
        request.city = this.city;
        request.state = this.state;
      } else {
        request.taxId = null;
        request.line1 = null;
        request.line2 = null;
        request.city = null;
        request.state = null;
      }
      return request;
    } else {
      const request = new TaxInfoUpdateRequest();
      request.postalCode = this.postalCode;
      request.country = this.country;
      return request;
    }
  }

  submitTaxInfo(): Promise<any> {
    this.taxFormGroup.updateValueAndValidity();
    this.taxFormGroup.markAllAsTouched();
    const request = this.getTaxInfoRequest();
    return this.organizationId
      ? this.organizationApiService.updateTaxInfo(
          this.organizationId,
          request as ExpandedTaxInfoUpdateRequest,
        )
      : this.apiService.putTaxInfo(request);
  }

  changeCountry() {
    this.onCountryChanged.emit();
  }

  private async calculateSalesTax() {
    this.setTaxInfoObject();
    const request = new CalculateTaxRequest();
    request.amount = 0;
    request.country = this.country;
    request.postalCode = this.postalCode;
    try {
      this.loading = true;
      const calculatedTax = await this.billingApiService.calculateTax(request);
      this.taxRate = calculatedTax.salesTaxRate;
    } catch (e) {
      this.logService.error(e);
    } finally {
      this.loading = false;
    }
    this.changeCountry();
  }
}
