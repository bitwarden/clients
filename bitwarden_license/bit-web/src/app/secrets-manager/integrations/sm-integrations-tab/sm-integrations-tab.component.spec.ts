import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { OrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-service";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { IntegrationType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

import { IntegrationGridComponent } from "../../../dirt/organization-integrations/integration-grid/integration-grid.component";
import { SecretsIntegrationsState } from "../secrets-integrations.state";

import { SmIntegrationsTabComponent, SmIntegrationsTabData } from "./sm-integrations-tab.component";

describe("SmIntegrationsTabComponent", () => {
  let fixture: ComponentFixture<SmIntegrationsTabComponent>;

  const testIntegrations: Integration[] = [
    {
      name: "GitHub Actions",
      linkURL: "https://example.com/github",
      image: "github.svg",
      type: IntegrationType.Integration,
    },
    {
      name: "Rust",
      linkURL: "https://example.com/rust",
      image: "rust.svg",
      type: IntegrationType.SDK,
    },
  ];

  const setup = async (data: SmIntegrationsTabData) => {
    await TestBed.configureTestingModule({
      imports: [SmIntegrationsTabComponent],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: ThemeStateService, useValue: mock<ThemeStateService>() },
        { provide: SYSTEM_THEME_OBSERVABLE, useValue: of(ThemeType.Light) },
        {
          provide: OrganizationIntegrationService,
          useValue: mock<OrganizationIntegrationService>(),
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data, paramMap: { get: jest.fn() } } },
        },
        { provide: IntegrationStateService, useClass: SecretsIntegrationsState },
      ],
    }).compileComponents();

    TestBed.inject(IntegrationStateService).setIntegrations(testIntegrations);

    fixture = TestBed.createComponent(SmIntegrationsTabComponent);
    fixture.detectChanges();
  };

  const grid = () =>
    fixture.debugElement.query(By.directive(IntegrationGridComponent))
      .componentInstance as IntegrationGridComponent;

  describe("Integrations tab", () => {
    beforeEach(() =>
      setup({
        integrationType: IntegrationType.Integration,
        descriptionKey: "integrationsDesc",
        tooltipKey: "smIntegrationTooltip",
        ariaKey: "smIntegrationCardAriaLabel",
      }),
    );

    it("should pass only Integration-type entries to the grid", () => {
      const names = grid()
        .integrations()
        .map((i: Integration) => i.name);

      expect(names).toContain("GitHub Actions");
      expect(names).not.toContain("Rust");
    });

    it("should pass the configured tooltip and aria label keys to the grid", () => {
      expect(grid().tooltipI18nKey()).toBe("smIntegrationTooltip");
      expect(grid().ariaI18nKey()).toBe("smIntegrationCardAriaLabel");
    });
  });

  describe("SDKs tab", () => {
    beforeEach(() =>
      setup({
        integrationType: IntegrationType.SDK,
        descriptionKey: "sdksDesc",
        tooltipKey: "smSdkTooltip",
        ariaKey: "smSdkAriaLabel",
      }),
    );

    it("should pass only SDK-type entries to the grid", () => {
      const names = grid()
        .integrations()
        .map((i: Integration) => i.name);

      expect(names).toContain("Rust");
      expect(names).not.toContain("GitHub Actions");
    });

    it("should pass the configured tooltip and aria label keys to the grid", () => {
      expect(grid().tooltipI18nKey()).toBe("smSdkTooltip");
      expect(grid().ariaI18nKey()).toBe("smSdkAriaLabel");
    });
  });
});
