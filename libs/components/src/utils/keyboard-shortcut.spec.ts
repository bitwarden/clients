import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { NgZone } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { KeyboardShortcut, KeyboardShortcutService } from "./keyboard-shortcut";

// Only `overlayRef.overlayElement` is read, and `mock<DialogRef>()` cannot supply it: its
// DeepPartial argument recurses into the DOM types and fails to typecheck.
const dialogOver = (overlayElement: HTMLElement) =>
  ({ overlayRef: { overlayElement } }) as unknown as DialogRef;

describe("KeyboardShortcutService", () => {
  let service: KeyboardShortcutService;
  let openDialogs: DialogRef[];
  let hosts: HTMLElement[];

  /** A detached-by-default host; `attach()` puts it in the document. */
  const makeHost = () => {
    const host = document.createElement("div");
    hosts.push(host);
    return host;
  };

  const attach = (host: HTMLElement) => {
    document.body.appendChild(host);
    return host;
  };

  const register = (overrides: Partial<KeyboardShortcut> = {}, host = attach(makeHost())) => {
    const handler = jest.fn();
    const unregister = service.register(
      { key: "f", code: "KeyF", enabled: () => true, handler, ...overrides },
      host,
    );
    return { handler, unregister, host };
  };

  const press = (init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", {
      key: "f",
      code: "KeyF",
      ctrlKey: true,
      cancelable: true,
      ...init,
    });
    document.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    openDialogs = [];
    hosts = [];

    TestBed.configureTestingModule({
      providers: [{ provide: Dialog, useValue: { openDialogs } as unknown as Dialog }],
    });
    service = TestBed.inject(KeyboardShortcutService);
  });

  afterEach(() => {
    hosts.forEach((host) => host.remove());
  });

  describe("chord matching", () => {
    it.each([
      ["Ctrl", { ctrlKey: true }],
      ["Cmd", { metaKey: true }],
    ])("claims the chord on %s", (_, modifier) => {
      const { handler } = register();

      const event = press({ ctrlKey: false, ...modifier });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });

    it.each([
      ["no modifier", { ctrlKey: false }],
      ["Ctrl and Cmd together", { metaKey: true }],
      ["Shift", { shiftKey: true }],
      ["Alt", { altKey: true }],
    ])("ignores the press with %s", (_, init) => {
      const { handler } = register();

      const event = press(init);

      expect(handler).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("ignores a different letter", () => {
      const { handler } = register();

      press({ key: "g", code: "KeyG" });

      expect(handler).not.toHaveBeenCalled();
    });

    it.each([
      ["held", { repeat: true }],
      ["mid-IME-composition", { isComposing: true }],
    ])("ignores a %s press", (_, init) => {
      const { handler } = register();

      press(init);

      expect(handler).not.toHaveBeenCalled();
    });

    it("ignores a press something else already handled", () => {
      const { handler } = register();
      const event = new KeyboardEvent("keydown", {
        key: "f",
        code: "KeyF",
        ctrlKey: true,
        cancelable: true,
      });
      event.preventDefault();

      document.dispatchEvent(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("keyboard layouts", () => {
    // AZERTY and QWERTZ leave F where QWERTY has it, so the plain `key` match already covers them.
    it.each([
      ["QWERTY, AZERTY and QWERTZ", { key: "f", code: "KeyF" }],
      ["Cyrillic", { key: "\u0430", code: "KeyF" }],
      ["Greek", { key: "\u03c6", code: "KeyF" }],
      ["Arabic", { key: "\u0628", code: "KeyF" }],
      ["Dvorak, where F sits on the physical Y key", { key: "f", code: "KeyY" }],
    ])("claims the chord on %s", (_, init) => {
      const { handler } = register();

      press(init);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("does not fall back to the physical key when a Latin letter is reported", () => {
      const { handler } = register();

      // Dvorak types "u" on the physical F key. The user's keycaps say "u", so this is not the chord.
      press({ key: "u", code: "KeyF" });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("eligibility", () => {
    it("skips a disabled owner", () => {
      const { handler } = register({ enabled: () => false });

      press();

      expect(handler).not.toHaveBeenCalled();
    });

    it("skips a detached owner", () => {
      const { handler } = register({}, makeHost());

      press();

      expect(handler).not.toHaveBeenCalled();
    });

    it("skips an owner inside an inert subtree", () => {
      const wrapper = attach(makeHost());
      wrapper.setAttribute("inert", "");
      const host = wrapper.appendChild(document.createElement("div"));
      const { handler } = register({}, host);

      press();

      expect(handler).not.toHaveBeenCalled();
    });

    it("leaves the event alone when nothing is eligible, so the native binding still works", () => {
      register({ enabled: () => false });

      const event = press();

      expect(event.defaultPrevented).toBe(false);
    });

    it("stops claiming once unregistered", () => {
      const { handler, unregister } = register();

      unregister();
      press();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("with a dialog open", () => {
    it("skips an owner behind the dialog", () => {
      const { handler } = register();
      openDialogs.push(dialogOver(attach(makeHost())));

      press();

      expect(handler).not.toHaveBeenCalled();
    });

    it("still claims for an owner inside the dialog", () => {
      const overlay = attach(makeHost());
      const host = overlay.appendChild(document.createElement("div"));
      const { handler } = register({}, host);
      openDialogs.push(dialogOver(overlay));

      press();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("arbitration", () => {
    it("gives the chord to exactly one of two eligible owners", () => {
      const first = register();
      const second = register();

      press();

      expect(first.handler).not.toHaveBeenCalled();
      expect(second.handler).toHaveBeenCalledTimes(1);
    });

    it("prefers the owner nearest the focused element over the newer one", () => {
      const focused = attach(makeHost());
      const input = focused.appendChild(document.createElement("input"));
      const near = register({}, focused);
      const newer = register();

      input.focus();
      press();

      expect(near.handler).toHaveBeenCalledTimes(1);
      expect(newer.handler).not.toHaveBeenCalled();
    });

    it("falls back to the newest owner when focus is on the body", () => {
      const older = register();
      const newer = register();

      document.body.focus();
      press();

      expect(older.handler).not.toHaveBeenCalled();
      expect(newer.handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("modifier tracking", () => {
    it("seeds from the platform", () => {
      expect(service.modifierKey()).toBe("Ctrl");
    });

    it("corrects to Command on a Cmd chord", () => {
      press({ ctrlKey: false, metaKey: true });

      expect(service.modifierKey()).toBe("Command");
    });

    it("keeps Ctrl on a Ctrl chord", () => {
      press();

      expect(service.modifierKey()).toBe("Ctrl");
    });

    // The Windows key also reports as "Meta", so a bare press is not evidence of a Mac.
    it("ignores a bare Meta press", () => {
      press({ key: "Meta", ctrlKey: false, metaKey: true });

      expect(service.modifierKey()).toBe("Ctrl");
    });

    it("ignores an ambiguous Cmd+Ctrl chord", () => {
      press({ metaKey: true });

      expect(service.modifierKey()).toBe("Ctrl");
    });

    it("tracks the modifier even when no shortcut is registered", () => {
      press({ key: "x", code: "KeyX", ctrlKey: false, metaKey: true });

      expect(service.modifierKey()).toBe("Command");
    });
  });

  describe("the document listener", () => {
    const keydownCalls = (spy: jest.SpyInstance) =>
      spy.mock.calls.filter(([type]) => type === "keydown").length;

    it("installs exactly one listener regardless of how many owners register", () => {
      TestBed.resetTestingModule();
      const added = jest.spyOn(document, "addEventListener");
      TestBed.configureTestingModule({
        providers: [{ provide: Dialog, useValue: { openDialogs: [] } as unknown as Dialog }],
      });

      const fresh = TestBed.inject(KeyboardShortcutService);
      expect(keydownCalls(added)).toBe(1);

      const shortcut = { key: "f", code: "KeyF", enabled: () => true, handler: () => {} };
      fresh.register(shortcut, attach(makeHost()));
      fresh.register(shortcut, attach(makeHost()));

      expect(keydownCalls(added)).toBe(1);
      added.mockRestore();
    });

    it("removes its listener when the injector is destroyed", () => {
      const removed = jest.spyOn(document, "removeEventListener");

      TestBed.resetTestingModule();

      expect(removed).toHaveBeenCalledWith("keydown", expect.any(Function), true);
      removed.mockRestore();
    });
  });

  // The handler moves focus and writes signals, so it has to land inside the zone even though the
  // listener itself is installed outside it.
  it("runs the winning handler inside the Angular zone", () => {
    let inZone: boolean | undefined;
    register({ handler: () => (inZone = NgZone.isInAngularZone()) });

    press();

    expect(inZone).toBe(true);
  });
});
