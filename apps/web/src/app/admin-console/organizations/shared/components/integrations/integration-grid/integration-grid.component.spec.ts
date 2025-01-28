import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { IntegrationType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { SharedModule } from "@bitwarden/components/src/shared";
import { I18nPipe } from "@bitwarden/ui-common";

import { IntegrationCardComponent } from "../integration-card/integration-card.component";
import { Integration } from "../models";

import { IntegrationGridComponent } from "./integration-grid.component";

describe("IntegrationGridComponent", () => {
  let component: IntegrationGridComponent;
  let fixture: ComponentFixture<IntegrationGridComponent>;
  const integrations: Integration[] = [
    {
      name: "Integration 1",
      image: "test-image1.png",
      linkURL: "https://example.com/1",
      type: IntegrationType.Integration,
    },
    {
      name: "SDK 2",
      image: "test-image2.png",
      linkURL: "https://example.com/2",
      type: IntegrationType.SDK,
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IntegrationGridComponent, IntegrationCardComponent, SharedModule],
      providers: [
        {
          provide: ThemeStateService,
          useValue: mock<ThemeStateService>(),
        },
        {
          provide: SYSTEM_THEME_OBSERVABLE,
          useValue: of(ThemeTypes.Light),
        },
        {
          provide: I18nPipe,
          useValue: mock<I18nPipe>(),
        },
        {
          provide: I18nService,
          useValue: mock<I18nService>({ t: (key, p1) => key + " " + p1 }),
        },
      ],
    });

    fixture = TestBed.createComponent(IntegrationGridComponent);
    component = fixture.componentInstance;
    component.integrations = integrations;
    component.ariaI18nKey = "integrationCardAriaLabel";
    component.tooltipI18nKey = "integrationCardTooltip";
    fixture.detectChanges();
  });

  it("lists all integrations", () => {
    expect(component.integrations).toEqual(integrations);

    const cards = fixture.debugElement.queryAll(By.directive(IntegrationCardComponent));

    expect(cards.length).toBe(integrations.length);
  });

  it("assigns the correct attributes to IntegrationCardComponent", () => {
    expect(component.integrations).toEqual(integrations);

    const card = fixture.debugElement.queryAll(By.directive(IntegrationCardComponent))[1];

    expect(card.componentInstance.name).toBe("SDK 2");
    expect(card.componentInstance.image).toBe("test-image2.png");
    expect(card.componentInstance.linkURL).toBe("https://example.com/2");
  });

  it("assigns `externalURL` for SDKs", () => {
    const card = fixture.debugElement.queryAll(By.directive(IntegrationCardComponent));

    expect(card[0].componentInstance.externalURL).toBe(false);
    expect(card[1].componentInstance.externalURL).toBe(true);
  });

  it("has a tool tip and aria label attributes", () => {
    const card: HTMLElement = fixture.debugElement.queryAll(By.css("li"))[0].nativeElement;
    expect(card.title).toBe("integrationCardTooltip" + " " + integrations[0].name);
    expect(card.getAttribute("aria-label")).toBe(
      "integrationCardAriaLabel" + " " + integrations[0].name,
    );
  });
});
