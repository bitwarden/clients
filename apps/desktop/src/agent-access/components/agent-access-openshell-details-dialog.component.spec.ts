import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";

import { OpenShellSandboxMeta } from "../models/openshell-environments";

import { AgentAccessOpenShellDetailsDialogComponent } from "./agent-access-openshell-details-dialog.component";

describe("AgentAccessOpenShellDetailsDialogComponent (§M8.20 rule 17)", () => {
  let dialogRef: { close: jest.Mock };
  let setMeta: jest.Mock;
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
    setMeta = jest.fn().mockResolvedValue({ ok: true, data: undefined });
    originalIpc = (global as any).ipc;
    (global as any).ipc = { agentAccess: { setOpenShellSandboxMeta: setMeta } };
  });
  afterEach(() => {
    (global as any).ipc = originalIpc;
    TestBed.resetTestingModule();
  });

  async function render(
    meta: OpenShellSandboxMeta | null = null,
  ): Promise<ComponentFixture<unknown>> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellDetailsDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: { sandboxName: "box", meta } },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellDetailsDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }
  const comp = (f: ComponentFixture<unknown>) => f.componentInstance as any;
  const q = (f: ComponentFixture<unknown>, selector: string) =>
    (f.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);

  it("opens through the dialog service with its params", () => {
    const dialogService = mock<DialogService>();
    AgentAccessOpenShellDetailsDialogComponent.open(dialogService, {
      sandboxName: "box",
      meta: null,
    });
    expect(dialogService.open).toHaveBeenCalledWith(AgentAccessOpenShellDetailsDialogComponent, {
      data: { sandboxName: "box", meta: null },
    });
  });

  it("starts from the existing purpose and color", async () => {
    const fixture = await render({ name: "box", purpose: "CI runner", color: "green" });
    expect(comp(fixture).form.controls.purpose.value).toBe("CI runner");
    expect(comp(fixture).color()).toBe("green");
    expect(
      q(fixture, "#agent-access-openshell-details-dialog_button_color-green")?.getAttribute(
        "aria-checked",
      ),
    ).toBe("true");
  });

  it("offers exactly the fixed palette plus none", async () => {
    const fixture = await render();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('[role="radio"]');
    expect(buttons).toHaveLength(6);
    expect(comp(fixture).colors).toEqual(["blue", "green", "amber", "red", "gray"]);
  });

  it("limits the input to 120 characters", async () => {
    const fixture = await render();
    expect(
      q(fixture, "#agent-access-openshell-details-dialog_input_purpose")?.getAttribute("maxlength"),
    ).toBe("120");
  });

  it("saves purpose and color through main and closes with what was saved", async () => {
    const fixture = await render();
    comp(fixture).form.patchValue({ purpose: "  CI   runner " });
    q(fixture, "#agent-access-openshell-details-dialog_button_color-red")!.click();
    await comp(fixture).submit();
    expect(setMeta).toHaveBeenCalledWith({ name: "box", purpose: "  CI   runner ", color: "red" });
    expect(dialogRef.close).toHaveBeenCalledWith({
      name: "box",
      purpose: "CI runner",
      color: "red",
    });
  });

  it("clearing both closes with null", async () => {
    const fixture = await render({ name: "box", purpose: "x", color: "blue" });
    comp(fixture).form.patchValue({ purpose: "" });
    q(fixture, "#agent-access-openshell-details-dialog_button_color-none")!.click();
    await comp(fixture).submit();
    expect(setMeta).toHaveBeenCalledWith({ name: "box", purpose: "", color: null });
    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });

  it("shows the message and stays open when saving fails", async () => {
    setMeta.mockResolvedValue({ ok: false, error: "failed", message: "scrubbed" });
    const fixture = await render();
    await comp(fixture).submit();
    fixture.detectChanges();
    expect(q(fixture, '[data-testid="agent-access-os-details-error"]')?.textContent).toContain(
      "scrubbed",
    );
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
