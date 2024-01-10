import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationTaxInfoUpdateRequest } from "@bitwarden/common/billing/models/request/organization-tax-info-update.request";
import { TaxInfoUpdateRequest } from "@bitwarden/common/billing/models/request/tax-info-update.request";
import { TaxInfoResponse } from "@bitwarden/common/billing/models/response/tax-info.response";
import { TaxRateResponse } from "@bitwarden/common/billing/models/response/tax-rate.response";
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

  loading = true;
  organizationId: string;
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

  taxRates: TaxRateResponse[];

  private pristine: TaxInfoView = {
    taxId: null,
    line1: null,
    line2: null,
    city: null,
    state: null,
    postalCode: null,
    country: "US",
    includeTaxId: false,
  };

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    private logService: LogService,
    private organizationApiService: OrganizationApiServiceAbstraction,
  ) {}

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      this.organizationId = params.organizationId;
      if (this.organizationId) {
        try {
          const taxInfo = await this.organizationApiService.getTaxInfo(this.organizationId);
          if (taxInfo) {
            this.taxInfo.taxId = taxInfo.taxId;
            this.taxInfo.state = taxInfo.state;
            this.taxInfo.line1 = taxInfo.line1;
            this.taxInfo.line2 = taxInfo.line2;
            this.taxInfo.city = taxInfo.city;
            this.taxInfo.state = taxInfo.state;
            this.taxInfo.postalCode = taxInfo.postalCode;
            this.taxInfo.country = taxInfo.country || "US";
            this.taxInfo.includeTaxId =
              this.countrySupportsTax(this.taxInfo.country) &&
              (!!taxInfo.taxId ||
                !!taxInfo.line1 ||
                !!taxInfo.line2 ||
                !!taxInfo.city ||
                !!taxInfo.state);
          }
        } catch (e) {
          this.logService.error(e);
        }
      } else {
        try {
          const taxInfo = await this.apiService.getTaxInfo();
          if (taxInfo) {
            this.taxInfo.postalCode = taxInfo.postalCode;
            this.taxInfo.country = taxInfo.country || "US";
          }
        } catch (e) {
          this.logService.error(e);
        }
      }
      this.pristine = Object.assign({}, this.taxInfo);
      // If not the default (US) then trigger onCountryChanged
      if (this.taxInfo.country !== "US") {
        this.onCountryChanged.emit();
      }
    });

    try {
      const taxRates = await this.apiService.getTaxRates();
      if (taxRates) {
        this.taxRates = taxRates.data;
      }
    } catch (e) {
      this.logService.error(e);
    } finally {
      this.loading = false;
    }
  }

  get taxRate() {
    if (this.taxRates != null) {
      const localTaxRate = this.taxRates.find(
        (x) => x.country === this.taxInfo.country && x.postalCode === this.taxInfo.postalCode,
      );
      return localTaxRate?.rate ?? null;
    }
  }

  getTaxInfoRequest(): TaxInfoUpdateRequest {
    if (this.organizationId) {
      const request = new OrganizationTaxInfoUpdateRequest();
      request.country = this.taxInfo.country;
      request.postalCode = this.taxInfo.postalCode;

      if (this.taxInfo.includeTaxId) {
        request.taxId = this.taxInfo.taxId;
        request.line1 = this.taxInfo.line1;
        request.line2 = this.taxInfo.line2;
        request.city = this.taxInfo.city;
        request.state = this.taxInfo.state;
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
      request.postalCode = this.taxInfo.postalCode;
      request.country = this.taxInfo.country;
      return request;
    }
  }

  submitTaxInfo(): Promise<any> {
    if (!this.hasChanged()) {
      return new Promise<void>((resolve) => {
        resolve();
      });
    }
    const request = this.getTaxInfoRequest();
    return this.organizationId
      ? this.organizationApiService.updateTaxInfo(
          this.organizationId,
          request as OrganizationTaxInfoUpdateRequest,
        )
      : this.apiService.putTaxInfo(request);
  }

  changeCountry() {
    if (!this.countrySupportsTax(this.taxInfo.country)) {
      this.taxInfo.includeTaxId = false;
      this.taxInfo.taxId = null;
      this.taxInfo.line1 = null;
      this.taxInfo.line2 = null;
      this.taxInfo.city = null;
      this.taxInfo.state = null;
    }
    this.onCountryChanged.emit();
  }

  countrySupportsTax(countryCode: string) {
    return this.taxSupportedCountryCodes.includes(countryCode);
  }

  private hasChanged(): boolean {
    for (const key in this.taxInfo) {
      // eslint-disable-next-line
      if (this.pristine.hasOwnProperty(key) && this.pristine[key] !== this.taxInfo[key]) {
        return true;
      }
    }
    return false;
  }

  private taxSupportedCountryCodes: string[] = [
    "CN",
    "FR",
    "DE",
    "CA",
    "GB",
    "AU",
    "IN",
    "AD",
    "AR",
    "AT",
    "BE",
    "BO",
    "BR",
    "BG",
    "CL",
    "CO",
    "CR",
    "HR",
    "CY",
    "CZ",
    "DK",
    "DO",
    "EC",
    "EG",
    "SV",
    "EE",
    "FI",
    "GE",
    "GR",
    "HK",
    "HU",
    "IS",
    "ID",
    "IQ",
    "IE",
    "IL",
    "IT",
    "JP",
    "KE",
    "KR",
    "LV",
    "LI",
    "LT",
    "LU",
    "MY",
    "MT",
    "MX",
    "NL",
    "NZ",
    "NO",
    "PE",
    "PH",
    "PL",
    "PT",
    "RO",
    "RU",
    "SA",
    "RS",
    "SG",
    "SK",
    "SI",
    "ZA",
    "ES",
    "SE",
    "CH",
    "TW",
    "TH",
    "TR",
    "UA",
    "AE",
    "UY",
    "VE",
    "VN",
  ];
}
