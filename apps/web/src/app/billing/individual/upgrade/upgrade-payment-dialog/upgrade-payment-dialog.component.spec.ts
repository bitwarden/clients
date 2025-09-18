import { ComponentFixture, TestBed } from "@angular/core/testing";

import { UpgradePaymentDialogComponent } from "./upgrade-payment-dialog.component";

describe("UpgradePaymentDialogComponent", () => {
  let component: UpgradePaymentDialogComponent;
  let fixture: ComponentFixture<UpgradePaymentDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpgradePaymentDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UpgradePaymentDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
