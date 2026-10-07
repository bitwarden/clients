import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import { AgentAccessOpenShellCreateSandboxDialogComponent } from "./agent-access-openshell-create-sandbox-dialog.component";

describe("AgentAccessOpenShellCreateSandboxDialogComponent (§M8.20)", () => {
  let createSandbox: jest.Mock;
  let dialogRef: { close: jest.Mock };
  let originalIpc: unknown;

  beforeAll(() => {
    (global as any).IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    createSandbox = jest.fn().mockResolvedValue({ ok: true, data: { name: "made" } });
    dialogRef = { close: jest.fn() };
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: { createOpenShellSandbox: createSandbox } };
  });

  const SECRET_A = "1c7a6e2f-4d3b-4e8f-8a21-bb22cc33dd44";
  const SECRET_B = "2d8b7f30-5e4c-4f90-9b32-cc33dd44ee55";
  const refA = {
    resourceType: "secret",
    id: SECRET_A,
    field: "value",
    label: "GitHub",
    profileId: "github",
    envVar: "GH_TOKEN",
  };
  const refB = {
    ...refA,
    id: SECRET_B,
    label: "OpenAI",
    profileId: "openai",
    envVar: "OPENAI_KEY",
  };
  const environment = (overrides: Record<string, unknown> = {}) => ({
    id: "0b6f5d1e-3c2a-4d7e-9f10-aa11bb22cc33",
    name: "Dev",
    description: "",
    from: "ghcr.io/acme/base:1",
    cpu: "2",
    memory: "4Gi",
    secretSetId: "3e9c8041-6f5d-4aa1-8c43-dd44ee55ff66",
    ...overrides,
  });
  const set = { id: "3e9c8041-6f5d-4aa1-8c43-dd44ee55ff66", name: "Work", secrets: [refA, refB] };

  /** Wires the environment and credential IPC the dialog uses on top of createSandbox. */
  function withEnvironments(environments: unknown[], sets: unknown[] = [set]): { add: jest.Mock } {
    const add = jest.fn().mockResolvedValue({ ok: true, data: undefined });
    (global as any).ipc = {
      agentAccess: {
        createOpenShellSandbox: createSandbox,
        listOpenShellEnvironments: jest.fn().mockResolvedValue({ ok: true, data: environments }),
        listOpenShellSecretSets: jest.fn().mockResolvedValue({ ok: true, data: sets }),
        addOpenShellCredential: add,
      },
    };
    return { add };
  }

  afterEach(() => {
    (global as any).ipc = originalIpc;
    TestBed.resetTestingModule();
  });

  async function render(
    extraIpc: Record<string, jest.Mock> = {},
  ): Promise<ComponentFixture<AgentAccessOpenShellCreateSandboxDialogComponent>> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellCreateSandboxDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: DialogRef, useValue: dialogRef },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellCreateSandboxDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  const form = (fixture: ComponentFixture<unknown>) =>
    (fixture.componentInstance as any).createForm;
  const submit = async (fixture: ComponentFixture<unknown>) => {
    await (fixture.componentInstance as any).submit();
    fixture.detectChanges();
  };
  const q = (fixture: ComponentFixture<unknown>, selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);

  it("opens through the dialog service", () => {
    const dialogService = mock<DialogService>();
    AgentAccessOpenShellCreateSandboxDialogComponent.open(dialogService);
    expect(dialogService.open).toHaveBeenCalledWith(
      AgentAccessOpenShellCreateSandboxDialogComponent,
    );
  });

  it("creates with the gateway's defaults from an empty form, and closes with the name", async () => {
    const fixture = await render();

    await submit(fixture);

    expect(createSandbox).toHaveBeenCalledWith({});
    expect(dialogRef.close).toHaveBeenCalledWith("made");
  });

  it("offers no providers picker", async () => {
    const fixture = await render();
    const form = fixture.nativeElement as HTMLElement;
    expect(form.querySelector("[formControlName='providerNames']")).toBeNull();
    expect(Object.keys((fixture.componentInstance as any).createForm.controls)).toEqual([
      "environment",
      "name",
      "source",
      "sourceValue",
      "cpu",
      "memory",
    ]);
  });

  it("sends a container image as `from` with trimmed name, cpu and memory", async () => {
    const fixture = await render();
    form(fixture).patchValue({
      name: " build-box ",
      source: "image",
      sourceValue:
        "ghcr.io/acme/img@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      cpu: "500m",
      memory: "4Gi",
    });

    await submit(fixture);

    expect(createSandbox).toHaveBeenCalledWith({
      name: "build-box",
      from: "ghcr.io/acme/img@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      cpu: "500m",
      memory: "4Gi",
    });
  });

  it("sends a template as `template`, never together with `from`", async () => {
    const fixture = await render();
    form(fixture).patchValue({ source: "template", sourceValue: "python-dev", cpu: "2" });

    await submit(fixture);

    expect(createSandbox).toHaveBeenCalledWith({ template: "python-dev", cpu: "2" });
  });

  it("drops a stale source value when the default source is chosen", async () => {
    const fixture = await render();
    form(fixture).patchValue({ source: "image", sourceValue: "some/image" });
    form(fixture).patchValue({ source: "default" });

    await submit(fixture);

    expect(createSandbox).toHaveBeenCalledWith({});
  });

  describe("validation", () => {
    it.each([
      ["name", "-flag"],
      ["name", "has space"],
      ["cpu", "two"],
      ["cpu", "-1"],
      ["memory", "4 Gi"],
      ["memory", "4GB"],
    ])("rejects %s %j without calling the gateway", async (control, value) => {
      const fixture = await render();
      form(fixture).patchValue({ [control]: value });

      await submit(fixture);

      expect(form(fixture).controls[control].errors?.openShellValue?.message).toBeTruthy();
      expect(createSandbox).not.toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it.each([
      ["500m", "cpu"],
      ["2", "cpu"],
      ["0.5", "cpu"],
      ["512Mi", "memory"],
      ["4Gi", "memory"],
    ])("accepts %s as %s", async (value, control) => {
      const fixture = await render();
      form(fixture).patchValue({ [control]: value });
      expect(form(fixture).controls[control].valid).toBe(true);
    });

    it.each([
      ["image", "-evil"],
      ["image", "has space"],
      ["image", ""],
      ["template", "../escape"],
      ["template", ""],
    ])("rejects a %s source of %j", async (source, value) => {
      const fixture = await render();
      form(fixture).patchValue({ source, sourceValue: value });

      await submit(fixture);

      expect(form(fixture).controls.sourceValue.invalid).toBe(true);
      expect(createSandbox).not.toHaveBeenCalled();
    });

    it("opens Advanced when the problem is hidden inside it", async () => {
      const fixture = await render();
      form(fixture).patchValue({ memory: "lots" });

      await submit(fixture);

      expect((fixture.componentInstance as any).advancedOpen()).toBe(true);
    });
  });

  describe("failure", () => {
    it("shows the scrubbed message and stays open", async () => {
      createSandbox.mockResolvedValue({ ok: false, error: "failed", message: "scrubbed reason" });
      const fixture = await render();

      await submit(fixture);

      expect(q(fixture, '[data-testid="agent-access-os-create-error"]')?.textContent).toContain(
        "scrubbed reason",
      );
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("explains a name collision when no message came back", async () => {
      createSandbox.mockResolvedValue({ ok: false, error: "alreadyExists" });
      const fixture = await render();

      await submit(fixture);

      expect(q(fixture, '[data-testid="agent-access-os-create-error"]')?.textContent).toContain(
        "agentAccessOsCreateErrorExists",
      );
    });
  });

  describe("start from an environment (§M8.20 rule 17)", () => {
    const select = (fixture: ComponentFixture<unknown>) =>
      q(fixture, "#agent-access-openshell-create-sandbox-dialog_select_environment");

    it("shows no environment choice when there are none or they can't be read", async () => {
      const none = await render();
      expect(select(none)).toBeNull();
      TestBed.resetTestingModule();

      withEnvironments([]);
      const empty = await render();
      expect(select(empty)).toBeNull();
    });

    it("offers the choice first, defaulting to none, when environments exist", async () => {
      withEnvironments([environment()]);
      const fixture = await render();
      fixture.detectChanges();
      expect(select(fixture)).not.toBeNull();
      expect(form(fixture).controls.environment.value).toBe("");
    });

    it("prefills image and resources from the chosen environment and sends them", async () => {
      const { add } = withEnvironments([environment({ secretSetId: undefined })]);
      const fixture = await render();

      form(fixture).patchValue({ environment: environment().id });
      expect(form(fixture).getRawValue()).toMatchObject({
        source: "image",
        sourceValue: "ghcr.io/acme/base:1",
        cpu: "2",
        memory: "4Gi",
      });
      expect((fixture.componentInstance as any).advancedOpen()).toBe(true);

      await submit(fixture);

      expect(createSandbox).toHaveBeenCalledWith({
        from: "ghcr.io/acme/base:1",
        cpu: "2",
        memory: "4Gi",
      });
      expect(add).not.toHaveBeenCalled();
      expect(dialogRef.close).toHaveBeenCalledWith("made");
    });

    it("prefills a template and lets the user change what was filled in", async () => {
      withEnvironments([
        environment({ from: undefined, template: "python-dev", secretSetId: undefined }),
      ]);
      const fixture = await render();
      form(fixture).patchValue({ environment: environment().id });
      expect(form(fixture).getRawValue()).toMatchObject({
        source: "template",
        sourceValue: "python-dev",
      });
      form(fixture).patchValue({ cpu: "4" });

      await submit(fixture);

      expect(createSandbox).toHaveBeenCalledWith({
        template: "python-dev",
        cpu: "4",
        memory: "4Gi",
      });
    });

    it("adds the set's secrets one by one after creation, then closes with the name", async () => {
      const { add } = withEnvironments([environment()]);
      const fixture = await render();
      form(fixture).patchValue({ environment: environment().id });

      await submit(fixture);

      expect(add).toHaveBeenCalledTimes(2);
      expect(add.mock.calls[0][0]).toEqual({
        sandboxName: "made",
        profileId: "github",
        bindings: [
          {
            envVar: "GH_TOKEN",
            resourceType: "secret",
            id: SECRET_A,
            field: "value",
            label: "GitHub",
          },
        ],
      });
      expect(add.mock.calls[1][0].profileId).toBe("openai");
      expect(createSandbox.mock.invocationCallOrder[0]).toBeLessThan(
        add.mock.invocationCallOrder[0],
      );
      expect(dialogRef.close).toHaveBeenCalledWith("made");
      expect((fixture.componentInstance as any).partial()).toBeNull();
    });

    it("adds an environment's inline secrets too", async () => {
      const { add } = withEnvironments([environment({ secretSetId: undefined, secrets: [refB] })]);
      const fixture = await render();
      form(fixture).patchValue({ environment: environment().id });

      await submit(fixture);

      expect(add).toHaveBeenCalledTimes(1);
      expect(add.mock.calls[0][0].profileId).toBe("openai");
    });

    it("reports partial failures plainly, keeps going, and stays open until the user continues", async () => {
      const { add } = withEnvironments([environment()]);
      add.mockResolvedValueOnce({ ok: false, error: "failed", message: "scrubbed reason" });
      const fixture = await render();
      form(fixture).patchValue({ environment: environment().id });

      await submit(fixture);

      expect(add).toHaveBeenCalledTimes(2);
      expect(dialogRef.close).not.toHaveBeenCalled();
      const failures = (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-testid="agent-access-os-create-partial-failure"]',
      );
      expect(failures).toHaveLength(1);
      expect(failures[0].textContent).toContain("GitHub");
      expect(failures[0].textContent).toContain("scrubbed reason");
      expect(failures[0].textContent).not.toContain("OpenAI");

      q(fixture, "#agent-access-openshell-create-sandbox-dialog_button_open-created")!.click();
      expect(dialogRef.close).toHaveBeenCalledWith("made");
    });

    it("treats a deleted set as a plain failure, after the sandbox exists", async () => {
      const { add } = withEnvironments([environment()], []);
      const fixture = await render();
      form(fixture).patchValue({ environment: environment().id });

      await submit(fixture);

      expect(createSandbox).toHaveBeenCalledTimes(1);
      expect(add).not.toHaveBeenCalled();
      expect((fixture.componentInstance as any).partial()).toMatchObject({
        name: "made",
        failures: [{ error: "notFound" }],
      });
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("adds nothing and shows the error when the sandbox itself could not be created", async () => {
      const { add } = withEnvironments([environment()]);
      createSandbox.mockResolvedValue({ ok: false, error: "failed", message: "nope" });
      const fixture = await render();
      form(fixture).patchValue({ environment: environment().id });

      await submit(fixture);

      expect(add).not.toHaveBeenCalled();
      expect(q(fixture, '[data-testid="agent-access-os-create-error"]')?.textContent).toContain(
        "nope",
      );
    });
  });
});
