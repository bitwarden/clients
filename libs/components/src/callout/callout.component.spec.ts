import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { CalloutComponent } from "./callout.component";

describe("Callout", () => {
  let component: CalloutComponent;
  let fixture: ComponentFixture<CalloutComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CalloutComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              warning: "Warning",
              error: "Error",
            }),
        },
      ],
    });
    fixture = TestBed.createComponent(CalloutComponent);
    component = fixture.componentInstance;
  });

  describe("default state", () => {
    it("success", () => {
      component.type = "success";
      fixture.detectChanges();
      expect(component.title).toBeUndefined();
      expect(component.icon).toBe("bwi-check");
      expect(component.headerClass).toBe("!tw-text-success");
    });

    it("info", () => {
      component.type = "info";
      fixture.detectChanges();
      expect(component.title).toBeUndefined();
      expect(component.icon).toBe("bwi-info-circle");
      expect(component.headerClass).toBe("!tw-text-info");
    });

    it("warning", () => {
      component.type = "warning";
      fixture.detectChanges();
      expect(component.title).toBe("Warning");
      expect(component.icon).toBe("bwi-exclamation-triangle");
      expect(component.headerClass).toBe("!tw-text-warning");
    });

    it("danger", () => {
      component.type = "danger";
      fixture.detectChanges();
      expect(component.title).toBe("Error");
      expect(component.icon).toBe("bwi-error");
      expect(component.headerClass).toBe("!tw-text-danger");
    });
  });
});
