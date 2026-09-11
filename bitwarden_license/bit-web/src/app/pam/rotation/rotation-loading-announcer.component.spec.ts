import { ComponentRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { RotationLoadingAnnouncerComponent } from "./rotation-loading-announcer.component";

describe("RotationLoadingAnnouncerComponent", () => {
  let fixture: ComponentFixture<RotationLoadingAnnouncerComponent>;
  let ref: ComponentRef<RotationLoadingAnnouncerComponent>;

  function create({ loading = true, failed = false } = {}) {
    fixture = TestBed.createComponent(RotationLoadingAnnouncerComponent);
    ref = fixture.componentRef;
    ref.setInput("loading", loading);
    ref.setInput("loadedKey", "pamTargetSystemsLoaded");
    ref.setInput("failed", failed);
    fixture.detectChanges();
  }

  function set(inputs: { loading?: boolean; failed?: boolean }) {
    Object.entries(inputs).forEach(([name, value]) => ref.setInput(name, value));
    fixture.detectChanges();
  }

  const region = () =>
    fixture.nativeElement.querySelector('[data-testid="rotation-loading-status"]');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RotationLoadingAnnouncerComponent],
      providers: [{ provide: I18nService, useValue: { t: (id: string) => id } }],
    }).compileComponents();
  });

  it("is a polite live region that stays in the DOM across the whole load", () => {
    create({ loading: true });

    const first = region();
    expect(first.getAttribute("role")).toBe("status");
    expect(first.getAttribute("aria-live")).toBe("polite");
    expect(first.className).toContain("tw-sr-only");

    set({ loading: false });

    expect(region()).toBe(first);
  });

  it("announces loading while the placeholder is up, then the arrival", () => {
    create({ loading: true });

    expect(region().textContent).toContain("loading");

    set({ loading: false });

    expect(region().textContent).toContain("pamTargetSystemsLoaded");
    expect(region().textContent).not.toContain("loading");
  });

  it("says nothing when nothing was ever loading", () => {
    create({ loading: false });

    expect(region().textContent.trim()).toBe("");
  });

  it("does not announce a failed load as loaded", () => {
    create({ loading: true });

    set({ loading: false, failed: true });

    expect(region().textContent.trim()).toBe("");
  });

  it("announces the arrival once a failed load is retried successfully", () => {
    create({ loading: true });
    set({ loading: false, failed: true });

    set({ loading: true, failed: false });
    expect(region().textContent).toContain("loading");

    set({ loading: false });
    expect(region().textContent).toContain("pamTargetSystemsLoaded");
  });

  it("says nothing when a retry clears the error before its placeholder arrives", () => {
    create({ loading: true });
    set({ loading: false, failed: true });

    set({ failed: false });
    expect(region().textContent.trim()).toBe("");

    set({ loading: true });
    expect(region().textContent).toContain("loading");

    set({ loading: false });
    expect(region().textContent).toContain("pamTargetSystemsLoaded");
  });

  it("says nothing when a retry fails again without a placeholder", () => {
    create({ loading: true });
    set({ loading: false, failed: true });

    set({ failed: false });
    set({ failed: true });

    expect(region().textContent.trim()).toBe("");
  });

  it("announces every later load, not just the first", () => {
    create({ loading: true });
    set({ loading: false });
    expect(region().textContent).toContain("pamTargetSystemsLoaded");

    set({ loading: true });
    expect(region().textContent).toContain("loading");

    set({ loading: false });
    expect(region().textContent).toContain("pamTargetSystemsLoaded");
  });
});
