import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SimplifiedAutofillInfoComponent } from "./simplified-autofill-info.component";

describe("SimplifiedAutofillInfoComponent", () => {
  let component: SimplifiedAutofillInfoComponent;
  let fixture: ComponentFixture<SimplifiedAutofillInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimplifiedAutofillInfoComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(SimplifiedAutofillInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should render the info button with pulsing animation", () => {
    const button = fixture.debugElement.query(By.css("button[bitLink]"));
    expect(button).toBeTruthy();

    const iconContainer = fixture.debugElement.query(
      By.css(".tw-flex.tw-items-center.tw-justify-center"),
    );
    expect(iconContainer).toBeTruthy();
    expect(iconContainer.nativeElement.className).toContain("before:tw-animate-pulse");
  });

  it("should render the info icon", () => {
    const icon = fixture.debugElement.query(By.css('bit-icon[name="bwi-info-circle"]'));
    expect(icon).toBeTruthy();
  });

  it("should have popover with correct title", () => {
    const popover = fixture.debugElement.query(By.css("bit-popover"));
    expect(popover).toBeTruthy();
    expect(popover.nativeElement.getAttribute("ng-reflect-title")).toBe("simplifiedAutofill");
  });

  it("should render popover content with description", () => {
    const popoverContent = fixture.debugElement.query(By.css("bit-popover p"));
    expect(popoverContent).toBeTruthy();
    expect(popoverContent.nativeElement.textContent.trim()).toBe("simplifiedAutofillDescription");
  });

  it("should render 'Got it' button in popover", () => {
    const gotItButton = fixture.debugElement.query(By.css("bit-popover button[bitButton]"));
    expect(gotItButton).toBeTruthy();
    expect(gotItButton.nativeElement.textContent.trim()).toBe("gotIt");
  });

  it("should have button with correct accessibility title", () => {
    const button = fixture.debugElement.query(By.css("button[bitLink]"));
    expect(button.nativeElement.getAttribute("ng-reflect-app-a11y-title")).toBe(
      "openSimplifiedAutofillPopover",
    );
  });

  it("should render content in a slot for projection", () => {
    const slotContainer = fixture.debugElement.query(By.css("div[slot='title-end']"));
    expect(slotContainer).toBeTruthy();
  });
});
