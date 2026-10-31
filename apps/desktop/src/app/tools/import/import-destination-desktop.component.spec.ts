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
} from "@bitwarden/importer-core";

import { ImportDestinationDesktopComponent } from "./import-destination-desktop.component";

@Component({
  selector: "importer-destination",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ImporterDestinationStubComponent {
  readonly defaultOrganizationId = input<string | undefined>();
  readonly defaultCollectionId = input<string | undefined>();
  readonly back = output<void>();
  readonly continue = output<void>();
}

describe("ImportDestinationDesktopComponent", () => {
  let fixture: ComponentFixture<ImportDestinationDesktopComponent>;
  let router: MockProxy<Router>;
  let stagingService: DefaultImportStagingService;

  const setup = async (options: { staged: boolean; query?: Record<string, string> }) => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    stagingService = new DefaultImportStagingService();
    if (options.staged) {
      stagingService.stage({ kind: "parsed", importType: "keeper", result: new ImportResult() });
    }

    await TestBed.configureTestingModule({
      imports: [ImportDestinationDesktopComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ImportStagingServiceAbstraction, useValue: stagingService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ importType: "keeper" }),
              queryParamMap: convertToParamMap(options.query ?? {}),
            },
            paramMap: of(convertToParamMap({ importType: "keeper" })),
          },
        },
      ],
    })
      .overrideComponent(ImportDestinationDesktopComponent, {
        set: {
          imports: [ImporterDestinationStubComponent],
          providers: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportDestinationDesktopComponent);
    fixture.detectChanges();
  };

  it("sends the user back to Select source, and shows nothing, when nothing is staged", async () => {
    await setup({ staged: false });

    expect(router.navigate).toHaveBeenCalledWith(["/import"]);
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

    expect(router.navigate).toHaveBeenCalledWith(["/import", "keeper"]);
  });

  it("navigates to the vault once the import succeeds", async () => {
    await setup({ staged: true });

    fixture.debugElement
      .query(By.css("importer-destination"))
      .triggerEventHandler("continue", undefined);

    expect(router.navigate).toHaveBeenCalledWith(["/vault"]);
  });

  describe("for an import started from a vault", () => {
    const orgId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11";
    const collectionId = "9c1d7e2a-3b4f-4c5d-8e6f-7a8b9c0d1e2f";
    const scopeQuery = { defaultOrganizationId: orgId, defaultCollectionId: collectionId };
    const stub = () =>
      fixture.debugElement.query(By.directive(ImporterDestinationStubComponent))
        .componentInstance as ImporterDestinationStubComponent;

    it("passes the organization and collection from the URL to the location step", async () => {
      await setup({ staged: true, query: scopeQuery });

      expect(stub().defaultOrganizationId()).toBe(orgId);
      expect(stub().defaultCollectionId()).toBe(collectionId);
    });

    it("passes nothing for a value in the URL that is not an id", async () => {
      await setup({
        staged: true,
        query: { defaultOrganizationId: "not-an-id", defaultCollectionId: collectionId },
      });

      expect(stub().defaultOrganizationId()).toBeUndefined();
      expect(stub().defaultCollectionId()).toBe(collectionId);
    });

    it("lands on the shared folder it was started from once the import succeeds", async () => {
      await setup({ staged: true, query: scopeQuery });

      fixture.debugElement
        .query(By.css("importer-destination"))
        .triggerEventHandler("continue", undefined);

      expect(router.navigate).toHaveBeenCalledWith([
        "/vault",
        orgId,
        "shared-folders",
        collectionId,
      ]);
    });

    it("keeps the scope in the URL when going back", async () => {
      await setup({ staged: true, query: scopeQuery });

      fixture.debugElement
        .query(By.css("importer-destination"))
        .triggerEventHandler("back", undefined);

      expect(router.navigate).toHaveBeenCalledWith(["/import", "keeper"], {
        queryParams: scopeQuery,
      });
    });

    it("keeps the scope in the URL when sent back because nothing is staged", async () => {
      await setup({ staged: false, query: scopeQuery });

      expect(router.navigate).toHaveBeenCalledWith(["/import"], { queryParams: scopeQuery });
    });
  });
});
