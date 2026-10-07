import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import { CredentialQueryType } from "../models/credential-query-type";
import {
  OpenShellManagementResult,
  OpenShellProviderProfile,
} from "../models/openshell-management";
import { AgentAccessSecretsService } from "../services/agent-access-secrets.service";

import { AgentAccessOpenShellAddCredentialDialogComponent } from "./agent-access-openshell-add-credential-dialog.component";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Planted so a leak anywhere (a request, a rendered page) is caught by a plain string search. */
const PLANTED_PASSWORD = "PLANTED-PASSWORD-hunter2";
const PLANTED_USERNAME = "PLANTED-USERNAME-alice";
const PLANTED_SECRET_VALUE = "PLANTED-SECRET-VALUE";

const multiRequired: OpenShellProviderProfile = {
  id: "aws",
  displayName: "AWS",
  description: "",
  credentials: [
    { name: "access_key", description: "", envVars: ["AWS_ACCESS_KEY_ID"], required: true },
    { name: "secret_key", description: "", envVars: ["AWS_SECRET_ACCESS_KEY"], required: true },
  ],
  endpoints: [{ host: "amazonaws.com", port: 443 }],
};

const second: OpenShellProviderProfile = {
  id: "gitlab",
  displayName: "GitLab",
  description: "",
  credentials: [{ name: "token", description: "", envVars: ["GITLAB_TOKEN"], required: true }],
  endpoints: [{ host: "gitlab.com", port: 443 }],
};

const profile: OpenShellProviderProfile = {
  id: "github",
  displayName: "GitHub",
  description: "Talk to the GitHub API",
  credentials: [
    {
      name: "api_token",
      description: "A personal access token",
      envVars: ["GITHUB_TOKEN", "GH_TOKEN"],
      required: true,
    },
    { name: "extra", description: "", envVars: ["GITHUB_EXTRA"], required: false },
  ],
  endpoints: [
    { host: "api.github.com", port: 443 },
    { host: "github.com", port: 443 },
  ],
};

const ok = <T>(data: T): OpenShellManagementResult<T> => ({ ok: true, data });

function login(
  n: number,
  name: string,
  opts: { username?: boolean; password?: boolean; deleted?: boolean; type?: number } = {},
) {
  return {
    id: uuid(n).toUpperCase(),
    name,
    type: opts.type ?? CipherType.Login,
    isDeleted: opts.deleted ?? false,
    isArchived: false,
    login: {
      username: opts.username === false ? undefined : PLANTED_USERNAME,
      password: opts.password === false ? undefined : PLANTED_PASSWORD,
    },
  };
}

