import { isBitSvg } from "@bitwarden/assets/svg";

import { AgentId } from "../models/agent-id";

import { AGENT_LOGOS } from "./index";

describe("AGENT_LOGOS", () => {
  it.each(Object.values(AgentId))("has a logo for agent id '%s'", (agentId) => {
    expect(AGENT_LOGOS[agentId]).toBeDefined();
  });

  it.each(Object.values(AgentId))("logo for '%s' is a valid BitSvg", (agentId) => {
    expect(isBitSvg(AGENT_LOGOS[agentId])).toBe(true);
  });
});
