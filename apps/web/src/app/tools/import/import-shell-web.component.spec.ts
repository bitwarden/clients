import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter, RouterOutlet, withRouterConfig } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionAdminService, CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  ImportDestinationServiceAbstraction,
  ImportStagingServiceAbstraction,
} from "@bitwarden/importer-core";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportShellContentWebComponent } from "./import-shell-content-web.component";
import { ImportShellWebComponent } from "./import-shell-web.component";

@Component({
  selector: "app-header",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HeaderStubComponent {}

@Component({
  selector: "importer-shell-progress",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ProgressStubComponent {}

const orgA = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11";
const orgB = "9c1d7e2a-3b4f-4c5d-8e6f-7a8b9c0d1e2f";

@Component({
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ScreenComponent {
  static instances = 0;
  constructor() {
    ScreenComponent.instances++;
  }
}

describe("ImportShellWebComponent when only the organization in the URL changes", () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    ScreenComponent.instances = 0;

    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            {
              path: "organizations/:organizationId/settings/tools/import",
              component: ImportShellWebComponent,
              children: [{ path: "", component: ScreenComponent }],
            },
          ],
          // As the web app's router does.
          withRouterConfig({ paramsInheritanceStrategy: "always" }),
        ),
        { provide: CollectionAdminService, useValue: mock<CollectionAdminService>() },
        {
          provide: ConfigService,
          useValue: mock<ConfigService>({ getFeatureFlag$: () => of(false) }),
        },
        { provide: CollectionService, useValue: mock<CollectionService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: PolicyService, useValue: mock<PolicyService>() },
        { provide: RestrictedItemTypesService, useValue: mock<RestrictedItemTypesService>() },
        { provide: AccountService, useValue: mock<AccountService>({ activeAccount$: of(null) }) },
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
      ],
    }).overrideComponent(ImportShellContentWebComponent, {
      // The real router outlet and the real providers; only the chrome around them is stubbed.
      set: {
        imports: [HeaderStubComponent, I18nPipe, ProgressStubComponent, RouterOutlet],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });
    harness = await RouterTestingHarness.create();
  });

  const shellServices = () => {
    const injector = harness.fixture.debugElement.query(
      By.directive(ImportShellContentWebComponent),
    ).injector;
    return {
      staging: injector.get(ImportStagingServiceAbstraction),
      destinations: injector.get(ImportDestinationServiceAbstraction),
    };
  };

  it("builds a fresh shell, with its own services and screens, for the other organization", async () => {
    await harness.navigateByUrl(`/organizations/${orgA}/settings/tools/import`);
    const before = shellServices();
    expect(ScreenComponent.instances).toBe(1);

    await harness.navigateByUrl(`/organizations/${orgB}/settings/tools/import`);
    const after = shellServices();

    expect(ScreenComponent.instances).toBe(2);
    expect(after.staging).not.toBe(before.staging);
    expect(after.destinations).not.toBe(before.destinations);
  });

  it("drops what was staged for the first organization", async () => {
    await harness.navigateByUrl(`/organizations/${orgA}/settings/tools/import`);
    const staging = shellServices().staging;
    staging.stage({
      kind: "file",
      importType: "dashlane",
      format: "dashlanecsv",
      contents: "a,b",
      filePassword: null,
      itemTypeCounts: undefined,
    });

    await harness.navigateByUrl(`/organizations/${orgB}/settings/tools/import`);

    expect(staging.current()).toBeUndefined();
    expect(shellServices().staging.current()).toBeUndefined();
  });

  it("keeps the same shell for a navigation within one organization", async () => {
    await harness.navigateByUrl(`/organizations/${orgA}/settings/tools/import`);
    const before = shellServices();

    await harness.navigateByUrl(`/organizations/${orgA}/settings/tools/import?returnTo=x`);

    expect(shellServices().staging).toBe(before.staging);
    expect(ScreenComponent.instances).toBe(1);
  });
});
