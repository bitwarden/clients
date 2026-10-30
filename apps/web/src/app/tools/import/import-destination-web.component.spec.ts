import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA, output } from "@angular/core";
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

import { ImportDestinationWebComponent } from "./import-destination-web.component";

@Component({
  selector: "importer-destination",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ImporterDestinationStubComponent {
  readonly back = output<void>();
  readonly continue = output<void>();
}

describe("ImportDestinationWebComponent", () => {
  let fixture: ComponentFixture<ImportDestinationWebComponent>;
  let router: MockProxy<Router>;
  let stagingService: DefaultImportStagingService;

  const setup = async (options: { staged: boolean }) => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    stagingService = new DefaultImportStagingService();
    if (options.staged) {
      stagingService.stage({ kind: "parsed", importType: "keeper", result: new ImportResult() });
    }

    await TestBed.configureTestingModule({
      imports: [ImportDestinationWebComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ImportStagingServiceAbstraction, useValue: stagingService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ importType: "keeper" }) },
            paramMap: of(convertToParamMap({ importType: "keeper" })),
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
});
