// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";
import { debounceTime } from "rxjs/operators";

import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import { CountryListItem, TaxInformation } from "@bitwarden/common/billing/models/domain";

@Component({
  selector: "app-manage-tax-information",
  templateUrl: "./manage-tax-information.component.html",
  standalone: false,
})
export class ManageTaxInformationComponent implements OnInit, OnDestroy, OnChanges {
  @Input() startWith: TaxInformation;
  @Input() onSubmit?: (taxInformation: TaxInformation) => Promise<void>;
  @Input() showTaxIdField: boolean = true;

  /**
   * Emits when the tax information has changed.
   */
  @Output() taxInformationChanged = new EventEmitter<TaxInformation>();

  /**
   * Emits when the tax information has been updated.
   */
  @Output() taxInformationUpdated = new EventEmitter();

  private taxInformation: TaxInformation;

  protected formGroup = this.formBuilder.group({
    country: ["", Validators.required],
    postalCode: ["", Validators.required],
    taxId: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
  });

  protected isTaxSupported: boolean;

  private destroy$ = new Subject<void>();

  protected readonly countries: CountryListItem[] = this.taxService.getCountries();

  constructor(
    private formBuilder: FormBuilder,
    private taxService: TaxServiceAbstraction,
  ) {}

  getTaxInformation(): TaxInformation {
    return this.taxInformation;
  }

  submit = async () => {
    this.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }
    await this.onSubmit?.(this.taxInformation);
    this.taxInformationUpdated.emit();
  };

  validate(): boolean {
    this.markAllAsTouched();
    return this.formGroup.valid;
  }

  markAllAsTouched() {
    this.formGroup.markAllAsTouched();
  }

  async ngOnInit() {
    this.formGroup.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((values) => {
      this.taxInformation = {
        country: values.country,
        postalCode: values.postalCode,
        taxId: values.taxId,
        line1: values.line1,
        line2: values.line2,
        city: values.city,
        state: values.state,
      };
    });

    if (this.startWith) {
      this.formGroup.controls.country.setValue(this.startWith.country);
      this.formGroup.controls.postalCode.setValue(this.startWith.postalCode);

      this.isTaxSupported =
        this.startWith && this.startWith.country
          ? await this.taxService.isCountrySupported(this.startWith.country)
          : false;

      if (this.isTaxSupported) {
        this.formGroup.controls.taxId.setValue(this.startWith.taxId);
        this.formGroup.controls.line1.setValue(this.startWith.line1);
        this.formGroup.controls.line2.setValue(this.startWith.line2);
        this.formGroup.controls.city.setValue(this.startWith.city);
        this.formGroup.controls.state.setValue(this.startWith.state);
      }
    }

    this.formGroup.controls.country.valueChanges
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe((country: string) => {
        this.taxService
          .isCountrySupported(country)
          .then((isSupported) => (this.isTaxSupported = isSupported))
          .catch(() => (this.isTaxSupported = false))
          .finally(() => {
            if (!this.isTaxSupported) {
              this.formGroup.controls.taxId.setValue(null);
              this.formGroup.controls.line1.setValue(null);
              this.formGroup.controls.line2.setValue(null);
              this.formGroup.controls.city.setValue(null);
              this.formGroup.controls.state.setValue(null);
            }
            if (this.taxInformationChanged) {
              this.taxInformationChanged.emit(this.taxInformation);
            }
          });
      });

    this.formGroup.controls.postalCode.valueChanges
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.taxInformationChanged) {
          this.taxInformationChanged.emit(this.taxInformation);
        }
      });

    this.formGroup.controls.taxId.valueChanges
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.taxInformationChanged) {
          this.taxInformationChanged.emit(this.taxInformation);
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Clear the value of the tax-id if states have been changed in the parent component
    const showTaxIdField = changes["showTaxIdField"];
    if (showTaxIdField && !showTaxIdField.currentValue) {
      this.formGroup.controls.taxId.setValue(null);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
