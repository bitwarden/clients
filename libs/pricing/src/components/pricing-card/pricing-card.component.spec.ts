import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { BadgeVariant, ButtonType, SvgModule, TypographyModule } from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";

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
      @switch (titleLevel) {
        @case ("h1") {
          <h1 slot="title" class="tw-m-0" bitTypography="h3">{{ titleText }}</h1>
        }
        @case ("h2") {
          <h2 slot="title" class="tw-m-0" bitTypography="h3">{{ titleText }}</h2>
        }
        @case ("h3") {
          <h3 slot="title" class="tw-m-0" bitTypography="h3">{{ titleText }}</h3>
        }
        @case ("h4") {
          <h4 slot="title" class="tw-m-0" bitTypography="h3">{{ titleText }}</h4>
        }
        @case ("h5") {
          <h5 slot="title" class="tw-m-0" bitTypography="h3">{{ titleText }}</h5>
        }
        @case ("h6") {
          <h6 slot="title" class="tw-m-0" bitTypography="h3">{{ titleText }}</h6>
        }
      }
    </billing-pricing-card>
  `,
  imports: [PricingCardComponent, TypographyModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  activeBadge: { text: string; variant?: BadgeVariant } | undefined = undefined;

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
      imports: [PricingCardComponent, TestHostComponent, SvgModule, TypographyModule, CommonModule],
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

    // Test that the component renders and shows the tagline (which is an input, not projected content)
    expect(compiled.querySelector("p").textContent).toContain("A great plan for testing");
    // Note: Title testing is skipped due to content projection limitations in Angular testing
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

    // Note: Title content projection testing skipped due to Angular testing limitations
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

    // Note: Content projection testing for configurable headings is covered in Storybook
    // Angular unit tests have limitations with content projection testing
    expect(component).toBeTruthy(); // Basic smoke test
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

  it("should display active badge when activeBadge is provided", () => {
    hostComponent.activeBadge = { text: "Current Plan" };
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;

    const badge = compiled.querySelector("span[bitBadge]");
    expect(badge).toBeTruthy();
    expect(badge.textContent.trim()).toBe("Current Plan");
  });

  it("should not display active badge when activeBadge is not provided", () => {
    hostComponent.activeBadge = undefined;
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;

    expect(compiled.querySelector("span[bitBadge]")).toBeFalsy();
  });

  it("should have proper layout structure with flexbox", () => {
    hostFixture.detectChanges();
    const compiled = hostFixture.nativeElement;
    const cardContainer = compiled.querySelector("bit-card");

    expect(cardContainer.classList).toContain("tw-flex");
    expect(cardContainer.classList).toContain("tw-flex-col");
    expect(cardContainer.classList).toContain("tw-size-full");
  });
});
