import { ComponentFixture, TestBed } from "@angular/core/testing";

import { SendV2Component } from "./send-v2.component";

describe("SendV2Component", () => {
  let component: SendV2Component;
  let fixture: ComponentFixture<SendV2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendV2Component],
    }).compileComponents();

    fixture = TestBed.createComponent(SendV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });
});
