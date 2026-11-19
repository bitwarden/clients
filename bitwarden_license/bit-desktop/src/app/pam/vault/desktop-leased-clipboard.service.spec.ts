import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject, Subscription, throwError } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Message, MessageListener } from "@bitwarden/common/platform/messaging";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import type { TotpResponse } from "@bitwarden/sdk-internal";

import { DesktopLeasedClipboardService, HeldLeasedViews } from "./desktop-leased-clipboard.service";

describe("DesktopLeasedClipboardService", () => {
  const userId = "user-1" as UserId;
  const cipherId = "cipher-1" as CipherId;
  const otherCipherId = "cipher-2" as CipherId;

  let messages$: Subject<Message<Record<string, unknown>>>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let totpService: MockProxy<TotpService>;
  let logService: MockProxy<LogService>;
  let held$: BehaviorSubject<HeldLeasedViews>;
  let clipboard: string;
  let subscription: Subscription;

  const leasedView = (id: CipherId, password: string) => {
    const view = new CipherView();
    view.id = id;
    view.name = "Prod database";
    view.login.username = "dba";
    view.login.password = password;
    return view;
  };

  const hold = (...views: CipherView[]) =>
    held$.next(new Map([[userId, new Map(views.map((view) => [view.id as CipherId, view]))]]));

  const copy = async (value: string) => {
    clipboard = value;
    messages$.next({ command: "copiedToClipboard", clipboardValue: value, clearing: false });
    await flush();
  };

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };

  const cleared = () =>
    platformUtilsService.copyToClipboard.mock.calls.some(
      ([text, options]) => text === "" && options?.clearing === true,
    );

  beforeEach(() => {
    messages$ = new Subject();
    clipboard = "";
    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.readFromClipboard.mockImplementation(async () => clipboard);
    totpService = mock<TotpService>();
    logService = mock<LogService>();
    held$ = new BehaviorSubject<HeldLeasedViews>(new Map());

    const service = new DesktopLeasedClipboardService(
      new MessageListener(messages$),
      platformUtilsService,
      totpService,
      logService,
    );
    subscription = service.watch(held$);
  });

  afterEach(() => subscription.unsubscribe());

  it("clears a leased password when its lease ends", async () => {
    hold(leasedView(cipherId, "leased-secret"));
    await copy("leased-secret");

    hold();
    await flush();

    expect(cleared()).toBe(true);
  });

  it("clears a leased custom field value", async () => {
    const view = leasedView(cipherId, "leased-secret");
    const field = new FieldView();
    field.value = "api-key-123";
    view.fields = [field];
    hold(view);
    await copy("api-key-123");

    hold();
    await flush();

    expect(cleared()).toBe(true);
  });

  it("clears a TOTP code copied from a leased item", async () => {
    const view = leasedView(cipherId, "leased-secret");
    view.login.totp = "JBSWY3DPEHPK3PXP";
    totpService.getCode$.mockReturnValue(of({ code: "123456", period: 30 } as TotpResponse));
    hold(view);
    await copy("123456");

    hold();
    await flush();

    expect(totpService.getCode$).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP");
    expect(cleared()).toBe(true);
  });

  it("does not clear when nothing was copied", async () => {
    hold(leasedView(cipherId, "leased-secret"));

    hold();
    await flush();

    expect(platformUtilsService.readFromClipboard).not.toHaveBeenCalled();
    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
  });

  it("does not clear a copy that matches no leased value", async () => {
    hold(leasedView(cipherId, "leased-secret"));
    await copy("unrelated");

    hold();
    await flush();

    expect(platformUtilsService.readFromClipboard).not.toHaveBeenCalled();
    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
  });

  it("does not clear the item name, which shows without a lease", async () => {
    hold(leasedView(cipherId, "leased-secret"));
    await copy("Prod database");

    hold();
    await flush();

    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
  });

  it("does not clear when the clipboard now holds a different value", async () => {
    hold(leasedView(cipherId, "leased-secret"));
    await copy("leased-secret");
    clipboard = "copied from another app";

    hold();
    await flush();

    expect(platformUtilsService.readFromClipboard).toHaveBeenCalled();
    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
  });

  it("forgets a leased copy once something else is copied in the app", async () => {
    hold(leasedView(cipherId, "leased-secret"));
    await copy("leased-secret");
    await copy("unrelated");
    clipboard = "leased-secret";

    hold();
    await flush();

    expect(platformUtilsService.readFromClipboard).not.toHaveBeenCalled();
  });

  it("does not clear when another lease ends", async () => {
    hold(leasedView(cipherId, "leased-secret"), leasedView(otherCipherId, "other-secret"));
    await copy("leased-secret");

    hold(leasedView(cipherId, "leased-secret"));
    await flush();

    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
  });

  it("keeps tracking across a re-reveal of the same lease", async () => {
    hold(leasedView(cipherId, "leased-secret"));
    await copy("leased-secret");

    hold(leasedView(cipherId, "leased-secret"));
    await flush();
    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();

    hold();
    await flush();
    expect(cleared()).toBe(true);
  });

  it("clears only once per copy", async () => {
    hold(leasedView(cipherId, "leased-secret"));
    await copy("leased-secret");

    hold();
    await flush();
    hold(leasedView(cipherId, "leased-secret"));
    hold();
    await flush();

    expect(platformUtilsService.readFromClipboard).toHaveBeenCalledTimes(1);
  });

  it("logs no clipboard text when the clipboard read fails", async () => {
    platformUtilsService.readFromClipboard.mockRejectedValue(new Error("leased-secret"));
    hold(leasedView(cipherId, "leased-secret"));
    await copy("leased-secret");

    hold();
    await flush();

    expect(logService.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logService.error.mock.calls)).not.toContain("leased-secret");
  });

  it("treats a failed TOTP read as no match", async () => {
    const view = leasedView(cipherId, "leased-secret");
    view.login.totp = "JBSWY3DPEHPK3PXP";
    totpService.getCode$.mockReturnValue(throwError(() => new Error("bad key")));
    hold(view);
    await copy("123456");

    hold();
    await flush();

    expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
  });
});
