import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CenterPositionStrategy,
  DIALOG_DATA,
  DialogRef,
  DialogService,
} from "@bitwarden/components";

import {
  PremiumCheckoutProcessingComponent,
  PremiumCheckoutProcessingDialogData,
} from "./premium-checkout-processing.component";

describe("PremiumCheckoutProcessingComponent", () => {
  const data: PremiumCheckoutProcessingDialogData = { featureNameKey: "totpFeatureName" };
  let fixture: ComponentFixture<PremiumCheckoutProcessingComponent>;
  let dialogRef: MockProxy<DialogRef>;

  const query = (selector: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(selector);

  beforeEach(async () => {
    dialogRef = mock<DialogRef>({ isDrawer: false, disableClose: false });
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string, p1?: string | number) =>
      p1 == null ? key : `${key}(${p1})`,
    );

    await TestBed.configureTestingModule({
      imports: [PremiumCheckoutProcessingComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PremiumCheckoutProcessingComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("renders the info icon, the title and a body naming the feature", () => {
    expect(query("bit-icon[name='bwi-info-circle']")).not.toBeNull();
    expect(query("h1")?.textContent).toContain("confirmingYourUpgrade");
    expect(fixture.nativeElement.textContent).toContain(
      "confirmingYourUpgradeDesc(totpFeatureName)",
    );
  });

  it("closes the dialog when Close is clicked", () => {
    const closeButton = query("#premium-checkout-processing_button_close");

    expect(closeButton?.textContent?.trim()).toBe("close");
    closeButton?.click();

    expect(dialogRef.close).toHaveBeenCalledTimes(1);
  });

  it("opens centred with the feature name as dialog data", () => {
    const dialogService = mock<DialogService>();

    PremiumCheckoutProcessingComponent.open(dialogService, data);

    const [component, config] = dialogService.open.mock.calls[0];
    expect(component).toBe(PremiumCheckoutProcessingComponent);
    expect(config?.data).toBe(data);
    expect(config?.positionStrategy).toBeInstanceOf(CenterPositionStrategy);
  });
});
