import { ComponentFixture, TestBed } from "@angular/core/testing";

import { SendsComponent } from "./sends.component";

describe("SendsComponent", () => {
  let component: SendsComponent;
  let fixture: ComponentFixture<SendsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SendsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });
});
