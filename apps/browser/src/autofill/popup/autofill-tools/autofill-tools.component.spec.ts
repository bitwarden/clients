import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { ActivatedRoute } from "@angular/router";

import { AutofillToolsComponent } from "./autofill-tools.component";

describe("AutofillToolsComponent", () => {
  let component: AutofillToolsComponent;
  let fixture: ComponentFixture<AutofillToolsComponent>;
  let viewParam: string | null;

  beforeEach(async () => {
    viewParam = null;
    const route = {
      snapshot: { queryParamMap: { get: (key: string) => (key === "view" ? viewParam : null) } },
    } as unknown as ActivatedRoute;

    await TestBed.configureTestingModule({
      imports: [AutofillToolsComponent],
      providers: [provideNoopAnimations(), { provide: ActivatedRoute, useValue: route }],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(AutofillToolsComponent, { set: { template: "" } })
      .compileComponents();

    fixture = TestBed.createComponent(AutofillToolsComponent);
    component = fixture.componentInstance;
  });

  it("creates and defaults to the triage view", () => {
    expect(component).toBeTruthy();
    expect(component.view()).toBe("triage");
  });

  describe("ngOnInit", () => {
    it("keeps triage as the default when no view query param is present", () => {
      component.ngOnInit();
      expect(component.view()).toBe("triage");
    });

    it("selects the webmapper view when ?view=webmapper", () => {
      viewParam = "webmapper";
      component.ngOnInit();
      expect(component.view()).toBe("webmapper");
    });

    it("ignores an unrecognized view query param", () => {
      viewParam = "something-else";
      component.ngOnInit();
      expect(component.view()).toBe("triage");
    });
  });

  describe("select", () => {
    it("switches the active view", () => {
      component.select("webmapper");
      expect(component.view()).toBe("webmapper");

      component.select("triage");
      expect(component.view()).toBe("triage");
    });
  });
});
