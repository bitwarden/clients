import { mock } from "jest-mock-extended";

import { postWindowMessage } from "../spec/testing-utils";

import { NotificationBarWindowMessage } from "./abstractions/notification-bar";
import "./bar";

jest.mock("lit", () => ({ render: jest.fn() }));
jest.mock("@lit-labs/signals", () => ({
  signal: jest.fn((testValue) => ({ get: (): typeof testValue => testValue })),
}));
jest.mock("../content/components/notification/container", () => ({
  NotificationContainer: jest.fn(),
}));

describe("NotificationBar iframe handleWindowMessage security", () => {
  const trustedOrigin = "http://localhost";
  const maliciousOrigin = "https://malicious.com";

  const createMessage = (
    overrides: Partial<NotificationBarWindowMessage> = {},
  ): NotificationBarWindowMessage => ({
    command: "initNotificationBar",
    ...overrides,
  });

  beforeEach(() => {
    Object.defineProperty(globalThis, "location", {
      value: { search: `?parentOrigin=${encodeURIComponent(trustedOrigin)}` },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "parent", {
      value: mock<Window>(),
      writable: true,
      configurable: true,
    });
    globalThis.dispatchEvent(new Event("load"));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    {
      description: "not from parent window",
      message: () => createMessage(),
      origin: trustedOrigin,
      source: () => mock<Window>(),
    },
    {
      description: "with mismatched origin",
      message: () => createMessage(),
      origin: maliciousOrigin,
      source: () => globalThis.parent,
    },
    {
      description: "without command field",
      message: () => ({}),
      origin: trustedOrigin,
      source: () => globalThis.parent,
    },
    {
      description: "initNotificationBar with mismatched parentOrigin",
      message: () => createMessage({ parentOrigin: maliciousOrigin }),
      origin: trustedOrigin,
      source: () => globalThis.parent,
    },
    {
      description: "when windowMessageOrigin is not set",
      message: () => createMessage(),
      origin: "different-origin",
      source: () => globalThis.parent,
      resetOrigin: true,
    },
    {
      description: "with null source",
      message: () => createMessage(),
      origin: trustedOrigin,
      source: (): null => null,
    },
    {
      description: "with unknown command",
      message: () => createMessage({ command: "unknownCommand" }),
      origin: trustedOrigin,
      source: () => globalThis.parent,
    },
  ])("should reject messages $description", ({ message, origin, source, resetOrigin }) => {
    if (resetOrigin) {
      Object.defineProperty(globalThis, "location", {
        value: { search: "" },
        writable: true,
        configurable: true,
      });
    }
    const spy = jest.spyOn(globalThis.parent, "postMessage").mockImplementation();
    postWindowMessage(message(), origin, source());
    expect(spy).not.toHaveBeenCalled();
  });

  it("should accept and handle valid trusted messages", () => {
    const spy = jest.spyOn(globalThis.parent, "postMessage").mockImplementation();
    spy.mockClear();

    const validMessage = createMessage({
      parentOrigin: trustedOrigin,
      initData: {
        type: "change",
        isVaultLocked: false,
        removeIndividualVault: false,
        importType: null,
        launchTimestamp: Date.now(),
      },
    });
    postWindowMessage(validMessage, trustedOrigin, globalThis.parent);
    expect(validMessage.command).toBe("initNotificationBar");
    expect(validMessage.parentOrigin).toBe(trustedOrigin);
    expect(validMessage.initData).toBeDefined();
  });
});
