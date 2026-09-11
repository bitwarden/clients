import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import type { AccessConnector, AccessConnectorId } from "../rotation";
import { accessConnector, connectorId, targetSystem } from "../testing/rotation-builders";

import {
  AssignConnectorDialogComponent,
  AssignConnectorDialogParams,
} from "./assign-connector-dialog.component";

const i18nStub: Pick<I18nService, "t"> = {
  t: (id: string) => id,
};

const PROD_CONNECTOR_ID = connectorId("c-1");

function makeConnector(id: AccessConnectorId, name: string): AccessConnector {
  return accessConnector({ id, name });
}

describe("AssignConnectorDialogComponent", () => {
  let fixture: ComponentFixture<AssignConnectorDialogComponent>;
  let component: AssignConnectorDialogComponent;
  let dialogRef: jest.Mocked<DialogRef<string | undefined>>;

  const system = targetSystem({ name: "Prod Entra" });

  function createComponent(options: AccessConnector[]): Promise<void> {
    const params: AssignConnectorDialogParams = { targetSystem: system, options };
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
      makeConnector(PROD_CONNECTOR_ID, "Prod connector"),
      makeConnector(connectorId("c-2"), "Dev connector"),
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
    await createComponent([makeConnector(PROD_CONNECTOR_ID, "Prod connector")]);
    (component as any).cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it("does not confirm when no option is selected", async () => {
    await createComponent([makeConnector(PROD_CONNECTOR_ID, "Prod connector")]);
    (component as any).confirm();
    expect(dialogRef.close).not.toHaveBeenCalledWith(expect.any(String));
  });

  it("closes with the selected accessConnectorId on confirm", async () => {
    await createComponent([makeConnector(PROD_CONNECTOR_ID, "Prod connector")]);
    (component as any).form.controls.accessConnectorId.setValue(String(PROD_CONNECTOR_ID));
    (component as any).confirm();
    expect(dialogRef.close).toHaveBeenCalledWith(String(PROD_CONNECTOR_ID));
  });
});
