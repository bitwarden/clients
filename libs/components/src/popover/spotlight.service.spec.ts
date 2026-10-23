import { TestBed } from "@angular/core/testing";

import { SpotlightService } from "./spotlight.service";

// JSDOM does not implement ResizeObserver
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

describe("SpotlightService", () => {
  let service: SpotlightService;
  let target: HTMLElement;

  const backdrop = () => document.querySelector(".bit-spotlight-backdrop");

  beforeEach(() => {
    jest.useFakeTimers();
    service = TestBed.inject(SpotlightService);
    target = document.body.appendChild(document.createElement("button"));
  });

  afterEach(() => {
    jest.useRealTimers();
    target.remove();
  });

  it("blocks clicks with an overlay backdrop while shown", () => {
    service.showSpotlight(target);

    expect(backdrop()).not.toBeNull();
    expect(backdrop()?.classList).not.toContain("cdk-overlay-transparent-backdrop");
  });

  it("removes the backdrop once the hide delay passes", () => {
    service.showSpotlight(target);
    service.hideSpotlight();

    expect(backdrop()).not.toBeNull();
    jest.advanceTimersByTime(100);
    expect(backdrop()).toBeNull();
  });

  it("keeps one backdrop when moving to a new target", () => {
    const next = document.body.appendChild(document.createElement("button"));
    service.showSpotlight(target);
    service.showSpotlight(next);

    expect(document.querySelectorAll(".bit-spotlight-backdrop")).toHaveLength(1);
    next.remove();
  });

  describe("data-spotlight-target", () => {
    let inner: HTMLElement;

    beforeEach(() => {
      inner = target.appendChild(document.createElement("span"));
      inner.setAttribute("data-spotlight-target", "");
      inner.scrollIntoView = jest.fn();
      target.scrollIntoView = jest.fn();
    });

    it("resolves to the inner target when the host has data-spotlight-host", () => {
      target.setAttribute("data-spotlight-host", "");
      service.showSpotlight(target);

      expect(inner.scrollIntoView).toHaveBeenCalled();
      expect(target.scrollIntoView).not.toHaveBeenCalled();
    });

    it("ignores the inner target when the host lacks data-spotlight-host", () => {
      service.showSpotlight(target);

      expect(target.scrollIntoView).toHaveBeenCalled();
      expect(inner.scrollIntoView).not.toHaveBeenCalled();
    });
  });
});
