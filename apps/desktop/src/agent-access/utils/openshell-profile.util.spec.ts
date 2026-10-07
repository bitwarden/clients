import {
  OpenShellManagementResult,
  OpenShellProfileCredential,
  OpenShellProviderProfile,
} from "../models/openshell-management";

import {
  addOpenShellCredentialUnique,
  isSingleSecretProfile,
  slotFor,
} from "./openshell-profile.util";

function credential(name: string, required: boolean): OpenShellProfileCredential {
  return { name, description: "", envVars: [name.toUpperCase()], required };
}

function profile(credentials: OpenShellProfileCredential[]): OpenShellProviderProfile {
  return { id: "p", displayName: "P", description: "", credentials, endpoints: [] };
}

describe("slotFor", () => {
  it("prefers the first required credential", () => {
    const slot = slotFor(
      profile([credential("a", false), credential("b", true), credential("c", true)]),
    );
    expect(slot?.name).toBe("b");
  });

  it("falls back to the first credential when none is required", () => {
    expect(slotFor(profile([credential("a", false), credential("b", false)]))?.name).toBe("a");
  });

  it("is null when the profile has no credentials", () => {
    expect(slotFor(profile([]))).toBeNull();
  });
});

describe("isSingleSecretProfile", () => {
  it("accepts one required credential, optional extras or a single optional one", () => {
    expect(isSingleSecretProfile(profile([credential("a", true)]))).toBe(true);
    expect(isSingleSecretProfile(profile([credential("a", true), credential("b", false)]))).toBe(
      true,
    );
    expect(isSingleSecretProfile(profile([credential("a", false)]))).toBe(true);
  });

  it("rejects two required credentials", () => {
    expect(isSingleSecretProfile(profile([credential("a", true), credential("b", true)]))).toBe(
      false,
    );
  });

  it("rejects a profile without credentials", () => {
    expect(isSingleSecretProfile(profile([]))).toBe(false);
  });
});

describe("addOpenShellCredentialUnique", () => {
  const request = {
    sandboxName: "sb1",
    profileId: "github",
    bindings: [
      {
        envVar: "GITHUB_TOKEN",
        resourceType: "item" as const,
        id: "11111111-1111-4111-8111-111111111111",
        field: "password" as const,
        label: "GitHub",
      },
    ],
  };
  const exists: OpenShellManagementResult<void> = { ok: false, error: "alreadyExists" };
  const done: OpenShellManagementResult<void> = { ok: true, data: undefined };

  let add: jest.Mock;
  let originalIpc: unknown;

  beforeEach(() => {
    add = jest.fn();
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: { addOpenShellCredential: add } };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
  });

  it("leaves the provider name to main on the first attempt", async () => {
    add.mockResolvedValue(done);

    const result = await addOpenShellCredentialUnique(request);

    expect(result).toEqual(done);
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(request);
    expect(add.mock.calls[0][0]).not.toHaveProperty("providerName");
  });

  it("retries with a numeric suffix while the name is taken", async () => {
    add.mockResolvedValueOnce(exists).mockResolvedValueOnce(exists).mockResolvedValueOnce(done);

    const result = await addOpenShellCredentialUnique(request);

    expect(result.ok).toBe(true);
    expect(add).toHaveBeenCalledTimes(3);
    expect(add.mock.calls[1][0].providerName).toBe("github-sb1-2");
    expect(add.mock.calls[2][0].providerName).toBe("github-sb1-3");
  });

  it("gives up after five attempts with alreadyExists", async () => {
    add.mockResolvedValue(exists);

    const result = await addOpenShellCredentialUnique(request);

    expect(result).toEqual({ ok: false, error: "alreadyExists" });
    expect(add).toHaveBeenCalledTimes(5);
    expect(add.mock.calls[4][0].providerName).toBe("github-sb1-5");
  });

  it("returns any other failure at once, without retrying", async () => {
    const failure: OpenShellManagementResult<void> = {
      ok: false,
      error: "gatewayUnreachable",
      message: "refused",
    };
    add.mockResolvedValue(failure);

    const result = await addOpenShellCredentialUnique(request);

    expect(result).toEqual(failure);
    expect(add).toHaveBeenCalledTimes(1);
  });
});
