import { ComponentFixture, TestBed } from "@angular/core/testing";

import { UpgradeAccountDialogComponent } from "./upgrade-account-dialog.component";

describe("UpgradeAccountDialogComponent", () => {
  let component: UpgradeAccountDialogComponent;
  let fixture: ComponentFixture<UpgradeAccountDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpgradeAccountDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UpgradeAccountDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
