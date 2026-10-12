import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { of } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { PopoverAnchorForDirective } from "@bitwarden/components";

import { Vfo1TerminologyService } from "../../services/vfo1-terminology.service";
import { CoachmarkStepId } from "../coachmark/coachmark-step";
import { CoachmarkService } from "../coachmark/coachmark.service";

import { NewCipherMenuComponent } from "./new-cipher-menu.component";

describe("NewCipherMenuComponent", () => {
  let fixture: ComponentFixture<NewCipherMenuComponent>;

  const activeStepId = signal<CoachmarkStepId | null>(null);
  const coachmarkService = {
    isStepActive: (stepId: CoachmarkStepId) => activeStepId() === stepId,
    getStepPosition: () => "below-center",
    getStepTitle: () => "",
    getStepDescription: () => "",
    getStepLearnMoreUrl: (): string | undefined => undefined,
    currentStepNumber: () => 1,
    totalSteps: () => 1,
  };

  const popoverOpen = () =>
    fixture.debugElement
      .query(By.directive(PopoverAnchorForDirective))
      .injector.get(PopoverAnchorForDirective)
      .popoverOpen();

  beforeEach(async () => {
    activeStepId.set(null);

    await TestBed.configureTestingModule({
      imports: [NewCipherMenuComponent],
      providers: [
        { provide: RestrictedItemTypesService, useValue: { restricted$: of([]) } },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: () => of(true) },
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: Vfo1TerminologyService, useValue: { enabled: () => false } },
        { provide: CoachmarkService, useValue: coachmarkService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewCipherMenuComponent);
    fixture.componentRef.setInput("canCreateCipher", true);
    fixture.detectChanges();
  });

  it("opens the add item coachmark while that step is active", () => {
    activeStepId.set("addItem");
    fixture.detectChanges();

    expect(popoverOpen()).toBe(true);
  });

  it("keeps the add item coachmark closed when coachmarkEnabled is false", () => {
    fixture.componentRef.setInput("coachmarkEnabled", false);
    activeStepId.set("addItem");
    fixture.detectChanges();

    expect(popoverOpen()).toBe(false);
  });
});
