// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Subject, takeUntil } from "rxjs";
import { debounceTime } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import { CountryListItem } from "@bitwarden/common/billing/models/domain";
import { ExpandedTaxInfoUpdateRequest } from "@bitwarden/common/billing/models/request/expanded-tax-info-update.request";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { SharedModule } from "../../shared";

/**
 * @deprecated Use `ManageTaxInformationComponent` instead.
 */
@Component({
  selector: "app-tax-info",
  templateUrl: "tax-info.component.html",
  imports: [SharedModule],
})
export class TaxInfoComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() trialFlow = false;
  @Output() countryChanged = new EventEmitter();
  @Output() taxInformationChanged: EventEmitter<void> = new EventEmitter<void>();

  taxFormGroup = new FormGroup({
    country: new FormControl<string>(null, [Validators.required]),
    postalCode: new FormControl<string>(null, [Validators.required]),
    taxId: new FormControl<string>(null),
    line1: new FormControl<string>(null),
    line2: new FormControl<string>(null),
    city: new FormControl<string>(null),
    state: new FormControl<string>(null),
  });

  protected isTaxSupported: boolean;

  loading = true;
  organizationId: string;
  providerId: string;
  countryList: CountryListItem[] = this.taxService.getCountries();

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    private logService: LogService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private taxService: TaxServiceAbstraction,
  ) {}

  get country(): string {
    return this.taxFormGroup.controls.country.value;
  }

  get postalCode(): string {
    return this.taxFormGroup.controls.postalCode.value;
  }

  get taxId(): string {
    return this.taxFormGroup.controls.taxId.value;
  }

  get line1(): string {
    return this.taxFormGroup.controls.line1.value;
  }

  get line2(): string {
    return this.taxFormGroup.controls.line2.value;
  }

  get city(): string {
    return this.taxFormGroup.controls.city.value;
  }

  get state(): string {
    return this.taxFormGroup.controls.state.value;
  }

  get showTaxIdField(): boolean {
    return !!this.organizationId;
  }

  async ngOnInit() {
    // Provider setup
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
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
            this.taxFormGroup.controls.taxId.setValue(taxInfo.taxId);
            this.taxFormGroup.controls.state.setValue(taxInfo.state);
            this.taxFormGroup.controls.line1.setValue(taxInfo.line1);
            this.taxFormGroup.controls.line2.setValue(taxInfo.line2);
            this.taxFormGroup.controls.city.setValue(taxInfo.city);
            this.taxFormGroup.controls.postalCode.setValue(taxInfo.postalCode);
            this.taxFormGroup.controls.country.setValue(taxInfo.country);
          }
        } catch (e) {
          this.logService.error(e);
        }
      } else {
        try {
          const taxInfo = await this.apiService.getTaxInfo();
          if (taxInfo) {
            this.taxFormGroup.controls.postalCode.setValue(taxInfo.postalCode);
            this.taxFormGroup.controls.country.setValue(taxInfo.country);
          }
        } catch (e) {
          this.logService.error(e);
        }
      }

      this.isTaxSupported = await this.taxService.isCountrySupported(
        this.taxFormGroup.controls.country.value,
      );

      this.countryChanged.emit();
    });

    this.taxFormGroup.controls.country.valueChanges
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe((value) => {
        this.taxService
          .isCountrySupported(this.taxFormGroup.controls.country.value)
          .then((isSupported) => {
            this.isTaxSupported = isSupported;
          })
          .catch(() => {
            this.isTaxSupported = false;
          })
          .finally(() => {
            if (!this.isTaxSupported) {
              this.taxFormGroup.controls.taxId.setValue(null);
              this.taxFormGroup.controls.line1.setValue(null);
              this.taxFormGroup.controls.line2.setValue(null);
              this.taxFormGroup.controls.city.setValue(null);
              this.taxFormGroup.controls.state.setValue(null);
            }

            this.countryChanged.emit();
          });
        this.taxInformationChanged.emit();
      });

    this.taxFormGroup.controls.postalCode.valueChanges
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => {
        this.taxInformationChanged.emit();
      });

    this.taxFormGroup.controls.taxId.valueChanges
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => {
        this.taxInformationChanged.emit();
      });

    this.loading = false;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submitTaxInfo(): Promise<any> {
    this.taxFormGroup.updateValueAndValidity();
    this.taxFormGroup.markAllAsTouched();

    const request = new ExpandedTaxInfoUpdateRequest();
    request.country = this.country;
    request.postalCode = this.postalCode;
    request.taxId = this.taxId;
    request.line1 = this.line1;
    request.line2 = this.line2;
    request.city = this.city;
    request.state = this.state;

    return this.organizationId
      ? this.organizationApiService.updateTaxInfo(
          this.organizationId,
          request as ExpandedTaxInfoUpdateRequest,
        )
      : this.apiService.putTaxInfo(request);
  }
}
