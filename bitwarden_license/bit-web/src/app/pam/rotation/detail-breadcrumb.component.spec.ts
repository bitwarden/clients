import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { DetailBreadcrumbComponent } from "./detail-breadcrumb.component";

(global as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("DetailBreadcrumbComponent", () => {
  let fixture: ComponentFixture<DetailBreadcrumbComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DetailBreadcrumbComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    });
    fixture = TestBed.createComponent(DetailBreadcrumbComponent);
    fixture.componentRef.setInput("route", ["/parent"]);
    fixture.componentRef.setInput("parentLabelKey", "parentKey");
    fixture.componentRef.setInput("current", "Current page");
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it("shows the parent crumb and the current title with no icons by default", () => {
    fixture.detectChanges();

    expect(el().textContent).toContain("parentKey");
    expect(el().querySelector('[aria-current="page"]')?.textContent?.trim()).toBe("Current page");
    expect(el().querySelector("bit-icon-tile")).toBeNull();
    expect(el().querySelector("bit-icon.bwi-managed-credential")).toBeNull();
  });

  it("shows the parent icon and a tile before the current title", () => {
    fixture.componentRef.setInput("parentIcon", "bwi-managed-credential");
    fixture.componentRef.setInput("currentTileIcon", "bwi-plus");
    fixture.detectChanges();

    expect(el().querySelector("bit-icon.bwi-managed-credential")).not.toBeNull();
    expect(el().querySelector('[aria-current="page"] bit-icon-tile')).not.toBeNull();
  });

  it("adds a linked step between the parent and the current title", () => {
    fixture.componentRef.setInput("step", {
      labelKey: "stepKey",
      route: ["/parent", "new"],
      tileIcon: "bwi-plus",
    });
    fixture.detectChanges();

    const text = el().textContent ?? "";
    expect(text.indexOf("parentKey")).toBeLessThan(text.indexOf("stepKey"));
    expect(text.indexOf("stepKey")).toBeLessThan(text.indexOf("Current page"));
    expect(el().querySelectorAll("a").length).toBe(2);
  });
});
