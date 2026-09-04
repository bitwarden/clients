import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import type { AccessConnector, TargetSystem } from "../rotation";

import {
  AssignTargetDialogComponent,
  AssignTargetDialogParams,
} from "./assign-target-dialog.component";

// Simple i18n stub: returns the key for any translation.
const i18nStub: Pick<I18nService, "t"> = {
  t: (id: string) => id,
};

function makeSystem(id: string, name: string): TargetSystem {
  return { id, name } as unknown as TargetSystem;
}

describe("AssignTargetDialogComponent", () => {
  let fixture: ComponentFixture<AssignTargetDialogComponent>;
  let component: AssignTargetDialogComponent;
  let dialogRef: jest.Mocked<DialogRef<string | undefined>>;

  const daemon = {
    id: "d-1",
    organizationId: "org-1",
    name: "My Daemon",
    assignments: [],
  } as unknown as AccessConnector;

  function createComponent(options: TargetSystem[], noEligibleTargets?: boolean): Promise<void> {
    const params: AssignTargetDialogParams = { daemon, options, noEligibleTargets };
    dialogRef = {
      close: jest.fn().mockReturnValue(Promise.resolve()),
    } as unknown as jest.Mocked<DialogRef<string | undefined>>;

    return TestBed.configureTestingModule({
      imports: [AssignTargetDialogComponent, NoopAnimationsModule],
      providers: [
        // The link's target, so clicking it navigates rather than logging an unmatched-route error.
        provideRouter([
          { path: "organizations/:organizationId/pam/rotation/target-systems", children: [] },
        ]),
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18nStub },
      ],
    })
      .compileComponents()
      .then(() => {
        fixture = TestBed.createComponent(AssignTargetDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
      });
  }

  afterEach(() => TestBed.resetTestingModule());

  it("renders a select with the available target systems", async () => {
    await createComponent([makeSystem("ts-1", "Prod DB"), makeSystem("ts-2", "Dev DB")]);
    const select = fixture.nativeElement.querySelector("#assign-target-dialog_select_target");
    expect(select).toBeTruthy();
  });

  it("shows the all-assigned message when every eligible target is already assigned", async () => {
    await createComponent([]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("pamDaemonAssignNoOptions");
    expect(text).not.toContain("pamDaemonAssignNoTargetSystems");
  });

  it("shows the no-target-systems message when none exist", async () => {
    await createComponent([], true);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("pamDaemonAssignNoTargetSystems");
    expect(text).not.toContain("pamDaemonAssignNoOptions");
  });

  it("links to the Target systems tab when none exist", async () => {
    await createComponent([], true);
    const anchor = fixture.nativeElement.querySelector(
      "#assign-target-dialog_anchor_target-systems",
    ) as HTMLAnchorElement | null;
    expect(anchor?.getAttribute("href")).toBe("/organizations/org-1/pam/rotation/target-systems");
  });

  it("dismisses the dialog when the Target systems link is followed", async () => {
    await createComponent([], true);
    const anchor = fixture.nativeElement.querySelector(
      "#assign-target-dialog_anchor_target-systems",
    ) as HTMLAnchorElement;
    anchor.click();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it("closes with undefined on cancel", async () => {
    await createComponent([makeSystem("ts-1", "Prod")]);
    (component as any).cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it("does not confirm when no option is selected", async () => {
    await createComponent([makeSystem("ts-1", "Prod")]);
    (component as any).confirm();
    // Should NOT close because form is invalid
    expect(dialogRef.close).not.toHaveBeenCalledWith(expect.any(String));
  });

  it("closes with the selected targetSystemId on confirm", async () => {
    await createComponent([makeSystem("ts-1", "Prod")]);
    (component as any).form.controls.targetSystemId.setValue("ts-1");
    (component as any).confirm();
    expect(dialogRef.close).toHaveBeenCalledWith("ts-1");
  });
});
