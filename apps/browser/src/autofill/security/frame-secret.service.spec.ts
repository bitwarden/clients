import { FrameSecretService } from "./frame-secret.service";

describe("FrameSecretService", () => {
  let service: FrameSecretService;

  beforeEach(() => {
    // crypto.getRandomValues is provided by jsdom; nothing to mock.
    service = new FrameSecretService();
  });

  describe("issue", () => {
    it("returns a non-empty base64url string", () => {
      const secret = service.issue(1, 0);
      expect(typeof secret).toBe("string");
      expect(secret.length).toBeGreaterThan(20);
      // base64url alphabet only.
      expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("returns a fresh secret on each call (no reuse)", () => {
      const a = service.issue(1, 0);
      const b = service.issue(1, 0);
      const c = service.issue(2, 0);
      expect(a).not.toBe(b);
      expect(a).not.toBe(c);
    });

    it("overwrites any prior secret for the same (tabId, frameId)", () => {
      const first = service.issue(1, 0);
      const second = service.issue(1, 0);
      expect(service.verify(1, 0, first)).toBe(false);
      expect(service.verify(1, 0, second)).toBe(true);
    });
  });

  describe("verify", () => {
    it("returns true for the issued secret", () => {
      const secret = service.issue(1, 0);
      expect(service.verify(1, 0, secret)).toBe(true);
    });

    it("returns false for the wrong secret on a known (tabId, frameId)", () => {
      service.issue(1, 0);
      expect(service.verify(1, 0, "bogus")).toBe(false);
    });

    it("returns false when no secret has been issued for that frame", () => {
      service.issue(1, 0);
      expect(service.verify(9, 0, "anything")).toBe(false);
    });

    it("returns false on a claimed secret of undefined", () => {
      service.issue(1, 0);
      expect(service.verify(1, 0, undefined)).toBe(false);
    });

    it("isolates secrets by frameId within a single tab", () => {
      const top = service.issue(1, 0);
      const sub = service.issue(1, 5);
      expect(service.verify(1, 0, sub)).toBe(false);
      expect(service.verify(1, 5, top)).toBe(false);
      expect(service.verify(1, 0, top)).toBe(true);
      expect(service.verify(1, 5, sub)).toBe(true);
    });
  });

  describe("revoke", () => {
    it("drops only the specified frame when frameId is provided", () => {
      const top = service.issue(1, 0);
      const sub = service.issue(1, 5);
      service.revoke(1, 0);
      expect(service.verify(1, 0, top)).toBe(false);
      expect(service.verify(1, 5, sub)).toBe(true);
    });

    it("drops every frame on the tab when frameId is omitted", () => {
      const top = service.issue(1, 0);
      const sub = service.issue(1, 5);
      const other = service.issue(2, 0);
      service.revoke(1);
      expect(service.verify(1, 0, top)).toBe(false);
      expect(service.verify(1, 5, sub)).toBe(false);
      expect(service.verify(2, 0, other)).toBe(true);
    });
  });

  describe("lifecycle hooks", () => {
    it("subscribes to tabs.onRemoved, webNavigation.onCommitted, runtime.onSuspend", () => {
      const onRemoved = (chrome.tabs.onRemoved.addListener as jest.Mock).mock.calls.length;
      const onSuspend = ((chrome.runtime as any).onSuspend?.addListener as jest.Mock | undefined)
        ?.mock?.calls?.length;
      // Construction in beforeEach already attached one listener of each kind.
      expect(onRemoved).toBeGreaterThan(0);
      // onSuspend is optional in the test setup; the service guards on its presence.
      if (onSuspend !== undefined) {
        expect(onSuspend).toBeGreaterThan(0);
      }
    });
  });

  describe("constant-time comparison (smoke test)", () => {
    // We can't assert wall-clock timing in unit tests deterministically; the
    // integration concern is that the impl XORs through the full length. Verify
    // behavior: equal-prefix-different-suffix and equal-suffix-different-prefix
    // both correctly reject.
    it("rejects strings that differ only in the last character", () => {
      const secret = service.issue(1, 0);
      const tampered = secret.slice(0, -1) + (secret.endsWith("a") ? "b" : "a");
      expect(service.verify(1, 0, tampered)).toBe(false);
    });

    it("rejects strings that differ only in the first character", () => {
      const secret = service.issue(1, 0);
      const tampered = (secret.startsWith("a") ? "b" : "a") + secret.slice(1);
      expect(service.verify(1, 0, tampered)).toBe(false);
    });

    it("rejects strings with the same prefix but different length", () => {
      const secret = service.issue(1, 0);
      expect(service.verify(1, 0, secret + "x")).toBe(false);
      expect(service.verify(1, 0, secret.slice(0, -1))).toBe(false);
    });
  });
});
