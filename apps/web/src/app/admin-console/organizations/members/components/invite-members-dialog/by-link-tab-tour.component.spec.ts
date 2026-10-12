import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ByLinkTabTourComponent } from "./by-link-tab-tour.component";

// The tour's opening step is delayed via setTimeout so the popover doesn't anchor to the save
// button's stale pre-animation rect; wait it out with real timers rather than faking them.
const waitForTourStart = () => new Promise((resolve) => setTimeout(resolve, 300));

async function createComponent(): Promise<ComponentFixture<ByLinkTabTourComponent>> {
  const i18nService = mock<I18nService>();
  i18nService.t.mockImplementation((key) => key);

  await TestBed.configureTestingModule({
    imports: [ByLinkTabTourComponent],
    providers: [provideNoopAnimations(), { provide: I18nService, useValue: i18nService }],
  }).compileComponents();

  const fixture = TestBed.createComponent(ByLinkTabTourComponent);
  fixture.detectChanges();
  await waitForTourStart();
  fixture.detectChanges();
  return fixture;
}

function inertContainer(fixture: ComponentFixture<ByLinkTabTourComponent>): Element | null {
  return fixture.nativeElement.querySelector("[inert]");
}

describe("ByLinkTabTourComponent", () => {
  it("renders the dummy allowed domains", async () => {
    const fixture = await createComponent();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="allowedDomains"]',
    );

    expect(input.value).toBe("acme.com, acme.eu, acme.fr, acme.uk");
  });

  it("renders a non-functional, obviously-fake invite link", async () => {
    const fixture = await createComponent();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="inviteLink"]',
    );

    expect(input.value).toContain("example");
  });

  it("wraps the dummy content in an inert container so it can't be interacted with", async () => {
    const fixture = await createComponent();

    expect(inertContainer(fixture)).not.toBeNull();
  });

  it("starts on step 1 once the dialog's open animation has settled", async () => {
    const fixture = await createComponent();

    expect(fixture.componentInstance["tourStep"]()).toBe(1);
  });

  it("does not open the first coach mark immediately on mount", async () => {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    await TestBed.configureTestingModule({
      imports: [ByLinkTabTourComponent],
      providers: [provideNoopAnimations(), { provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ByLinkTabTourComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance["tourStep"]()).toBe(0);
  });

  it("advances through steps 1 to 3 via next()", async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    component["next"]();
    expect(component["tourStep"]()).toBe(2);

    component["next"]();
    expect(component["tourStep"]()).toBe(3);
  });

  it("does not go back past step 1", async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    component["back"]();

    expect(component["tourStep"]()).toBe(1);
  });

  it("goes back a step", async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;

    component["next"]();
    component["back"]();

    expect(component["tourStep"]()).toBe(1);
  });

  it("emits tourFinished instead of advancing past the last step", async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const finished = jest.fn();
    component.tourFinished.subscribe(finished);

    component["next"]();
    component["next"]();
    expect(finished).not.toHaveBeenCalled();

    component["next"]();

    expect(finished).toHaveBeenCalledTimes(1);
    expect(component["tourStep"]()).toBe(3);
  });

  it("does not close the dialog when advancing through the coach marks via Next/Back", async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    const finished = jest.fn();
    component.tourFinished.subscribe(finished);

    const findButton = (label: string): HTMLButtonElement =>
      Array.from(document.body.querySelectorAll("button")).find(
        (button) => button.textContent?.trim() === label,
      ) as HTMLButtonElement;
    const nextButton = () => findButton("next");
    const backButton = () => findButton("back");

    nextButton().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    nextButton().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    backButton().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(finished).not.toHaveBeenCalled();
    expect(component["tourStep"]()).toBe(2);
  });
});
