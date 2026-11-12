import { Command, program } from "commander";
import { mock } from "jest-mock-extended";

import type { ServiceContainer } from "../service-container";

import { registerApprovals } from "./approvals";
import { registerConnectors } from "./connectors";
import { registerLeases } from "./leases";
import { PamProgram } from "./pam.program";
import { registerRequests } from "./requests";
import { registerRotation } from "./rotation";
import { registerRules } from "./rules";
import { registerStatus } from "./status";
import { registerTargets } from "./targets";

jest.mock("./approvals", () => ({ registerApprovals: jest.fn() }));
jest.mock("./connectors", () => ({ registerConnectors: jest.fn() }));
jest.mock("./leases", () => ({ registerLeases: jest.fn() }));
jest.mock("./requests", () => ({ registerRequests: jest.fn() }));
jest.mock("./rotation", () => ({ registerRotation: jest.fn() }));
jest.mock("./rules", () => ({ registerRules: jest.fn() }));
jest.mock("./status", () => ({ registerStatus: jest.fn() }));
jest.mock("./targets", () => ({ registerTargets: jest.fn() }));

describe("PamProgram", () => {
  const container = mock<ServiceContainer>();
  const groups = [
    registerRequests,
    registerLeases,
    registerApprovals,
    registerRules,
    registerConnectors,
    registerTargets,
    registerRotation,
    registerStatus,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    (program.commands as Command[]).splice(0, program.commands.length);
  });

  it("adds `pam` to the root program", () => {
    new PamProgram(container).register();

    expect(program.commands.map((c) => c.name())).toContain("pam");
  });

  it("mounts every group on the pam command, in a fixed order, with the container", () => {
    new PamProgram(container).register();
    const pam = program.commands.find((c) => c.name() === "pam") as Command;

    for (const register of groups) {
      expect(register).toHaveBeenCalledTimes(1);
      expect(register).toHaveBeenCalledWith(pam, container);
    }
    const order = groups.map((g) => (g as jest.Mock).mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("answers to the short alias `pc`", () => {
    new PamProgram(container).register();
    const pam = program.commands.find((c) => c.name() === "pam") as Command;

    expect(pam.aliases()).toEqual(["pc"]);
  });

  it("describes the command for --help", () => {
    new PamProgram(container).register();
    const pam = program.commands.find((c) => c.name() === "pam") as Command;

    expect(pam.description()).toContain("Privileged Controls");
  });
});
