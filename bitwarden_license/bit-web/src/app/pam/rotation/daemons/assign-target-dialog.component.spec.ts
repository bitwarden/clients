import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

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
    name: "My Daemon",
    assignments: [],
  } as unknown as AccessConnector;

  function createComponent(options: TargetSystem[]): Promise<void> {
    const params: AssignTargetDialogParams = { daemon, options };
    dialogRef = {
      close: jest.fn().mockReturnValue(Promise.resolve()),
    } as unknown as jest.Mocked<DialogRef<string | undefined>>;

    return TestBed.configureTestingModule({
      imports: [AssignTargetDialogComponent, NoopAnimationsModule],
      providers: [
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

  it("shows an empty-options message when there are no options", async () => {
    await createComponent([]);
    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain("pamDaemonAssignNoOptions");
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
