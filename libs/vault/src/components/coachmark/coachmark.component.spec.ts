import { signal, ViewContainerRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { FakeGlobalStateProvider } from "../../../../common/spec";

import { CoachmarkComponent } from "./coachmark.component";
import { CoachmarkService } from "./coachmark.service";

describe("CoachmarkComponent", () => {
  let fixture: ComponentFixture<CoachmarkComponent>;

  const currentStepNumber = signal(1);
  const totalSteps = signal(2);
  const coachmarkService = {
    getStepTitle: () => "",
    getStepDescription: () => "",
    getStepLearnMoreUrl: (): string | undefined => undefined,
    currentStepNumber,
    totalSteps,
  };

  /** The popover's content is only rendered when it opens, so this renders its template directly. */
  const primaryButtonText = () => {
    const popover = fixture.componentInstance.popover();
    const view = fixture.debugElement.injector
      .get(ViewContainerRef)
      .createEmbeddedView(popover.templateRef());
    view.detectChanges();
    const buttons = view.rootNodes.flatMap((node: HTMLElement) => [
      ...node.querySelectorAll("button"),
    ]);
    return buttons[buttons.length - 1].textContent.trim();
  };

  beforeEach(async () => {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [CoachmarkComponent],
      providers: [
        { provide: CoachmarkService, useValue: coachmarkService },
        { provide: I18nService, useValue: i18nService },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CoachmarkComponent);
    fixture.componentRef.setInput("stepId", "vaultList");
  });

  it("offers next on a step that is not the last", () => {
    currentStepNumber.set(1);
    fixture.detectChanges();

    expect(primaryButtonText()).toBe("next");
  });

  it("offers done on the last step", () => {
    currentStepNumber.set(2);
    fixture.detectChanges();

    expect(primaryButtonText()).toBe("done");
  });
});
