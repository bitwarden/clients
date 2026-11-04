import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { DialogRef, DialogService } from "@bitwarden/components";

import type { BrowserSession } from "./native-webauthn";
import { WebAuthnBrowserSessionDialogComponent } from "./webauthn-browser-session-dialog.component";

describe("WebAuthnBrowserSessionDialogComponent.open", () => {
  let dialogService: MockProxy<DialogService>;
  let closed: Subject<void>;
  let close: jest.Mock;
  let session: BrowserSession & { cancel: jest.Mock };
  let endSession: () => void;

  beforeEach(() => {
    closed = new Subject<void>();
    close = jest.fn(() => {
      closed.next();
      closed.complete();
    });
    dialogService = mock<DialogService>();
    dialogService.open.mockReturnValue({ close, closed } as unknown as DialogRef<void>);
    session = {
      reopen: jest.fn(),
      cancel: jest.fn(),
      ended: new Promise<void>((resolve) => (endSession = resolve)),
    };
  });

  /** Lets the promise callbacks run. */
  async function settle() {
    await Promise.resolve();
    await Promise.resolve();
  }

  it("opens the dialog for the session", () => {
    WebAuthnBrowserSessionDialogComponent.open(dialogService, session);

    expect(dialogService.open).toHaveBeenCalledWith(
      WebAuthnBrowserSessionDialogComponent,
      expect.objectContaining({ data: session }),
    );
  });

  it("closes without cancelling when the request ends", async () => {
    WebAuthnBrowserSessionDialogComponent.open(dialogService, session);

    endSession();
    await settle();

    expect(close).toHaveBeenCalled();
    expect(session.cancel).not.toHaveBeenCalled();
  });

  it("cancels the request when closed before it ends", async () => {
    WebAuthnBrowserSessionDialogComponent.open(dialogService, session);

    close();
    await settle();

    expect(session.cancel).toHaveBeenCalled();
  });
});
