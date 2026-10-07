import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";

import {
  AgentAccessOpenShellSetNameDialogComponent,
  AgentAccessOpenShellSetNameDialogParams,
} from "./agent-access-openshell-set-name-dialog.component";

describe("AgentAccessOpenShellSetNameDialogComponent (§M8.20 rule 17)", () => {
  let dialogRef: { close: jest.Mock };
  let save: jest.Mock;

  beforeAll(() => {
    (global as any).IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    dialogRef = { close: jest.fn() };
    save = jest.fn().mockResolvedValue({ ok: true, data: undefined });
  });
  afterEach(() => TestBed.resetTestingModule());

  async function render(initialName = ""): Promise<ComponentFixture<unknown>> {
    const i18n = mock<I18nService>();
    i18n.t.mockImplementation((key: string) => key);
    const params: AgentAccessOpenShellSetNameDialogParams = {
      titleKey: "agentAccessOsSetSaveTitle",
      initialName,
      save,
    };
    TestBed.configureTestingModule({
      imports: [AgentAccessOpenShellSetNameDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: params },
      ],
    });
    const fixture = TestBed.createComponent(AgentAccessOpenShellSetNameDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }
  const comp = (f: ComponentFixture<unknown>) => f.componentInstance as any;
  const q = (f: ComponentFixture<unknown>, selector: string) =>
    (f.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);

  it("opens through the dialog service with its params", () => {
    const dialogService = mock<DialogService>();
    const params = { titleKey: "t", initialName: "", save };
    AgentAccessOpenShellSetNameDialogComponent.open(dialogService, params);
    expect(dialogService.open).toHaveBeenCalledWith(AgentAccessOpenShellSetNameDialogComponent, {
      data: params,
    });
  });

  it("starts from the initial name and shows the title", async () => {
    const fixture = await render("Work");
    expect(comp(fixture).form.controls.name.value).toBe("Work");
    expect(fixture.nativeElement.textContent).toContain("agentAccessOsSetSaveTitle");
  });

  it("saves the trimmed name and closes with true", async () => {
    const fixture = await render();
    comp(fixture).form.patchValue({ name: "  Work  " });
    await comp(fixture).submit();
    expect(save).toHaveBeenCalledWith("Work");
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it("does not save an empty name", async () => {
    const fixture = await render();
    comp(fixture).form.patchValue({ name: "   " });
    await comp(fixture).submit();
    expect(save).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it("caps the name at 60 characters in the form", async () => {
    const fixture = await render();
    comp(fixture).form.patchValue({ name: "x".repeat(61) });
    expect(comp(fixture).form.controls.name.invalid).toBe(true);
  });

  it("shows the scrubbed message and stays open on failure", async () => {
    save.mockResolvedValue({ ok: false, error: "failed", message: "scrubbed" });
    const fixture = await render();
    comp(fixture).form.patchValue({ name: "Work" });
    await comp(fixture).submit();
    fixture.detectChanges();
    expect(q(fixture, '[data-testid="agent-access-os-set-name-error"]')?.textContent).toContain(
      "scrubbed",
    );
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it("explains a taken name when no message came back", async () => {
    save.mockResolvedValue({ ok: false, error: "alreadyExists" });
    const fixture = await render();
    comp(fixture).form.patchValue({ name: "Work" });
    await comp(fixture).submit();
    fixture.detectChanges();
    expect(q(fixture, '[data-testid="agent-access-os-set-name-error"]')?.textContent).toContain(
      "agentAccessOsEnvErrorNameTaken",
    );
  });
});
