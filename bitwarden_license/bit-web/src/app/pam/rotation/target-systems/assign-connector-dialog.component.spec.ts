import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import type { AccessConnector, TargetSystem } from "../rotation";

import {
  AssignConnectorDialogComponent,
  AssignConnectorDialogParams,
} from "./assign-connector-dialog.component";

const i18nStub: Pick<I18nService, "t"> = {
  t: (id: string) => id,
};

function makeConnector(id: string, name: string): AccessConnector {
  return { id, name } as unknown as AccessConnector;
}

describe("AssignConnectorDialogComponent", () => {
  let fixture: ComponentFixture<AssignConnectorDialogComponent>;
  let component: AssignConnectorDialogComponent;
  let dialogRef: jest.Mocked<DialogRef<string | undefined>>;

  const targetSystem = {
    id: "ts-1",
    name: "Prod Entra",
  } as unknown as TargetSystem;

  function createComponent(options: AccessConnector[]): Promise<void> {
    const params: AssignConnectorDialogParams = { targetSystem, options };
    dialogRef = {
      close: jest.fn().mockReturnValue(Promise.resolve()),
    } as unknown as jest.Mocked<DialogRef<string | undefined>>;

    return TestBed.configureTestingModule({
      imports: [AssignConnectorDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18nStub },
      ],
    })
      .compileComponents()
      .then(() => {
        fixture = TestBed.createComponent(AssignConnectorDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
      });
  }

  afterEach(() => TestBed.resetTestingModule());

  it("renders a select with the available access connectors", async () => {
    await createComponent([
      makeConnector("c-1", "Prod connector"),
      makeConnector("c-2", "Dev connector"),
    ]);
    const select = fixture.nativeElement.querySelector("#assign-connector-dialog_select_connector");
    expect(select).toBeTruthy();
  });

  it("shows an empty-options message when there are no options", async () => {
    await createComponent([]);
    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain("pamTargetSystemAssignConnectorNoOptions");
  });

  it("closes with undefined on cancel", async () => {
    await createComponent([makeConnector("c-1", "Prod connector")]);
    (component as any).cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it("does not confirm when no option is selected", async () => {
    await createComponent([makeConnector("c-1", "Prod connector")]);
    (component as any).confirm();
    expect(dialogRef.close).not.toHaveBeenCalledWith(expect.any(String));
  });

  it("closes with the selected accessConnectorId on confirm", async () => {
    await createComponent([makeConnector("c-1", "Prod connector")]);
    (component as any).form.controls.accessConnectorId.setValue("c-1");
    (component as any).confirm();
    expect(dialogRef.close).toHaveBeenCalledWith("c-1");
  });
});
