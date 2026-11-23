import { dialog } from "electron";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SshAgentApprovalMain } from "./ssh-agent-approval.main";

jest.mock("electron", () => ({ dialog: { showMessageBox: jest.fn() } }));

const AUTHORIZE = 0;
const DENY = 1;

describe("SshAgentApprovalMain", () => {
  const request = {
    cipherName: "My Key",
    application: "ssh",
    isAgentForwarding: false,
    namespace: "",
  };

  let sut: SshAgentApprovalMain;

  const options = () => jest.mocked(dialog.showMessageBox).mock.calls[0][0];

  beforeEach(() => {
    jest.clearAllMocks();
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string, ...params: string[]) =>
      [key, ...params].join(":"),
    );
    sut = new SshAgentApprovalMain(i18nService);
  });

  it("authorizes when the user presses Authorize", async () => {
    jest.mocked(dialog.showMessageBox).mockResolvedValue({ response: AUTHORIZE } as never);

    expect(await sut.request(request)).toBe(true);
  });

  it("denies when the user presses Deny or closes the window", async () => {
    jest.mocked(dialog.showMessageBox).mockResolvedValue({ response: DENY } as never);

    expect(await sut.request(request)).toBe(false);
    expect(options()).toMatchObject({ defaultId: DENY, cancelId: DENY });
  });

  it("closes the window after a minute, which denies", async () => {
    jest.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      jest.mocked(dialog.showMessageBox).mockImplementation(((opts: { signal?: AbortSignal }) => {
        signal = opts.signal;
        return new Promise(() => undefined);
      }) as never);

      void sut.request(request);
      expect(signal?.aborted).toBe(false);

      jest.advanceTimersByTime(60_000);

      expect(signal?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([
    ["", "sshActionLogin"],
    ["ssh", "sshActionSign"],
    ["git", "sshActionGitSign"],
  ])("describes a %j request with %s", async (namespace, actionKey) => {
    jest.mocked(dialog.showMessageBox).mockResolvedValue({ response: DENY } as never);

    await sut.request({ ...request, namespace });

    expect(options().message).toBe(
      `ssh sshkeyApprovalMessageInfix My Key sshkeyApprovalMessageSuffix ${actionKey}`,
    );
  });

  it("warns about agent forwarding and AI agents", async () => {
    jest.mocked(dialog.showMessageBox).mockResolvedValue({ response: DENY } as never);

    await sut.request({ ...request, isAgentForwarding: true, aiAgent: "claude" });

    expect(options().detail).toContain("agentForwardingWarningText");
    expect(options().detail).toContain("sshAgentAiAgentWarningText:claude");
  });
});
