import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ButtonType, IconModule, TypographyModule } from "@bitwarden/components";

import { PricingCardComponent } from "./pricing-card.component";

@Component({
  template: `
    <billing-pricing-card
      [tagline]="tagline"
      [price]="price"
      [button]="button"
      [features]="features"
      [activeBadge]="activeBadge"
      (buttonClick)="onButtonClick()"
    >
      <ng-container [ngSwitch]="titleLevel">
        <!-- eslint-disable-next-line tailwindcss/no-custom-classname -->
        <h1 *ngSwitchCase="'h1'" class="title-slot tw-m-0" bitTypography="h3">{{ titleText }}</h1>
        <!-- eslint-disable-next-line tailwindcss/no-custom-classname -->
        <h2 *ngSwitchCase="'h2'" class="title-slot tw-m-0" bitTypography="h3">{{ titleText }}</h2>
        <!-- eslint-disable-next-line tailwindcss/no-custom-classname -->
        <h3 *ngSwitchCase="'h3'" class="title-slot tw-m-0" bitTypography="h3">{{ titleText }}</h3>
        <!-- eslint-disable-next-line tailwindcss/no-custom-classname -->
        <h4 *ngSwitchCase="'h4'" class="title-slot tw-m-0" bitTypography="h3">{{ titleText }}</h4>
        <!-- eslint-disable-next-line tailwindcss/no-custom-classname -->
        <h5 *ngSwitchCase="'h5'" class="title-slot tw-m-0" bitTypography="h3">{{ titleText }}</h5>
        <!-- eslint-disable-next-line tailwindcss/no-custom-classname -->
        <h6 *ngSwitchCase="'h6'" class="title-slot tw-m-0" bitTypography="h3">{{ titleText }}</h6>
      </ng-container>
    </billing-pricing-card>
  `,
  imports: [PricingCardComponent, CommonModule, TypographyModule],
})
class TestHostComponent {
  titleText = "Test Plan";
  tagline = "A great plan for testing";
  price: { amount: number; cadence: "monthly" | "annually"; showPerUser?: boolean } = {
    amount: 10,
    cadence: "monthly",
  };
  button: { type: ButtonType; text: string; disabled?: boolean } = {
    text: "Select Plan",
    type: "primary",
  };
  features = ["Feature 1", "Feature 2", "Feature 3"];
  titleLevel: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" = "h3";
  activeBadge = { text: "Active plan", show: false };

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
      imports: [
        PricingCardComponent,
        TestHostComponent,
        IconModule,
        TypographyModule,
        CommonModule,
      ],
    }).compileComponents();

    // For signal inputs, we need to set required inputs through the host component
    hostFixture = TestBed.createComponent(TestHostComponent);
    hostComponent = hostFixture.componentInstance;

    fixture = TestBed.createComponent(PricingCardComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should display title and tagline", () => {
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;

    expect(compiled.querySelector("h3")).toBeTruthy();
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
    hostComponent.button = undefined as any;

    hostFixture.detectChanges();

    expect(hostFixture.nativeElement.querySelector("h3").textContent).toContain("Test Plan");
    expect(hostFixture.nativeElement.querySelector("button")).toBeFalsy();
  });

  it("should display per user text when showPerUser is true", () => {
    hostComponent.price = { amount: 5, cadence: "monthly", showPerUser: true };
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;

    expect(compiled.textContent).toContain("$5");
    expect(compiled.textContent).toContain("per user");
  });

  it("should use configurable heading level", () => {
    hostComponent.titleLevel = "h2";
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;

    expect(compiled.querySelector("h2")).toBeTruthy();
    expect(compiled.querySelector("h2").textContent).toContain("Test Plan");
    expect(compiled.querySelector("h3")).toBeFalsy();
  });

  it("should display bwi-check icons for features", () => {
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;
    const icons = compiled.querySelectorAll("i.bwi-check");

    expect(icons.length).toBe(3); // One for each feature
  });

  it("should not display button when button input is not provided", () => {
    hostComponent.button = undefined as any;
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;

    expect(compiled.querySelector("button")).toBeFalsy();
  });

  it("should display active badge when activeBadge.show is true", () => {
    hostComponent.activeBadge = { text: "Current Plan", show: true };
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;

    const badge = compiled.querySelector("span.tw-bg-primary-100");
    expect(badge).toBeTruthy();
    expect(badge.textContent.trim()).toBe("Current Plan");
  });

  it("should not display active badge when activeBadge.show is false", () => {
    hostComponent.activeBadge = { text: "Active plan", show: false };
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;

    expect(compiled.querySelector("span.tw-bg-primary-100")).toBeFalsy();
  });

  it("should have proper layout structure with flexbox", () => {
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;
    const cardContainer = compiled.querySelector("div");

    expect(cardContainer.classList).toContain("tw-flex");
    expect(cardContainer.classList).toContain("tw-flex-col");
    expect(cardContainer.classList).toContain("tw-min-h-[500px]");
    expect(cardContainer.classList).not.toContain("tw-block"); // Should not have conflicting display property
  });
});
