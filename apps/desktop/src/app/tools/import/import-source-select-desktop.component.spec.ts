import { ChangeDetectionStrategy, Component, NO_ERRORS_SCHEMA, output } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";

import { ImportType } from "@bitwarden/importer-core";

import { ImportSourceSelectDesktopComponent } from "./import-source-select-desktop.component";

@Component({
  selector: "importer-source-select",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ImporterSourceSelectStubComponent {
  readonly continue = output<ImportType>();
}

describe("ImportSourceSelectDesktopComponent", () => {
  let fixture: ComponentFixture<ImportSourceSelectDesktopComponent>;
  let router: MockProxy<Router>;

  beforeEach(async () => {
    router = mock<Router>();
    router.navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ImportSourceSelectDesktopComponent],
      providers: [{ provide: Router, useValue: router }],
    })
      .overrideComponent(ImportSourceSelectDesktopComponent, {
        set: { imports: [ImporterSourceSelectStubComponent], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ImportSourceSelectDesktopComponent);
    fixture.detectChanges();
  });

  it("navigates to the chosen vendor's Import data route when the picker emits continue", () => {
    fixture.debugElement
      .query(By.css("importer-source-select"))
      .triggerEventHandler("continue", "keeper");

    expect(router.navigate).toHaveBeenCalledWith(["/import", "keeper"]);
  });
});