describe("AgentAccessOpenShellAddCredentialDialogComponent (§M8.20)", () => {
  let agentAccessIpc: Record<string, jest.Mock>;
  let cipherService: ReturnType<typeof mock<CipherService>>;
  let secretsService: ReturnType<typeof mock<AgentAccessSecretsService>>;
  let dialogRef: ReturnType<typeof mock<DialogRef<boolean>>>;
  let originalIpc: unknown;

  beforeAll(() => {
    (global as any).IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    agentAccessIpc = {
      listOpenShellProfiles: jest.fn().mockResolvedValue(ok([profile])),
      addOpenShellCredential: jest.fn().mockResolvedValue(ok(undefined)),
    };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: agentAccessIpc };

    cipherService = mock<CipherService>();
    cipherService.getAllDecrypted.mockResolvedValue([
      login(3, "Zeta both"),
      login(1, "GitHub"),
      login(2, "Only user", { password: false }),
      login(4, "Only pass", { username: false }),
      login(5, "Neither", { username: false, password: false }),
      login(6, "Trashed", { deleted: true }),
      login(7, "A note", { type: CipherType.SecureNote }),
    ] as any);

    secretsService = mock<AgentAccessSecretsService>();
    secretsService.findSecrets.mockResolvedValue([
      { secretId: uuid(100).toUpperCase(), name: "Deploy key", organizationId: "org" },
    ]);
    dialogRef = mock<DialogRef<boolean>>();
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    TestBed.resetTestingModule();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function settle(fixture: ComponentFixture<unknown>) {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
    fixture.detectChanges();
  }

  async function render(): Promise<
    ComponentFixture<AgentAccessOpenShellAddCredentialDialogComponent>
  > {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string, ...args: (string | number)[]) =>
      [key, ...args].join("|"),
    );
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellAddCredentialDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: DIALOG_DATA, useValue: { sandboxName: "sb1" } },
        { provide: DialogRef, useValue: dialogRef },
        { provide: CipherService, useValue: cipherService },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: AgentAccessSecretsService, useValue: secretsService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ValidationService, useValue: mock<ValidationService>() },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellAddCredentialDialogComponent);
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  }

  const comp = (f: ComponentFixture<AgentAccessOpenShellAddCredentialDialogComponent>) =>
    f.componentInstance as any;
  const q = (fixture: ComponentFixture<unknown>, selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector);
  const qa = (fixture: ComponentFixture<unknown>, selector: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector));

  const optionByName = (fixture: ComponentFixture<any>, name: string) =>
    comp(fixture)
      .results()
      .find((o: any) => o.name === name);

  async function addByName(fixture: ComponentFixture<any>, name: string) {
    comp(fixture).add(optionByName(fixture, name));
    await settle(fixture);
  }

  /** A row is added with no permission; most tests want one already chosen. */
  async function addWithPermission(
    fixture: ComponentFixture<any>,
    name: string,
    profileId = "github",
  ) {
    await addByName(fixture, name);
    const rows = comp(fixture).chosen();
    comp(fixture).setProfile(rows[rows.length - 1], profileId);
    await settle(fixture);
  }

  const submit = async (fixture: ComponentFixture<any>) => {
    await comp(fixture).submit();
    await settle(fixture);
  };

  describe("profiles", () => {
    it("loads the profiles once and offers the ones a single secret can fill", async () => {
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue(ok([profile, multiRequired, second]));
      const fixture = await render();
      expect(agentAccessIpc.listOpenShellProfiles).toHaveBeenCalledTimes(1);
      expect(
        comp(fixture)
          .eligibleProfiles()
          .map((p: any) => p.id),
      ).toEqual(["github", "gitlab"]);
    });

    it("warns when no profile can take a single secret", async () => {
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue(ok([multiRequired]));
      const fixture = await render();
      expect(q(fixture, '[data-testid="openshell-add-no-profiles"]')).not.toBeNull();
      expect(q(fixture, "#agent-access-openshell-add-credential-dialog_input_search")).toBeNull();
    });

    it("shows a failure and retries", async () => {
      agentAccessIpc.listOpenShellProfiles.mockResolvedValueOnce({
        ok: false,
        error: "gatewayUnreachable",
        message: "connection <i>refused</i>",
      });
      const fixture = await render();
      const callout = q(fixture, '[data-testid="openshell-add-profiles-error"]');
      expect(callout?.textContent).toContain("agentAccessOsCredErrorGatewayUnreachable");
      expect(callout?.textContent).toContain("connection <i>refused</i>");
      expect(callout?.querySelector("i")).toBeNull();

      (
        q(fixture, "#agent-access-openshell-add-credential-dialog_button_retry") as HTMLElement
      ).click();
      await settle(fixture);

      expect(agentAccessIpc.listOpenShellProfiles).toHaveBeenCalledTimes(2);
      expect(q(fixture, '[data-testid="openshell-add-profiles-error"]')).toBeNull();
      expect(comp(fixture).eligibleProfiles()).toHaveLength(1);
    });
  });

  describe("finding secrets", () => {
    it("lists logins that have a username or password, sorted, and secrets by name", async () => {
      const fixture = await render();
      const names = comp(fixture)
        .results()
        .map((o: any) => o.name);
      expect(names).toEqual(["GitHub", "Only pass", "Only user", "Zeta both", "Deploy key"]);
      expect(qa(fixture, '[data-testid="openshell-add-source-option"]')).toHaveLength(5);
    });

    it("filters logins by the search text and asks Secrets Manager after a pause", async () => {
      jest.useFakeTimers();
      const fixture = await render();
      secretsService.findSecrets.mockClear();

      comp(fixture).setQuery("git");
      comp(fixture).setQuery("gith");
      expect(secretsService.findSecrets).not.toHaveBeenCalled();
      jest.advanceTimersByTime(300);
      await settle(fixture);

      expect(secretsService.findSecrets).toHaveBeenCalledTimes(1);
      expect(secretsService.findSecrets).toHaveBeenCalledWith(
        CredentialQueryType.Search,
        "gith",
        "user-1",
      );
      expect(
        comp(fixture)
          .results()
          .filter((o: any) => o.resourceType === "item")
          .map((o: any) => o.name),
      ).toEqual(["GitHub"]);
    });

    it("says so when nothing matches", async () => {
      secretsService.findSecrets.mockResolvedValue([]);
      const fixture = await render();
      comp(fixture).query.set("zzzz");
      await settle(fixture);
      expect(q(fixture, '[data-testid="openshell-add-no-match"]')).not.toBeNull();
    });

    it("removes a chosen secret from the results and brings it back when removed", async () => {
      const fixture = await render();
      await addByName(fixture, "GitHub");
      expect(optionByName(fixture, "GitHub")).toBeUndefined();

      comp(fixture).remove(comp(fixture).chosen()[0]);
      await settle(fixture);
      expect(optionByName(fixture, "GitHub")).toBeDefined();
    });
  });

  describe("adding a row", () => {
    it("defaults a login to its password and starts with no permission and no env var", async () => {
      const fixture = await render();
      await addByName(fixture, "GitHub");

      const row = comp(fixture).chosen()[0];
      expect(row.field()).toBe("password");
      expect(row.profileId()).toBeNull();
      expect(row.envVar()).toBe("");
      expect(qa(fixture, '[data-testid="openshell-add-credential-row"]')).toHaveLength(1);
      const select = q(
        fixture,
        "#agent-access-openshell-add-credential-dialog_select_permission-0",
      ) as HTMLSelectElement;
      expect(select.options[0].value).toBe("");
      expect(select.options[0].textContent).toContain("agentAccessOsCredChoosePermission");
      expect(select.selectedIndex).toBe(0);
    });

    it("fills the permission's env var and hosts once a permission is chosen", async () => {
      const fixture = await render();
      await addByName(fixture, "GitHub");
      const row = comp(fixture).chosen()[0];

      comp(fixture).setProfile(row, "github");
      await settle(fixture);

      expect(row.profileId()).toBe("github");
      expect(row.envVar()).toBe("GITHUB_TOKEN");
      expect(q(fixture, '[data-testid="openshell-add-endpoints"]')?.textContent?.trim()).toBe(
        "api.github.com:443, github.com:443",
      );
    });

    it("does not preselect a permission even when only one exists, and blocks saving until one is chosen", async () => {
      const fixture = await render();
      await addByName(fixture, "GitHub");

      await submit(fixture);

      expect(comp(fixture).chosen()[0].profileId()).toBeNull();
      expect(agentAccessIpc.addOpenShellCredential).not.toHaveBeenCalled();
      expect(q(fixture, '[data-testid="openshell-add-issues"]')?.textContent).toContain(
        "agentAccessOsCredIssueNoPermission",
      );
    });

    it("defaults a login without a password to its username, and a secret to its value", async () => {
      const fixture = await render();
      await addByName(fixture, "Only user");
      await addByName(fixture, "Deploy key");

      const [user, deploy] = comp(fixture).chosen();
      expect(user.field()).toBe("username");
      expect(deploy.field()).toBe("value");
      expect(deploy.option.resourceType).toBe("secret");
    });

    it("lets the user choose another part only from what the secret has", async () => {
      const fixture = await render();
      await addByName(fixture, "Zeta both");
      const row = comp(fixture).chosen()[0];

      comp(fixture).setField(row, "username");
      expect(row.field()).toBe("username");
      comp(fixture).setField(row, "value");
      expect(row.field()).toBe("username");
    });

    it("follows the permission's env var until the user edits it", async () => {
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue(ok([profile, second]));
      const fixture = await render();
      await addByName(fixture, "GitHub");
      await addByName(fixture, "Zeta both");
      const [untouched, edited] = comp(fixture).chosen();

      comp(fixture).setProfile(untouched, "gitlab");
      expect(untouched.envVar()).toBe("GITLAB_TOKEN");

      comp(fixture).setEnvVar(edited, "MY_TOKEN");
      comp(fixture).setProfile(edited, "gitlab");
      expect(edited.envVar()).toBe("MY_TOKEN");
    });
  });

  describe("checks before saving", () => {
    it("blocks an invalid env var with no ipc call", async () => {
      const fixture = await render();
      await addWithPermission(fixture, "GitHub");
      comp(fixture).setEnvVar(comp(fixture).chosen()[0], "not valid");
      await settle(fixture);

      await submit(fixture);

      expect(agentAccessIpc.addOpenShellCredential).not.toHaveBeenCalled();
      expect(q(fixture, '[data-testid="openshell-add-issues"]')?.textContent).toContain(
        "agentAccessOsCredIssueEnvVar",
      );
      expect(q(fixture, '[data-testid="openshell-add-summary"]')).toBeNull();
    });

    it("blocks two secrets that would use the same env var", async () => {
      const fixture = await render();
      await addWithPermission(fixture, "GitHub");
      await addWithPermission(fixture, "Zeta both");

      await submit(fixture);

      expect(agentAccessIpc.addOpenShellCredential).not.toHaveBeenCalled();
      expect(q(fixture, '[data-testid="openshell-add-issues"]')?.textContent).toContain(
        "agentAccessOsCredIssueDuplicateEnvVar",
      );
    });

    it("blocks a secret with no permission", async () => {
      const fixture = await render();
      await addByName(fixture, "GitHub");
      comp(fixture).setProfile(comp(fixture).chosen()[0], "");

      await submit(fixture);

      expect(agentAccessIpc.addOpenShellCredential).not.toHaveBeenCalled();
      expect(q(fixture, '[data-testid="openshell-add-issues"]')?.textContent).toContain(
        "agentAccessOsCredIssueNoPermission",
      );
    });

    it("does nothing when nothing is chosen", async () => {
      const fixture = await render();
      await submit(fixture);
      expect(agentAccessIpc.addOpenShellCredential).not.toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe("summary", () => {
    it("says what each secret becomes and where it can go", async () => {
      const fixture = await render();
      await addWithPermission(fixture, "GitHub");

      const text = q(fixture, '[data-testid="openshell-add-summary"]')?.textContent ?? "";
      expect(text).toContain("agentAccessOsCredSummary|GitHub|sb1|GITHUB_TOKEN");
      expect(text).toContain(
        "agentAccessOsCredSummaryEndpoints|api.github.com:443, github.com:443",
      );
    });
  });

  describe("saving", () => {
    it("adds one provider per secret with ids and labels only, then closes with true", async () => {
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue(ok([profile, second]));
      const fixture = await render();
      await addWithPermission(fixture, "GitHub");
      await addWithPermission(fixture, "Deploy key");
      const [, deploy] = comp(fixture).chosen();
      comp(fixture).setProfile(deploy, "gitlab");

      await submit(fixture);

      expect(agentAccessIpc.addOpenShellCredential).toHaveBeenCalledTimes(2);
      expect(agentAccessIpc.addOpenShellCredential).toHaveBeenNthCalledWith(1, {
        sandboxName: "sb1",
        profileId: "github",
        bindings: [
          {
            envVar: "GITHUB_TOKEN",
            resourceType: "item",
            id: uuid(1),
            field: "password",
            label: "GitHub",
          },
        ],
      });
      expect(agentAccessIpc.addOpenShellCredential).toHaveBeenNthCalledWith(2, {
        sandboxName: "sb1",
        profileId: "gitlab",
        bindings: [
          {
            envVar: "GITLAB_TOKEN",
            resourceType: "secret",
            id: uuid(100),
            field: "value",
            label: "Deploy key",
          },
        ],
      });
      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it("retries with a -2 suffix when the provider name is taken", async () => {
      agentAccessIpc.addOpenShellCredential
        .mockResolvedValueOnce({ ok: false, error: "alreadyExists" })
        .mockResolvedValueOnce(ok(undefined));
      const fixture = await render();
      await addWithPermission(fixture, "GitHub");

      await submit(fixture);

      expect(agentAccessIpc.addOpenShellCredential).toHaveBeenCalledTimes(2);
      expect(agentAccessIpc.addOpenShellCredential.mock.calls[0][0].providerName).toBeUndefined();
      expect(agentAccessIpc.addOpenShellCredential.mock.calls[1][0].providerName).toBe(
        "github-sb1-2",
      );
      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it("gives up after a few taken names", async () => {
      agentAccessIpc.addOpenShellCredential.mockResolvedValue({
        ok: false,
        error: "alreadyExists",
      });
      const fixture = await render();
      await addWithPermission(fixture, "GitHub");

      await submit(fixture);

      expect(agentAccessIpc.addOpenShellCredential).toHaveBeenCalledTimes(5);
      expect(q(fixture, '[data-testid="openshell-add-error"]')).not.toBeNull();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("stops at the first failure, shows it and keeps only what was not added", async () => {
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue(ok([profile, second]));
      agentAccessIpc.addOpenShellCredential
        .mockResolvedValueOnce(ok(undefined))
        .mockResolvedValueOnce({ ok: false, error: "failed", message: "gateway said <b>no</b>" });
      const fixture = await render();
      await addWithPermission(fixture, "GitHub");
      await addWithPermission(fixture, "Zeta both");
      await addWithPermission(fixture, "Only pass");
      comp(fixture).setProfile(comp(fixture).chosen()[1], "gitlab");
      comp(fixture).setEnvVar(comp(fixture).chosen()[2], "OTHER_TOKEN");

      await submit(fixture);

      expect(agentAccessIpc.addOpenShellCredential).toHaveBeenCalledTimes(2);
      expect(
        comp(fixture)
          .chosen()
          .map((r: any) => r.option.name),
      ).toEqual(["Zeta both", "Only pass"]);
      const error = q(fixture, '[data-testid="openshell-add-error"]');
      expect(error?.textContent).toContain("agentAccessOsCredErrorFailed");
      expect(error?.textContent).toContain("gateway said <b>no</b>");
      expect(error?.querySelector("b")).toBeNull();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("close() reports whether anything was added", async () => {
      agentAccessIpc.addOpenShellCredential
        .mockResolvedValueOnce(ok(undefined))
        .mockResolvedValueOnce({ ok: false, error: "failed" });
      const fixture = await render();
      comp(fixture).close();
      expect(dialogRef.close).toHaveBeenLastCalledWith(false);

      await addWithPermission(fixture, "GitHub");
      await addWithPermission(fixture, "Only pass");
      comp(fixture).setEnvVar(comp(fixture).chosen()[1], "OTHER_TOKEN");
      await submit(fixture);

      comp(fixture).close();
      expect(dialogRef.close).toHaveBeenLastCalledWith(true);
    });

    it("never reads a password, username or secret value", async () => {
      const fixture = await render();
      await addWithPermission(fixture, "GitHub");
      await submit(fixture);

      const sent = JSON.stringify(agentAccessIpc.addOpenShellCredential.mock.calls);
      const page = (fixture.nativeElement as HTMLElement).textContent ?? "";
      for (const planted of [PLANTED_PASSWORD, PLANTED_USERNAME, PLANTED_SECRET_VALUE]) {
        expect(sent).not.toContain(planted);
        expect(page).not.toContain(planted);
      }
    });
  });

  describe("add a set (§M8.20 rule 17)", () => {
    const setId = "3e9c8041-6f5d-4aa1-8c43-dd44ee55ff66";
    const githubRef = {
      resourceType: "item",
      id: uuid(1),
      field: "password",
      label: "GitHub",
      profileId: "github",
      envVar: "GITHUB_TOKEN",
    };
    const deployRef = {
      resourceType: "secret",
      id: uuid(100),
      field: "value",
      label: "Deploy key",
      profileId: "gitlab",
      envVar: "GITLAB_TOKEN",
    };
    const sets = [{ id: setId, name: "Work", secrets: [githubRef, deployRef] }];

    const picker = (fixture: ComponentFixture<unknown>) =>
      q(fixture, '[data-testid="openshell-add-set-picker"]');
    const chooseSet = async (fixture: ComponentFixture<any>, id: string) => {
      const select = q(fixture, "#agent-access-openshell-add-credential-dialog_select_set") as any;
      select.value = id;
      select.dispatchEvent(new Event("change"));
      await settle(fixture);
    };

    it("shows no picker when there are no sets or they cannot be read", async () => {
      const unreadable = await render();
      expect(picker(unreadable)).toBeNull();

      TestBed.resetTestingModule();
      agentAccessIpc.listOpenShellSecretSets = jest.fn().mockResolvedValue(ok([]));
      const empty = await render();
      expect(picker(empty)).toBeNull();

      TestBed.resetTestingModule();
      agentAccessIpc.listOpenShellSecretSets = jest
        .fn()
        .mockResolvedValue({ ok: false, error: "unsupported" });
      const failed = await render();
      expect(picker(failed)).toBeNull();
    });

    it("adds every secret of the set as a row, ready to save but still editable", async () => {
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue(ok([profile, second]));
      agentAccessIpc.listOpenShellSecretSets = jest.fn().mockResolvedValue(ok(sets));
      const fixture = await render();
      expect(picker(fixture)).not.toBeNull();
      expect(
        q(fixture, "#agent-access-openshell-add-credential-dialog_button_add-set")?.getAttribute(
          "aria-disabled",
        ),
      ).toBe("true");

      await chooseSet(fixture, setId);
      comp(fixture).addSet();
      await settle(fixture);

      const rows = comp(fixture).chosen();
      expect(rows).toHaveLength(2);
      expect(rows[0].option).toMatchObject({
        resourceType: "item",
        id: uuid(1),
        name: "GitHub",
        fields: ["username", "password"],
      });
      expect(rows[0].field()).toBe("password");
      expect(rows[0].profileId()).toBe("github");
      expect(rows[0].envVar()).toBe("GITHUB_TOKEN");
      expect(rows[1].option.fields).toEqual(["value"]);
      expect(rows[1].profileId()).toBe("gitlab");

      comp(fixture).setEnvVar(rows[0], "MY_TOKEN");
      comp(fixture).setField(rows[0], "username");
      expect(rows[0].envVar()).toBe("MY_TOKEN");
      expect(rows[0].field()).toBe("username");
      expect(comp(fixture).selectedSetId()).toBe("");
    });

    it("leaves the permission unset when its profile no longer exists", async () => {
      agentAccessIpc.listOpenShellSecretSets = jest.fn().mockResolvedValue(ok(sets));
      const fixture = await render();
      await chooseSet(fixture, setId);
      comp(fixture).addSet();
      await settle(fixture);

      const rows = comp(fixture).chosen();
      expect(rows[0].profileId()).toBe("github");
      expect(rows[1].profileId()).toBeNull();
      expect(
        comp(fixture)
          .issues()
          .map((i: any) => i.key),
      ).toContain("agentAccessOsCredIssueNoPermission");
    });

    it("does not add a secret that is already chosen, nor the set twice", async () => {
      agentAccessIpc.listOpenShellSecretSets = jest.fn().mockResolvedValue(ok(sets));
      const fixture = await render();
      await addWithPermission(fixture, "GitHub");
      await chooseSet(fixture, setId);
      comp(fixture).addSet();
      await settle(fixture);
      expect(comp(fixture).chosen()).toHaveLength(2);

      await chooseSet(fixture, setId);
      comp(fixture).addSet();
      await settle(fixture);
      expect(comp(fixture).chosen()).toHaveLength(2);
    });

    it("flags an env var clash with a row that is already there", async () => {
      agentAccessIpc.listOpenShellSecretSets = jest.fn().mockResolvedValue(ok(sets));
      const fixture = await render();
      await addWithPermission(fixture, "Zeta both");
      comp(fixture).setEnvVar(comp(fixture).chosen()[0], "GITHUB_TOKEN");
      await chooseSet(fixture, setId);
      comp(fixture).addSet();
      await settle(fixture);
      expect(
        comp(fixture)
          .issues()
          .map((i: any) => i.key),
      ).toContain("agentAccessOsCredIssueDuplicateEnvVar");
    });

    it("does nothing without a chosen set", async () => {
      agentAccessIpc.listOpenShellSecretSets = jest.fn().mockResolvedValue(ok(sets));
      const fixture = await render();
      comp(fixture).addSet();
      expect(comp(fixture).chosen()).toHaveLength(0);
    });

    it("saves the set's rows with ids, fields and labels only, one provider each", async () => {
      agentAccessIpc.listOpenShellProfiles.mockResolvedValue(ok([profile, second]));
      agentAccessIpc.listOpenShellSecretSets = jest.fn().mockResolvedValue(ok(sets));
      const fixture = await render();
      await chooseSet(fixture, setId);
      comp(fixture).addSet();
      await settle(fixture);
      await submit(fixture);

      expect(agentAccessIpc.addOpenShellCredential).toHaveBeenCalledTimes(2);
      expect(agentAccessIpc.addOpenShellCredential.mock.calls[0][0]).toEqual({
        sandboxName: "sb1",
        profileId: "github",
        bindings: [
          {
            envVar: "GITHUB_TOKEN",
            resourceType: "item",
            id: uuid(1),
            field: "password",
            label: "GitHub",
          },
        ],
      });
      expect(agentAccessIpc.addOpenShellCredential.mock.calls[1][0].profileId).toBe("gitlab");
      expect(JSON.stringify(agentAccessIpc.addOpenShellCredential.mock.calls)).not.toContain(
        PLANTED_PASSWORD,
      );
    });
  });
});
