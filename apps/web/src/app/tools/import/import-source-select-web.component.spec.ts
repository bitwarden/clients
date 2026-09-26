import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { ImportType } from "@bitwarden/importer-core";

import { ImportSourceSelectWebComponent } from "./import-source-select-web.component";

@Component({
  selector: "importer-source-select",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ImporterSourceSelectStubComponent {
  readonly continue = output<ImportType>();
}

describe("ImportSourceSelectWebComponent", () => {
  let fixture: ComponentFixture<ImportSourceSelectWebComponent>;
  let router: MockProxy<Router>;

  beforeEach(async () => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ImportSourceSelectWebComponent],
      providers: [{ provide: Router, useValue: router }],
    })
      .overrideComponent(ImportSourceSelectWebComponent, {
        set: { imports: [ImporterSourceSelectStubComponent], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportSourceSelectWebComponent);
    fixture.detectChanges();
  });

  it("navigates to the chosen vendor's Import data route when the picker emits continue", () => {
    fixture.debugElement
      .query(By.css("importer-source-select"))
      .triggerEventHandler("continue", "keeper");

    expect(router.navigate).toHaveBeenCalledWith(["/tools/import", "keeper"]);
  });
});
