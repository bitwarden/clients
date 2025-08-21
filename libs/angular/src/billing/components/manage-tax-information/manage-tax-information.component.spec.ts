import { CommonModule } from "@angular/common";
import { SimpleChange } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";

import { TaxServiceAbstraction } from "@bitwarden/common/billing/abstractions/tax.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SelectModule, FormFieldModule, BitSubmitDirective } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ManageTaxInformationComponent } from "./manage-tax-information.component";

describe("ManageTaxInformationComponent", () => {
  let sut: ManageTaxInformationComponent;
  let fixture: ComponentFixture<ManageTaxInformationComponent>;
  let mockTaxService: MockProxy<TaxServiceAbstraction>;

  beforeEach(async () => {
    mockTaxService = mock();
    await TestBed.configureTestingModule({
      declarations: [ManageTaxInformationComponent],
      providers: [
        { provide: TaxServiceAbstraction, useValue: mockTaxService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
      imports: [
        CommonModule,
        ReactiveFormsModule,
        SelectModule,
        FormFieldModule,
        BitSubmitDirective,
        I18nPipe,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageTaxInformationComponent);
    sut = fixture.componentInstance;
    fixture.autoDetectChanges();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("creates successfully", () => {
    expect(sut).toBeTruthy();
  });

  it("should initialize with all values empty in startWith", async () => {
    // Arrange
    sut.startWith = {
      country: "",
      postalCode: "",
      taxId: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
    };

    // Act
    fixture.detectChanges();

    // Assert
    const startWithValue = sut.startWith;
    expect(startWithValue.line1).toHaveLength(0);
    expect(startWithValue.line2).toHaveLength(0);
    expect(startWithValue.city).toHaveLength(0);
    expect(startWithValue.state).toHaveLength(0);
    expect(startWithValue.postalCode).toHaveLength(0);
    expect(startWithValue.country).toHaveLength(0);
    expect(startWithValue.taxId).toHaveLength(0);
  });

  it("should update the tax information protected state when form is updated", async () => {
    // Arrange
    const line1Value = "123 Street";
    const line2Value = "Apt. 5";
    const cityValue = "New York";
    const stateValue = "NY";
    const countryValue = "USA";
    const postalCodeValue = "123 Street";

    sut.startWith = {
      country: countryValue,
      postalCode: "",
      taxId: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
    };
    sut.showTaxIdField = false;
    mockTaxService.isCountrySupported.mockResolvedValue(true);

    // Act
    await sut.ngOnInit();
    fixture.detectChanges();

    const line1: HTMLInputElement = fixture.nativeElement.querySelector(
      "input[formControlName='line1']",
    );
    const line2: HTMLInputElement = fixture.nativeElement.querySelector(
      "input[formControlName='line2']",
    );
    const city: HTMLInputElement = fixture.nativeElement.querySelector(
      "input[formControlName='city']",
    );
    const state: HTMLInputElement = fixture.nativeElement.querySelector(
      "input[formControlName='state']",
    );
    const postalCode: HTMLInputElement = fixture.nativeElement.querySelector(
      "input[formControlName='postalCode']",
    );

    line1.value = line1Value;
    line2.value = line2Value;
    city.value = cityValue;
    state.value = stateValue;
    postalCode.value = postalCodeValue;

    line1.dispatchEvent(new Event("input"));
    line2.dispatchEvent(new Event("input"));
    city.dispatchEvent(new Event("input"));
    state.dispatchEvent(new Event("input"));
    postalCode.dispatchEvent(new Event("input"));
    await fixture.whenStable();

    // Assert

    // Assert that the internal tax information reflects the form
    const taxInformation = sut.getTaxInformation();
    expect(taxInformation.line1).toBe(line1Value);
    expect(taxInformation.line2).toBe(line2Value);
    expect(taxInformation.city).toBe(cityValue);
    expect(taxInformation.state).toBe(stateValue);
    expect(taxInformation.postalCode).toBe(postalCodeValue);
    expect(taxInformation.country).toBe(countryValue);
    expect(taxInformation.taxId).toHaveLength(0);

    expect(mockTaxService.isCountrySupported).toHaveBeenCalledWith(countryValue);
    expect(mockTaxService.isCountrySupported).toHaveBeenCalledTimes(2);
  });

  it("should not show address fields except postal code if country is not supported for taxes", async () => {
    // Arrange
    const countryValue = "UNKNOWN";
    sut.startWith = {
      country: countryValue,
      postalCode: "",
      taxId: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
    };
    sut.showTaxIdField = false;
    mockTaxService.isCountrySupported.mockResolvedValue(false);

    // Act
    await sut.ngOnInit();
    fixture.detectChanges();

    const line1: HTMLInputElement = fixture.nativeElement.querySelector(
      "input[formControlName='line1']",
    );
    const line2: HTMLInputElement = fixture.nativeElement.querySelector(
      "input[formControlName='line2']",
    );
    const city: HTMLInputElement = fixture.nativeElement.querySelector(
      "input[formControlName='city']",
    );
    const state: HTMLInputElement = fixture.nativeElement.querySelector(
      "input[formControlName='state']",
    );
    const postalCode: HTMLInputElement = fixture.nativeElement.querySelector(
      "input[formControlName='postalCode']",
    );

    // Assert
    expect(line1).toBeNull();
    expect(line2).toBeNull();
    expect(city).toBeNull();
    expect(state).toBeNull();
    //Should be visible
    expect(postalCode).toBeTruthy();

    expect(mockTaxService.isCountrySupported).toHaveBeenCalledWith(countryValue);
    expect(mockTaxService.isCountrySupported).toHaveBeenCalledTimes(1);
  });

  it("should not show the tax id field if showTaxIdField is set to false", async () => {
    // Arrange
    const countryValue = "USA";
    sut.startWith = {
      country: countryValue,
      postalCode: "",
      taxId: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
    };

    sut.showTaxIdField = false;
    mockTaxService.isCountrySupported.mockResolvedValue(true);

    // Act
    await sut.ngOnInit();
    fixture.detectChanges();

    // Assert
    const taxId: HTMLInputElement = fixture.nativeElement.querySelector(
      "input[formControlName='taxId']",
    );
    expect(taxId).toBeNull();

    expect(mockTaxService.isCountrySupported).toHaveBeenCalledWith(countryValue);
    expect(mockTaxService.isCountrySupported).toHaveBeenCalledTimes(1);
  });

  it("should clear the tax id field if showTaxIdField is set to false after being true", async () => {
    // Arrange
    const countryValue = "USA";
    const taxIdValue = "A12345678";

    sut.startWith = {
      country: countryValue,
      postalCode: "",
      taxId: taxIdValue,
      line1: "",
      line2: "",
      city: "",
      state: "",
    };
    sut.showTaxIdField = true;

    mockTaxService.isCountrySupported.mockResolvedValue(true);
    await sut.ngOnInit();
    fixture.detectChanges();
    const initialTaxIdValue = fixture.nativeElement.querySelector(
      "input[formControlName='taxId']",
    ).value;

    // Act
    sut.showTaxIdField = false;
    sut.ngOnChanges({ showTaxIdField: new SimpleChange(true, false, false) });
    fixture.detectChanges();

    // Assert
    const taxId = fixture.nativeElement.querySelector("input[formControlName='taxId']");
    expect(taxId).toBeNull();

    const taxInformation = sut.getTaxInformation();
    expect(taxInformation.taxId).toBeNull();
    expect(initialTaxIdValue).toEqual(taxIdValue);

    expect(mockTaxService.isCountrySupported).toHaveBeenCalledWith(countryValue);
    expect(mockTaxService.isCountrySupported).toHaveBeenCalledTimes(1);
  });
});
