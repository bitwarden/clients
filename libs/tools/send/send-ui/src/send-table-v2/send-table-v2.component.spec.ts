import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { DialogService } from "@bitwarden/components";

import { SendTableV2Component } from "./send-table-v2.component";

function createSend(id: string, overrides: Partial<SendView> = {}): SendView {
  const send = new SendView();
  send.id = id;
  send.name = `Send ${id}`;
  send.type = SendType.Text;
  send.authType = AuthType.None;
  send.deletionDate = new Date("2030-01-01T12:00:00Z");
  send.password = null as any;
  return Object.assign(send, overrides);
}

describe("SendTableV2Component", () => {
  let fixture: ComponentFixture<SendTableV2Component>;
  let component: SendTableV2Component;
  let i18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);

    await TestBed.configureTestingModule({
      imports: [SendTableV2Component],
      providers: [
        {
          provide: I18nService,
          useValue: i18nService,
        },
        // The toolbar in the V2 table requires this
        {
          provide: DialogService,
          useValue: mock<DialogService>(),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendTableV2Component);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("sends", [createSend("1"), createSend("2")]);
    // If we display the tools-new-send-dropdown-v2 we need to mock all of its dependencies
    // as well; since we're testing the table component here we just hide the button
    fixture.componentRef.setInput("disableSend", true);
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should emit editSend with the Send when its name is clicked", () => {
    const emitSpy = jest.spyOn(component.editSend, "emit");
    const sendCell = fixture.debugElement.queryAll(By.css("bit-cell"))[0];

    sendCell.triggerEventHandler("click", null);

    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
  });

  it("should emit deleteSend when the Delete action is chosen", () => {
    const emitSpy = jest.spyOn(component.deleteSend, "emit");

    component["onDelete"](createSend("3"));

    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ id: "3" }));
  });
});
