import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { PricingCardButton, PricingCardPrice } from "../types/pricing-card.types";

import { PricingCardComponent } from "./pricing-card.component";

@Component({
  template: `
    <bit-pricing-card
      [title]="title"
      [tagline]="tagline"
      [price]="price"
      [button]="button"
      [features]="features"
      (buttonClick)="onButtonClick()"
    ></bit-pricing-card>
  `,
  imports: [PricingCardComponent],
})
class TestHostComponent {
  title = "Test Plan";
  tagline = "A great plan for testing";
  price: PricingCardPrice = { amount: 10, cadence: "monthly" };
  button: PricingCardButton = { text: "Select Plan", type: "primary" };
  features = ["Feature 1", "Feature 2", "Feature 3"];

  onButtonClick() {
    // Test method
  }
}

describe("PricingCardComponent", () => {
  let component: PricingCardComponent;
  let fixture: ComponentFixture<PricingCardComponent>;
  let hostComponent: TestHostComponent;
  let hostFixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PricingCardComponent, TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PricingCardComponent);
    component = fixture.componentInstance;

    hostFixture = TestBed.createComponent(TestHostComponent);
    hostComponent = hostFixture.componentInstance;
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should display title and tagline", () => {
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;

    expect(compiled.querySelector("h3").textContent).toContain("Test Plan");
    expect(compiled.querySelector("p").textContent).toContain("A great plan for testing");
  });

  it("should display price when provided", () => {
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;

    expect(compiled.textContent).toContain("$10");
    expect(compiled.textContent).toContain("/ monthly");
  });

  it("should display features when provided", () => {
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;

    expect(compiled.textContent).toContain("Feature 1");
    expect(compiled.textContent).toContain("Feature 2");
    expect(compiled.textContent).toContain("Feature 3");
  });

  it("should emit buttonClick when button is clicked", () => {
    jest.spyOn(hostComponent, "onButtonClick");
    hostFixture.detectChanges();

    const button = hostFixture.nativeElement.querySelector("button");
    button.click();

    expect(hostComponent.onButtonClick).toHaveBeenCalled();
  });

  it("should work without optional inputs", () => {
    hostComponent.price = undefined as any;
    hostComponent.features = undefined as any;

    hostFixture.detectChanges();

    expect(hostFixture.nativeElement.querySelector("h3").textContent).toContain("Test Plan");
    expect(hostFixture.nativeElement.querySelector("button").textContent.trim()).toBe(
      "Select Plan",
    );
  });
});
