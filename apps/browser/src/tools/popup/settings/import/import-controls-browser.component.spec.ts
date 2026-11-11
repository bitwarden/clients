import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DefaultImportStagingService,
  ImportResult,
  ImportStagingServiceAbstraction,
  ImportType,
} from "@bitwarden/importer-core";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportControlsBrowserComponent } from "./import-controls-browser.component";

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

describe("ImportControlsBrowserComponent", () => {
  let fixture: ComponentFixture<ImportControlsBrowserComponent>;
  let router: MockProxy<Router>;
  let stagingService: DefaultImportStagingService;

  const setup = async (importTypeParam: string) => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);
    stagingService = new DefaultImportStagingService();

    await TestBed.configureTestingModule({
      imports: [ImportControlsBrowserComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ImportStagingServiceAbstraction, useValue: stagingService },
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ importType: importTypeParam }) },
            paramMap: of(convertToParamMap({ importType: importTypeParam })),
          },
        },
      ],
    })
      .overrideComponent(ImportControlsBrowserComponent, {
        set: {
          imports: [ImporterControlsStubComponent, I18nPipe],
          providers: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportControlsBrowserComponent);
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

    expect(router.navigate).toHaveBeenCalledWith(["/import-source-select"], {
      queryParams: { source: "keeper" },
    });
  });

  it("navigates to the vault when the controls component emits continue with nothing staged", async () => {
    await setup("keeper");

    fixture.debugElement
      .query(By.css("importer-controls"))
      .triggerEventHandler("continue", undefined);

    expect(router.navigate).toHaveBeenCalledWith(["/tabs/vault"]);
  });

  it("navigates to location selection when continue is emitted with items staged", async () => {
    await setup("keeper");
    stagingService.stage({ kind: "parsed", importType: "keeper", result: new ImportResult() });

    fixture.debugElement
      .query(By.css("importer-controls"))
      .triggerEventHandler("continue", undefined);

    expect(router.navigate).toHaveBeenCalledWith([
      "/import-source-select",
      "keeper",
      "destination",
    ]);
    expect(router.navigate).not.toHaveBeenCalledWith(["/tabs/vault"]);
  });
});
