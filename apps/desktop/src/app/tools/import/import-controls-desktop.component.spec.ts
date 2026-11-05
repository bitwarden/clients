import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  DefaultImportStagingService,
  ImportResult,
  ImportStagingServiceAbstraction,
  ImportType,
} from "@bitwarden/importer-core";

import { ImportControlsDesktopComponent } from "./import-controls-desktop.component";

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

describe("ImportControlsDesktopComponent", () => {
  let fixture: ComponentFixture<ImportControlsDesktopComponent>;
  let router: MockProxy<Router>;
  let stagingService: DefaultImportStagingService;

  const setup = async (importTypeParam: string, query: Record<string, string> = {}) => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    stagingService = new DefaultImportStagingService();

    await TestBed.configureTestingModule({
      imports: [ImportControlsDesktopComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ImportStagingServiceAbstraction, useValue: stagingService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ importType: importTypeParam }),
              queryParamMap: convertToParamMap(query),
            },
            paramMap: of(convertToParamMap({ importType: importTypeParam })),
          },
        },
      ],
    })
      .overrideComponent(ImportControlsDesktopComponent, {
        set: {
          imports: [ImporterControlsStubComponent],
          providers: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportControlsDesktopComponent);
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

    expect(router.navigate).toHaveBeenCalledWith(["/import"], {
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

    expect(router.navigate).toHaveBeenCalledWith(["/import", "keeper", "destination"]);
    expect(router.navigate).not.toHaveBeenCalledWith(["/vault"]);
  });

  describe("for an import started from a vault", () => {
    const scopeQuery = {
      defaultOrganizationId: "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11",
      defaultCollectionId: "9c1d7e2a-3b4f-4c5d-8e6f-7a8b9c0d1e2f",
    };

    it("keeps the scope in the URL when going back", async () => {
      await setup("keeper", scopeQuery);

      fixture.debugElement
        .query(By.css("importer-controls"))
        .triggerEventHandler("back", undefined);

      expect(router.navigate).toHaveBeenCalledWith(["/import"], {
        queryParams: { ...scopeQuery, source: "keeper" },
      });
    });

    it("lands on the shared folder it was started from when continuing with nothing staged", async () => {
      await setup("keeper", scopeQuery);

      fixture.debugElement
        .query(By.css("importer-controls"))
        .triggerEventHandler("continue", undefined);

      expect(router.navigate).toHaveBeenCalledWith([
        "/vault",
        scopeQuery.defaultOrganizationId,
        "shared-folders",
        scopeQuery.defaultCollectionId,
      ]);
    });

    it("keeps the scope in the URL when continuing to the location step", async () => {
      await setup("keeper", scopeQuery);
      stagingService.stage({ kind: "parsed", importType: "keeper", result: new ImportResult() });

      fixture.debugElement
        .query(By.css("importer-controls"))
        .triggerEventHandler("continue", undefined);

      expect(router.navigate).toHaveBeenCalledWith(["/import", "keeper", "destination"], {
        queryParams: scopeQuery,
      });
    });
  });
});
