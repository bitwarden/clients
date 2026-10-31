import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ImportCollectionServiceAbstraction } from "@bitwarden/importer-core";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportCollectionAdminService } from "./import-collection-admin.service";
import { ImportShellContentWebComponent } from "./import-shell-content-web.component";

@Component({
  selector: "app-header",
  template: "<ng-content />",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HeaderStubComponent {}

@Component({
  selector: "importer-shell-progress",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ImportShellProgressStubComponent {}

@Component({
  selector: "router-outlet",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class RouterOutletStubComponent {}

@Component({
  selector: "bit-breadcrumbs",
  template: "<ng-content />",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class BreadcrumbsStubComponent {}

@Component({
  selector: "bit-breadcrumb",
  template: "<ng-content />",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class BreadcrumbStubComponent {
  readonly route = input<unknown>();
  readonly icon = input<string>();
  readonly queryParamsHandling = input<string>();
}

const orgId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11";

describe("ImportShellContentWebComponent", () => {
  let fixture: ComponentFixture<ImportShellContentWebComponent>;
  let vfo1: BehaviorSubject<boolean>;

  const create = async (params: Record<string, string> = {}, vfo1Enabled = true) => {
    vfo1 = new BehaviorSubject(vfo1Enabled);
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation((flag) =>
      flag === FeatureFlag.VFO1Foundation ? vfo1 : new BehaviorSubject(false),
    );

    await TestBed.configureTestingModule({
      imports: [ImportShellContentWebComponent],
      providers: [
        { provide: CollectionAdminService, useValue: mock<CollectionAdminService>() },
        { provide: ConfigService, useValue: configService },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: AccountService, useValue: mock<AccountService>() },
        {
          provide: I18nService,
          useValue: mock<I18nService>({ t: (key: string) => key }),
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(params) } },
        },
      ],
    })
      .overrideComponent(ImportShellContentWebComponent, {
        set: {
          imports: [
            BreadcrumbsStubComponent,
            BreadcrumbStubComponent,
            HeaderStubComponent,
            I18nPipe,
            ImportShellProgressStubComponent,
            RouterOutletStubComponent,
          ],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportShellContentWebComponent);
    fixture.detectChanges();
  };

  const crumbs = () =>
    fixture.debugElement
      .queryAll(By.directive(BreadcrumbStubComponent))
      .map((crumb) => crumb.componentInstance as BreadcrumbStubComponent);
  const crumbLabels = () =>
    fixture.debugElement
      .queryAll(By.directive(BreadcrumbStubComponent))
      .map((crumb) => (crumb.nativeElement as HTMLElement).textContent?.trim());

  it("renders the page header, the shared step progress, and a router outlet for its children", async () => {
    await create();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector("app-header")).toBeTruthy();
    expect(element.querySelector("importer-shell-progress")).toBeTruthy();
    expect(element.querySelector("router-outlet")).toBeTruthy();
  });

  it("gives an organization's import the admin collections to choose a shared folder from", async () => {
    await create({ organizationId: orgId });

    const collections = fixture.debugElement.injector.get(ImportCollectionServiceAbstraction);

    expect(collections).toBeInstanceOf(ImportCollectionAdminService);
  });

  describe("breadcrumbs", () => {
    it("shows Settings then Import for the personal import, linking to the user's settings", async () => {
      await create();

      expect(crumbLabels()).toEqual(["settings", "importNoun"]);
      expect(crumbs()[0].route()).toEqual(["/settings"]);
      expect(crumbs()[0].icon()).toBe("bwi-cog");
    });

    it("links Settings to the organization's settings for an organization's import", async () => {
      await create({ organizationId: orgId });

      expect(crumbLabels()).toEqual(["settings", "importNoun"]);
      expect(crumbs()[0].route()).toEqual(["/organizations", orgId, "settings"]);
    });

    it("makes the Import crumb link to the start of the import, keeping its query params", async () => {
      await create({ organizationId: orgId });

      expect(crumbs()[1].route()).toEqual([]);
      expect(crumbs()[1].queryParamsHandling()).toBe("preserve");
    });

    it("shows none while the VFO1 flag is off, and shows them when it turns on", async () => {
      await create({}, false);
      expect(crumbs()).toHaveLength(0);

      vfo1.next(true);
      fixture.detectChanges();

      expect(crumbs()).toHaveLength(2);
    });
  });
});
