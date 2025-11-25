import { ComponentFixture, TestBed } from "@angular/core/testing";

import { SendsV2Component } from "./send-V2.component";

describe("SendsV2Component", () => {
  let component: SendsV2Component;
  let fixture: ComponentFixture<SendsV2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendsV2Component],
    }).compileComponents();

    fixture = TestBed.createComponent(SendsV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });
});
