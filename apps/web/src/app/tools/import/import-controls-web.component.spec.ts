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
  ImportType,
} from "@bitwarden/importer-core";

import { ImportControlsWebComponent } from "./import-controls-web.component";

@Component({
  selector: "importer-controls",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ImporterControlsStubComponent {
  readonly importType = input.required<ImportType>();
  readonly back = output<void>();
  readonly continue = output<void>();
}

describe("ImportControlsWebComponent", () => {
  let fixture: ComponentFixture<ImportControlsWebComponent>;
  let router: MockProxy<Router>;
  let stagingService: DefaultImportStagingService;

  const orgId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11";

  const setup = async (
    importTypeParam: string,
    organizationId?: string,
    query: Record<string, string> = {},
  ) => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    stagingService = new DefaultImportStagingService();
    const params = {
      importType: importTypeParam,
      ...(organizationId == null ? {} : { organizationId }),
    };

    await TestBed.configureTestingModule({
      imports: [ImportControlsWebComponent],
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
              queryParamMap: convertToParamMap(query),
            },
            paramMap: of(convertToParamMap(params)),
          },
        },
      ],
    })
      .overrideComponent(ImportControlsWebComponent, {
        set: {
          imports: [ImporterControlsStubComponent],
          providers: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportControlsWebComponent);
    fixture.detectChanges();
  };

  it("reads the vendor from the route and passes it to the controls component", async () => {
    await setup("keeper");

    const stub = fixture.debugElement.query(By.directive(ImporterControlsStubComponent))
      .componentInstance as ImporterControlsStubComponent;
    expect(stub.importType()).toBe("keeper");
  });

  it("navigates back to Select source with the vendor preselected when the controls component emits back", async () => {
    await setup("keeper");

    fixture.debugElement.query(By.css("importer-controls")).triggerEventHandler("back", undefined);

    expect(router.navigate).toHaveBeenCalledWith(["/tools/import"], {
      queryParams: { source: "keeper" },
    });
  });

  it("navigates to the vault when the controls component emits continue with nothing staged", async () => {
    await setup("keeper");

    fixture.debugElement
      .query(By.css("importer-controls"))
      .triggerEventHandler("continue", undefined);

    expect(router.navigate).toHaveBeenCalledWith(["/vault"]);
  });

  it("navigates to location selection when continue is emitted with items staged", async () => {
    await setup("keeper");
    stagingService.stage({ kind: "parsed", importType: "keeper", result: new ImportResult() });

    fixture.debugElement
      .query(By.css("importer-controls"))
      .triggerEventHandler("continue", undefined);

    expect(router.navigate).toHaveBeenCalledWith(["/tools/import", "keeper", "destination"]);
    expect(router.navigate).not.toHaveBeenCalledWith(["/vault"]);
  });

  describe("for an organization's import", () => {
    const base = ["/organizations", orgId, "settings", "tools", "import"];

    it("goes back to the organization's Select source, with the vendor preselected", async () => {
      await setup("keeper", orgId);

      fixture.debugElement
        .query(By.css("importer-controls"))
        .triggerEventHandler("back", undefined);

      expect(router.navigate).toHaveBeenCalledWith(base, { queryParams: { source: "keeper" } });
    });

    it("continues to the organization's location step when items are staged", async () => {
      await setup("keeper", orgId);
      stagingService.stage({ kind: "parsed", importType: "keeper", result: new ImportResult() });

      fixture.debugElement
        .query(By.css("importer-controls"))
        .triggerEventHandler("continue", undefined);

      expect(router.navigate).toHaveBeenCalledWith([...base, "keeper", "destination"]);
    });

    it("keeps returnTo in the URL when going back", async () => {
      await setup("keeper", orgId, { returnTo: "access-intelligence" });

      fixture.debugElement
        .query(By.css("importer-controls"))
        .triggerEventHandler("back", undefined);

      expect(router.navigate).toHaveBeenCalledWith(base, {
        queryParams: { source: "keeper", returnTo: "access-intelligence" },
      });
    });

    it("keeps returnTo in the URL when continuing to the location step", async () => {
      await setup("keeper", orgId, { returnTo: "access-intelligence" });
      stagingService.stage({ kind: "parsed", importType: "keeper", result: new ImportResult() });

      fixture.debugElement
        .query(By.css("importer-controls"))
        .triggerEventHandler("continue", undefined);

      expect(router.navigate).toHaveBeenCalledWith([...base, "keeper", "destination"], {
        queryParams: { returnTo: "access-intelligence" },
      });
    });

    it("rejects a route organization that is not an id", async () => {
      await expect(setup("keeper", "not-an-id")).rejects.toThrow("Invalid OrganizationId");
    });
  });
});
