import { ChangeDetectionStrategy, Component, input, NO_ERRORS_SCHEMA, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ImportType } from "@bitwarden/importer-core";

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

  const setup = async (importTypeParam: string) => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ImportControlsDesktopComponent],
      providers: [
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ importType: importTypeParam }) },
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

  it("navigates back to Select source when the controls component emits back", async () => {
    await setup("keeper");

    fixture.debugElement.query(By.css("importer-controls")).triggerEventHandler("back", undefined);

    expect(router.navigate).toHaveBeenCalledWith(["/import"]);
  });
});
