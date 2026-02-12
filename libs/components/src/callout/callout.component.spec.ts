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
      fixture.componentRef.setInput("type", "success");
      fixture.detectChanges();
      expect(component.titleComputed()).toBeUndefined();
      expect(component.iconComputed()).toBe("bwi-check-circle");
    });

    it("info", () => {
      fixture.componentRef.setInput("type", "info");
      fixture.detectChanges();
      expect(component.titleComputed()).toBeUndefined();
      expect(component.iconComputed()).toBe("bwi-info-circle");
    });

    it("warning", () => {
      fixture.componentRef.setInput("type", "warning");
      fixture.detectChanges();
      expect(component.titleComputed()).toBe("Warning");
      expect(component.iconComputed()).toBe("bwi-exclamation-triangle");
    });

    it("danger", () => {
      fixture.componentRef.setInput("type", "danger");
      fixture.detectChanges();
      expect(component.titleComputed()).toBe("Error");
      expect(component.iconComputed()).toBe("bwi-error");
    });

    it("default", () => {
      fixture.componentRef.setInput("type", "default");
      fixture.detectChanges();
      expect(component.titleComputed()).toBeUndefined();
      expect(component.iconComputed()).toBe("bwi-star");
    });
  });
});
