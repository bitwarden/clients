import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { OrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-service";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { IntegrationType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TabsModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { IntegrationsComponent } from "./integrations.component";
import { SecretsIntegrationsState } from "./secrets-integrations.state";

// JSDOM does not implement ResizeObserver — provide a no-op stub so bit-tab-nav-bar
// can construct without throwing.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-header",
  template: "<ng-content></ng-content>",
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
      imports: [JslibModule, TabsModule, RouterModule.forRoot([]), I18nPipe],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
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

  it("should render a tab link for each integration category", () => {
    const tabs = fixture.debugElement.queryAll(By.css("bit-tab-link"));

    expect(tabs.length).toBe(2);
  });

  describe("integration data validation", () => {
    it("should include required properties for all integrations", () => {
      const integrations = integrationStateService.integrations();

      integrations.forEach((integration: Integration) => {
        expect(integration.name).toBeDefined();
        expect(integration.linkURL).toBeDefined();
        expect(integration.image).toBeDefined();
        expect(integration.type).toBeDefined();
        expect([IntegrationType.Integration, IntegrationType.SDK]).toContain(integration.type);
      });
    });

    it("should have valid link URLs for all integrations", () => {
      const integrations = integrationStateService.integrations();

      integrations.forEach((integration: Integration) => {
        expect(integration.linkURL).toMatch(/^https?:\/\//);
      });
    });
  });
});
