import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";

import { OpenShellEnvironment, OpenShellSecretRef } from "../models/openshell-environments";

import {
  AgentAccessOpenShellEnvironmentDialogComponent,
  AgentAccessOpenShellEnvironmentDialogParams,
  ENV_SECRETS_INLINE,
  ENV_SECRETS_NONE,
} from "./agent-access-openshell-environment-dialog.component";

const SET_ID = "3e9c8041-6f5d-4aa1-8c43-dd44ee55ff66";
const ENV_ID = "0b6f5d1e-3c2a-4d7e-9f10-aa11bb22cc33";
const ref: OpenShellSecretRef = {
  resourceType: "secret",
  id: "1c7a6e2f-4d3b-4e8f-8a21-bb22cc33dd44",
  field: "value",
  label: "GitHub",
  profileId: "github",
  envVar: "GH_TOKEN",
};
const sets = [{ id: SET_ID, name: "Work", secrets: [ref] }];

describe("AgentAccessOpenShellEnvironmentDialogComponent (§M8.20 rule 17)", () => {
  let dialogRef: { close: jest.Mock };
  let save: jest.Mock;
  let originalIpc: unknown;

  beforeAll(() => {
    (global as any).IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    dialogRef = { close: jest.fn() };
    save = jest.fn(async (request: any) => ({ ok: true, data: { id: ENV_ID, ...request } }));
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: { saveOpenShellEnvironment: save } };
  });
  afterEach(() => {
    (global as any).ipc = originalIpc;
    TestBed.resetTestingModule();
  });

  async function render(
    params: Partial<AgentAccessOpenShellEnvironmentDialogParams> = {},
  ): Promise<ComponentFixture<unknown>> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellEnvironmentDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: { sets, ...params } },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellEnvironmentDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }
  const comp = (f: ComponentFixture<unknown>) => f.componentInstance as any;
  const submit = async (f: ComponentFixture<unknown>) => {
    await comp(f).submit();
    f.detectChanges();
  };
  const q = (f: ComponentFixture<unknown>, selector: string) =>
    (f.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);

  it("opens through the dialog service with its params", () => {
    const dialogService = mock<DialogService>();
    AgentAccessOpenShellEnvironmentDialogComponent.open(dialogService, { sets });
    expect(dialogService.open).toHaveBeenCalledWith(
      AgentAccessOpenShellEnvironmentDialogComponent,
      { data: { sets } },
    );
  });

  describe("new environment", () => {
    it("saves a minimal environment with only the name and an empty description", async () => {
      const fixture = await render();
      comp(fixture).form.patchValue({ name: "  Dev " });
      await submit(fixture);
      expect(save).toHaveBeenCalledWith({ name: "Dev", description: "" });
      expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ id: ENV_ID }));
    });

    it("sends image, resources and a chosen set, never an id", async () => {
      const fixture = await render();
      comp(fixture).form.patchValue({
        name: "Dev",
        description: " d ",
        source: "image",
        sourceValue: "ghcr.io/acme/base:1",
        cpu: "2",
        memory: "4Gi",
        secrets: SET_ID,
      });
      await submit(fixture);
      expect(save).toHaveBeenCalledWith({
        name: "Dev",
        description: "d",
        from: "ghcr.io/acme/base:1",
        cpu: "2",
        memory: "4Gi",
        secretSetId: SET_ID,
      });
    });

    it("sends a template as `template`", async () => {
      const fixture = await render();
      comp(fixture).form.patchValue({ name: "Dev", source: "template", sourceValue: "py" });
      await submit(fixture);
      expect(save).toHaveBeenCalledWith({ name: "Dev", description: "", template: "py" });
    });

    it.each([
      ["a missing name", { name: " " }],
      ["a flag-like image", { name: "x", source: "image", sourceValue: "--rm" }],
      ["an archive image", { name: "x", source: "image", sourceValue: "a/b.tar" }],
      ["a missing image", { name: "x", source: "image", sourceValue: "" }],
      ["a bad cpu", { name: "x", cpu: "lots" }],
      ["a bad memory", { name: "x", memory: "1 GB" }],
    ])("does not save %s", async (_name, value) => {
      const fixture = await render();
      comp(fixture).form.patchValue(value);
      await submit(fixture);
      expect(save).not.toHaveBeenCalled();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it("drops a stale source value when the default source is chosen", async () => {
      const fixture = await render();
      comp(fixture).form.patchValue({ name: "x", source: "image", sourceValue: "a/b" });
      comp(fixture).form.patchValue({ source: "default" });
      await submit(fixture);
      expect(save).toHaveBeenCalledWith({ name: "x", description: "" });
    });
  });

  describe("saving a sandbox as an environment", () => {
    it("starts with the sandbox's secrets and prefilled name, and sends them inline", async () => {
      const fixture = await render({
        inlineSecrets: [ref],
        skippedSecrets: 2,
        prefill: { name: "box", description: "CI runner" },
      });
      expect(comp(fixture).form.controls.secrets.value).toBe(ENV_SECRETS_INLINE);
      expect(comp(fixture).form.controls.name.value).toBe("box");
      expect(q(fixture, '[data-testid="agent-access-os-env-skipped"]')).not.toBeNull();

      await submit(fixture);
      expect(save).toHaveBeenCalledWith({ name: "box", description: "CI runner", secrets: [ref] });
    });

    it("can use a saved set or nothing instead", async () => {
      const fixture = await render({ inlineSecrets: [ref] });
      comp(fixture).form.patchValue({ name: "a", secrets: ENV_SECRETS_NONE });
      await submit(fixture);
      expect(save).toHaveBeenLastCalledWith({ name: "a", description: "" });
    });

    it("hides the skipped note when nothing was skipped", async () => {
      const fixture = await render({ inlineSecrets: [ref] });
      expect(q(fixture, '[data-testid="agent-access-os-env-skipped"]')).toBeNull();
    });
  });

  describe("editing", () => {
    const existing: OpenShellEnvironment = {
      id: ENV_ID,
      name: "Dev",
      description: "d",
      template: "py",
      cpu: "2",
      secretSetId: SET_ID,
    };

    it("loads the environment and saves with its id", async () => {
      const fixture = await render({ environment: existing });
      expect(comp(fixture).form.getRawValue()).toMatchObject({
        name: "Dev",
        source: "template",
        sourceValue: "py",
        cpu: "2",
        secrets: SET_ID,
      });
      comp(fixture).form.patchValue({ name: "Dev2" });
      await submit(fixture);
      expect(save).toHaveBeenCalledWith({
        id: ENV_ID,
        name: "Dev2",
        description: "d",
        template: "py",
        cpu: "2",
        secretSetId: SET_ID,
      });
    });

    it("keeps inline secrets of an environment that has them", async () => {
      const fixture = await render({
        environment: { ...existing, secretSetId: undefined, secrets: [ref] },
        inlineSecrets: [ref],
      });
      expect(comp(fixture).form.controls.secrets.value).toBe(ENV_SECRETS_INLINE);
      await submit(fixture);
      expect(save.mock.calls[0][0].secrets).toEqual([ref]);
      expect(save.mock.calls[0][0].secretSetId).toBeUndefined();
    });

    it("starts at none when its set has been deleted", async () => {
      const fixture = await render({ environment: existing, sets: [] });
      expect(comp(fixture).form.controls.secrets.value).toBe(ENV_SECRETS_NONE);
    });
  });

  describe("failure", () => {
    it("shows the scrubbed message and stays open", async () => {
      save.mockResolvedValue({ ok: false, error: "failed", message: "scrubbed" });
      const fixture = await render();
      comp(fixture).form.patchValue({ name: "x" });
      await submit(fixture);
      expect(q(fixture, '[data-testid="agent-access-os-env-error"]')?.textContent).toContain(
        "scrubbed",
      );
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it.each([
      ["alreadyExists", "agentAccessOsEnvErrorNameTaken"],
      ["notFound", "agentAccessOsEnvErrorNotFound"],
      ["unsupported", "agentAccessOsPageErrorUnsupported"],
      ["failed", "agentAccessOsEnvErrorSave"],
    ])("explains %s when no message came back", async (error, key) => {
      save.mockResolvedValue({ ok: false, error });
      const fixture = await render();
      comp(fixture).form.patchValue({ name: "x" });
      await submit(fixture);
      expect(q(fixture, '[data-testid="agent-access-os-env-error"]')?.textContent).toContain(key);
    });
  });
});
