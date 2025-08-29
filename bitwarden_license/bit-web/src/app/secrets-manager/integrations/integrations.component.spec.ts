import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {} from "@bitwarden/web-vault/app/shared";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { OrganizationIntegrationApiService } from "@bitwarden/bit-common/dirt/integrations";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { IntegrationCardComponent } from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/integrations/integration-card/integration-card.component";
import { IntegrationGridComponent } from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/integrations/integration-grid/integration-grid.component";

import { IntegrationsComponent } from "./integrations.component";

@Component({
  selector: "app-header",
  template: "<div></div>",
  standalone: false,
})
class MockHeaderComponent {}

@Component({
  selector: "sm-new-menu",
  template: "<div></div>",
  standalone: false,
})
class MockNewMenuComponent {}

describe("IntegrationsComponent", () => {
  let fixture: ComponentFixture<IntegrationsComponent>;

  const mockOrgIntegrationApiService = mock<OrganizationIntegrationApiService>();
  const activatedRouteMock = {
    snapshot: { paramMap: { get: jest.fn() } },
  };
  const mockI18nService = mock<I18nService>();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [IntegrationsComponent, MockHeaderComponent, MockNewMenuComponent],
      imports: [JslibModule, IntegrationGridComponent, IntegrationCardComponent],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: ThemeStateService, useValue: mock<ThemeStateService>() },
        { provide: SYSTEM_THEME_OBSERVABLE, useValue: of(ThemeType.Light) },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: OrganizationIntegrationApiService, useValue: mockOrgIntegrationApiService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nPipe, useValue: mock<I18nPipe>() },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(IntegrationsComponent);
    fixture.detectChanges();
  });

  it("divides Integrations & SDKS", () => {
    const [integrationList, sdkList] = fixture.debugElement.queryAll(
      By.directive(IntegrationGridComponent),
    );

    // Validate only expected names, as the data is constant
    expect(
      (integrationList.componentInstance as IntegrationGridComponent).integrations.map(
        (i) => i.name,
      ),
    ).toEqual(["GitHub Actions", "GitLab CI/CD", "Ansible", "Kubernetes Operator"]);

    expect(
      (sdkList.componentInstance as IntegrationGridComponent).integrations.map((i) => i.name),
    ).toEqual(["Rust", "C#", "C++", "Go", "Java", "JS WebAssembly", "php", "Python", "Ruby"]);
  });
});
