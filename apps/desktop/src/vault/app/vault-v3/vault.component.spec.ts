import { ComponentFixture, TestBed } from "@angular/core/testing";

import { VaultComponent } from "./vault.component";

describe("VaultComponent", () => {
  let component: VaultComponent;
  let fixture: ComponentFixture<VaultComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VaultComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });
});
