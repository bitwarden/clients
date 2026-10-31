import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  DefaultImportStagingService,
  ImportResult,
  ImportStagingServiceAbstraction,
} from "@bitwarden/importer-core";

import { ImportDestinationWebComponent } from "./import-destination-web.component";

@Component({
  selector: "importer-destination",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ImporterDestinationStubComponent {
  readonly returnTo = input<string | undefined>();
  readonly defaultOrganizationId = input<string | undefined>();
  readonly defaultCollectionId = input<string | undefined>();
  readonly back = output<void>();
  readonly continue = output<void>();
}

describe("ImportDestinationWebComponent", () => {
  let fixture: ComponentFixture<ImportDestinationWebComponent>;
  let router: MockProxy<Router>;
  let stagingService: DefaultImportStagingService;

  const orgId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11";
  const orgBase = ["/organizations", orgId, "settings", "tools", "import"];

  const setup = async (options: {
    staged: boolean;
    organizationId?: string;
    query?: Record<string, string>;
  }) => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    stagingService = new DefaultImportStagingService();
    if (options.staged) {
      stagingService.stage({ kind: "parsed", importType: "keeper", result: new ImportResult() });
    }
    const params = {
      importType: "keeper",
      ...(options.organizationId == null ? {} : { organizationId: options.organizationId }),
    };

    await TestBed.configureTestingModule({
      imports: [ImportDestinationWebComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ImportStagingServiceAbstraction, useValue: stagingService },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: AccountService, useValue: mock<AccountService>() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(params),
              queryParamMap: convertToParamMap(options.query ?? {}),
            },
            paramMap: of(convertToParamMap(params)),
          },
        },
      ],
    })
      .overrideComponent(ImportDestinationWebComponent, {
        set: {
          imports: [ImporterDestinationStubComponent],
          providers: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportDestinationWebComponent);
    fixture.detectChanges();
  };

  it("sends the user back to Select source, and shows nothing, when nothing is staged", async () => {
    await setup({ staged: false });

    expect(router.navigate).toHaveBeenCalledWith(["/tools/import"]);
    expect(fixture.debugElement.query(By.css("importer-destination"))).toBeNull();
  });

  it("shows location selection, and does not redirect, when items are staged", async () => {
    await setup({ staged: true });

    expect(fixture.debugElement.query(By.css("importer-destination"))).not.toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("goes back to the start of credential parsing for the same vendor", async () => {
    await setup({ staged: true });

    fixture.debugElement
      .query(By.css("importer-destination"))
      .triggerEventHandler("back", undefined);

    expect(router.navigate).toHaveBeenCalledWith(["/tools/import", "keeper"]);
  });

  it("navigates to the vault once the import succeeds", async () => {
    await setup({ staged: true });

    fixture.debugElement
      .query(By.css("importer-destination"))
      .triggerEventHandler("continue", undefined);

    expect(router.navigate).toHaveBeenCalledWith(["/vault"]);
  });

  describe("for an import started from a vault", () => {
    const vaultOrgId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11";
    const vaultCollectionId = "9c1d7e2a-3b4f-4c5d-8e6f-7a8b9c0d1e2f";
    const scopeQuery = {
      defaultOrganizationId: vaultOrgId,
      defaultCollectionId: vaultCollectionId,
    };
    const stub = () =>
      fixture.debugElement.query(By.directive(ImporterDestinationStubComponent))
        .componentInstance as ImporterDestinationStubComponent;

    it("passes the organization and collection from the URL to the location step", async () => {
      await setup({ staged: true, query: scopeQuery });

      expect(stub().defaultOrganizationId()).toBe(vaultOrgId);
      expect(stub().defaultCollectionId()).toBe(vaultCollectionId);
    });

    it("passes nothing for a value in the URL that is not an id", async () => {
      await setup({
        staged: true,
        query: { defaultOrganizationId: "not-an-id", defaultCollectionId: vaultCollectionId },
      });

      expect(stub().defaultOrganizationId()).toBeUndefined();
      expect(stub().defaultCollectionId()).toBe(vaultCollectionId);
    });

    it("keeps the scope in the URL when going back", async () => {
      await setup({ staged: true, query: scopeQuery });

      fixture.debugElement
        .query(By.css("importer-destination"))
        .triggerEventHandler("back", undefined);

      expect(router.navigate).toHaveBeenCalledWith(["/tools/import", "keeper"], {
        queryParams: scopeQuery,
      });
    });
  });

  describe("for an organization's import", () => {
    it("sends the user back to the organization's Select source when nothing is staged", async () => {
      await setup({ staged: false, organizationId: orgId });

      expect(router.navigate).toHaveBeenCalledWith(orgBase);
    });

    it("passes returnTo from the URL to the location step", async () => {
      await setup({
        staged: true,
        organizationId: orgId,
        query: { returnTo: "access-intelligence" },
      });

      const stub = fixture.debugElement.query(By.directive(ImporterDestinationStubComponent))
        .componentInstance as ImporterDestinationStubComponent;
      expect(stub.returnTo()).toBe("access-intelligence");
    });

    it("keeps returnTo in the URL when going back", async () => {
      await setup({
        staged: true,
        organizationId: orgId,
        query: { returnTo: "access-intelligence" },
      });

      fixture.debugElement
        .query(By.css("importer-destination"))
        .triggerEventHandler("back", undefined);

      expect(router.navigate).toHaveBeenCalledWith([...orgBase, "keeper"], {
        queryParams: { returnTo: "access-intelligence" },
      });
    });

    it("goes back to the start of credential parsing under the organization", async () => {
      await setup({ staged: true, organizationId: orgId });

      fixture.debugElement
        .query(By.css("importer-destination"))
        .triggerEventHandler("back", undefined);

      expect(router.navigate).toHaveBeenCalledWith([...orgBase, "keeper"]);
    });
  });
});
