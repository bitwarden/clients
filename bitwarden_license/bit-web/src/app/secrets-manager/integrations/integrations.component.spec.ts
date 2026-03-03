import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { OrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-service";
import { FilterIntegrationsPipe } from "@bitwarden/bit-common/dirt/organization-integrations/shared/filter-integrations.pipe";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { IntegrationType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { IntegrationCardComponent } from "../../dirt/organization-integrations/integration-card/integration-card.component";
import { IntegrationGridComponent } from "../../dirt/organization-integrations/integration-grid/integration-grid.component";

import { IntegrationsComponent } from "./integrations.component";
import { SecretsIntegrationsState } from "./secrets-integrations.state";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-header",
  template: "<div></div>",
  standalone: false,
})
class MockHeaderComponent {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "sm-new-menu",
  template: "<div></div>",
  standalone: false,
})
class MockNewMenuComponent {}

describe("IntegrationsComponent", () => {
  let component: IntegrationsComponent;
  let fixture: ComponentFixture<IntegrationsComponent>;
  let integrationStateService: IntegrationStateService;

  const activatedRouteMock = {
    snapshot: { paramMap: { get: jest.fn() } },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [IntegrationsComponent, MockHeaderComponent, MockNewMenuComponent],
      imports: [
        JslibModule,
        IntegrationGridComponent,
        IntegrationCardComponent,
        FilterIntegrationsPipe,
        I18nPipe,
      ],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: ThemeStateService, useValue: mock<ThemeStateService>() },
        { provide: SYSTEM_THEME_OBSERVABLE, useValue: of(ThemeType.Light) },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        {
          provide: OrganizationIntegrationService,
          useValue: mock<OrganizationIntegrationService>(),
        },
        { provide: IntegrationStateService, useClass: SecretsIntegrationsState },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IntegrationsComponent);
    component = fixture.componentInstance;
    integrationStateService = TestBed.inject(IntegrationStateService);
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should initialize integrations in state on construction", () => {
    const integrations = integrationStateService.integrations();

    expect(integrations.length).toBeGreaterThan(0);
    expect(integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "GitHub Actions", type: IntegrationType.Integration }),
        expect.objectContaining({ name: "Rust", type: IntegrationType.SDK }),
      ]),
    );
  });

  it("should expose integrations getter from state", () => {
    const stateIntegrations = integrationStateService.integrations();
    const componentIntegrations = component.integrations();

    expect(componentIntegrations).toEqual(stateIntegrations);
  });

  it("should expose IntegrationType enum for template usage", () => {
    expect(component.IntegrationType).toBe(IntegrationType);
  });

  describe("template rendering", () => {
    it("should render two integration grid sections", () => {
      const grids = fixture.debugElement.queryAll(By.directive(IntegrationGridComponent));

      expect(grids.length).toBe(2);
    });

    it("should pass correct integrations to first grid (Integrations)", () => {
      const [integrationsGrid] = fixture.debugElement.queryAll(
        By.directive(IntegrationGridComponent),
      );

      const gridInstance = integrationsGrid.componentInstance as IntegrationGridComponent;
      const integrationNames = gridInstance.integrations().map((i: Integration) => i.name);

      expect(integrationNames).toContain("GitHub Actions");
      expect(integrationNames).toContain("GitLab CI/CD");
      expect(integrationNames).toContain("Ansible");
      expect(integrationNames).toContain("Kubernetes Operator");
      expect(integrationNames).toContain("Terraform Provider");
      expect(integrationNames).not.toContain("Rust");
      expect(integrationNames).not.toContain("Python");
    });

    it("should pass correct integrations to second grid (SDKs)", () => {
      const [, sdksGrid] = fixture.debugElement.queryAll(By.directive(IntegrationGridComponent));

      const gridInstance = sdksGrid.componentInstance as IntegrationGridComponent;
      const sdkNames = gridInstance.integrations().map((i: Integration) => i.name);

      expect(sdkNames).toContain("Rust");
      expect(sdkNames).toContain("C#");
      expect(sdkNames).toContain("C++");
      expect(sdkNames).toContain("Go");
      expect(sdkNames).toContain("Java");
      expect(sdkNames).toContain("JS WebAssembly");
      expect(sdkNames).toContain("php");
      expect(sdkNames).toContain("Python");
      expect(sdkNames).toContain("Ruby");
      expect(sdkNames).not.toContain("GitHub Actions");
    });

    it("should pass correct tooltip keys to integration grids", () => {
      const [integrationsGrid, sdksGrid] = fixture.debugElement.queryAll(
        By.directive(IntegrationGridComponent),
      );

      expect(
        (integrationsGrid.componentInstance as IntegrationGridComponent).tooltipI18nKey(),
      ).toBe("smIntegrationTooltip");
      expect((sdksGrid.componentInstance as IntegrationGridComponent).tooltipI18nKey()).toBe(
        "smSdkTooltip",
      );
    });

    it("should pass correct aria label keys to integration grids", () => {
      const [integrationsGrid, sdksGrid] = fixture.debugElement.queryAll(
        By.directive(IntegrationGridComponent),
      );

      expect((integrationsGrid.componentInstance as IntegrationGridComponent).ariaI18nKey()).toBe(
        "smIntegrationCardAriaLabel",
      );
      expect((sdksGrid.componentInstance as IntegrationGridComponent).ariaI18nKey()).toBe(
        "smSdkAriaLabel",
      );
    });
  });

  describe("integration data validation", () => {
    it("should include required properties for all integrations", () => {
      const integrations = component.integrations();

      integrations.forEach((integration: Integration) => {
        expect(integration.name).toBeDefined();
        expect(integration.linkURL).toBeDefined();
        expect(integration.image).toBeDefined();
        expect(integration.type).toBeDefined();
        expect([IntegrationType.Integration, IntegrationType.SDK]).toContain(integration.type);
      });
    });

    it("should have valid link URLs for all integrations", () => {
      const integrations = component.integrations();

      integrations.forEach((integration: Integration) => {
        expect(integration.linkURL).toMatch(/^https?:\/\//);
      });
    });
  });
});
