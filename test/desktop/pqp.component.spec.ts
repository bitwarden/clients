import { OrchestrationState, PeerIndex } from "@ovrlab/pqp-network";

import { PqpComponent } from "../../apps/desktop/src/app/pqp/pqp.component";

// Mock @ovrlab/pqp-network to prevent side-effects during unit tests
jest.mock("@ovrlab/pqp-network", () => ({
  init: jest.fn(),
  sendMessage: jest.fn(),
  getMessages: jest.fn().mockResolvedValue([]),
  setMessages: jest.fn(),
  clearBadge: jest.fn(),
  loadPeerIndex: jest.fn().mockResolvedValue({ peers: {}, self: null }),
  getOrchestrationState: jest.fn().mockResolvedValue(null),
  ServiceLocator: { getSyncStorage: jest.fn(), getVault: jest.fn() },
  isLoggedIn: jest.fn().mockResolvedValue(false),
  logout: jest.fn(),
}));

describe("PqpComponent (Desktop)", () => {
  let component: PqpComponent;

  beforeEach(() => {
    component = new PqpComponent();
  });

  describe("getOrchestrationStatusText", () => {
    const basePeerIndex: PeerIndex = { peers: {}, self: null } as any;

    it("should return 'Not logged in' for LOGGED_OUT", () => {
      const state: OrchestrationState = { status: "LOGGED_OUT" } as any;
      expect(component.getOrchestrationStatusText(state, basePeerIndex)).toBe("Not logged in");
    });

    it("should return 'Logged in' for LOGGED_IN", () => {
      const state: OrchestrationState = { status: "LOGGED_IN" } as any;
      expect(component.getOrchestrationStatusText(state, basePeerIndex)).toBe("Logged in");
    });

    it("should return 'Bootstrapping assets...' for BOOTSTRAPPING", () => {
      const state: OrchestrationState = { status: "BOOTSTRAPPING" } as any;
      expect(component.getOrchestrationStatusText(state, basePeerIndex)).toBe(
        "Bootstrapping assets...",
      );
    });

    it("should return 'Joining network...' for JOINING", () => {
      const state: OrchestrationState = { status: "JOINING" } as any;
      expect(component.getOrchestrationStatusText(state, basePeerIndex)).toBe(
        "Joining network...",
      );
    });

    it("should return path text for JOINED with self", () => {
      const state: OrchestrationState = { status: "JOINED" } as any;
      const peerIndex: PeerIndex = {
        peers: {},
        self: { tier: { tier: 0, path: [2, 1] } },
      } as any;
      expect(component.getOrchestrationStatusText(state, peerIndex)).toBe("Joined: 1.2");
    });

    it("should return 'Joined: Unknown' for JOINED without self path", () => {
      const state: OrchestrationState = { status: "JOINED" } as any;
      expect(component.getOrchestrationStatusText(state, basePeerIndex)).toBe("Joined: Unknown");
    });

    it("should return error message for ERROR state", () => {
      const state: OrchestrationState = {
        status: "ERROR",
        lastError: "Something broke",
      } as any;
      expect(component.getOrchestrationStatusText(state, basePeerIndex)).toBe(
        "Error: Something broke",
      );
    });

    it("should return 'Unknown state' for unrecognized status", () => {
      const state: OrchestrationState = { status: "UNKNOWN_STATUS" } as any;
      expect(component.getOrchestrationStatusText(state, basePeerIndex)).toBe("Unknown state");
    });
  });

  describe("getOrchestrationStatusClass", () => {
    it("should return 'status-success' for JOINED", () => {
      expect(component.getOrchestrationStatusClass("JOINED")).toBe("status-success");
    });

    it("should return 'status-error' for ERROR", () => {
      expect(component.getOrchestrationStatusClass("ERROR")).toBe("status-error");
    });

    it("should return 'status-warning' for LOGGED_OUT", () => {
      expect(component.getOrchestrationStatusClass("LOGGED_OUT")).toBe("status-warning");
    });

    it("should return 'status-info' for other states", () => {
      expect(component.getOrchestrationStatusClass("BOOTSTRAPPING")).toBe("status-info");
      expect(component.getOrchestrationStatusClass("JOINING")).toBe("status-info");
      expect(component.getOrchestrationStatusClass("LOGGED_IN")).toBe("status-info");
    });
  });
});
