import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { MenuTriggerForDirective, TableDataSource } from "@bitwarden/components";

import { SendTableComponent } from "./send-table.component";

// eslint-disable-next-line no-console
const originalError = console.error;

describe("SendTableComponent", () => {
  let fixture: ComponentFixture<SendTableComponent>;

  beforeAll(() => {
    // Opening the menu overlay causes JSDOM to parse stylesheets it can't understand; ignore those.
    // eslint-disable-next-line no-console
    console.error = (...args: unknown[]) => {
      if ((args[0] as Error)?.message?.includes("Could not parse CSS stylesheet")) {
        return;
      }
      originalError(...args);
    };
  });

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.error = originalError;
  });

  beforeEach(async () => {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [SendTableComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(SendTableComponent);
  });

  afterEach(() => {
    // Close any open menu overlay so it doesn't leak into the next test.
    document.querySelector<HTMLElement>(".cdk-overlay-backdrop")?.click();
  });

  function createSend(overrides: Partial<SendView>): SendView {
    const send = new SendView();
    send.id = "send-id";
    send.name = "My Send";
    send.type = SendType.Text;
    send.authType = AuthType.None;
    send.deletionDate = new Date("2030-01-01T12:00:00Z");
    return Object.assign(send, overrides);
  }

  async function renderWithSend(send: SendView, disableSend = false) {
    const dataSource = new TableDataSource<SendView>();
    dataSource.data = [send];
    fixture.componentRef.setInput("dataSource", dataSource);
    fixture.componentRef.setInput("disableSend", disableSend);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Opens the row's options menu and returns the text of each menu item. */
  function openMenuItems(): string[] {
    const trigger = fixture.debugElement.query(By.directive(MenuTriggerForDirective));
    (trigger.nativeElement as HTMLButtonElement).click();
    fixture.detectChanges();

    // The menu renders in a CDK overlay outside the fixture's root element.
    return Array.from(document.querySelectorAll(".bit-menu-panel [bitMenuItem]")).map(
      (item) => item.textContent?.trim() ?? "",
    );
  }

  it("shows 'removePassword' for password-protected Sends", async () => {
    await renderWithSend(createSend({ authType: AuthType.Password, password: "hash" }));

    const items = openMenuItems();

    expect(items).toContain("removePassword");
    expect(items).not.toContain("removeEmailVerification");
  });

  it("shows 'removeEmailVerification' for email-verified Sends", async () => {
    await renderWithSend(createSend({ authType: AuthType.Email, emails: ["a@example.com"] }));

    const items = openMenuItems();

    expect(items).toContain("removeEmailVerification");
    expect(items).not.toContain("removePassword");
  });

  it("hides the remove option for Sends without authentication", async () => {
    await renderWithSend(createSend({ authType: AuthType.None }));

    const items = openMenuItems();

    expect(items).toContain("copySendLink");
    expect(items).not.toContain("removePassword");
    expect(items).not.toContain("removeEmailVerification");
    expect(items).not.toContain("removeAuth");
  });

  it("hides the remove option when Send is disabled by policy", async () => {
    await renderWithSend(createSend({ authType: AuthType.Email }), true);

    const items = openMenuItems();

    expect(items).toContain("copySendLink");
    expect(items).not.toContain("removeEmailVerification");
  });

  it("emits removeAuth with the Send when the remove option is clicked", async () => {
    const send = createSend({ authType: AuthType.Email });
    await renderWithSend(send);
    const removeAuthSpy = jest.fn();
    fixture.componentInstance.removeAuth.subscribe(removeAuthSpy);

    openMenuItems();
    const removeItem = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".bit-menu-panel [bitMenuItem]"),
    ).find((item) => item.textContent?.trim() === "removeEmailVerification");
    removeItem?.click();

    expect(removeAuthSpy).toHaveBeenCalledWith(send);
  });
});
