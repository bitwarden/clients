import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  RequestAccessFooterActions,
  RequestAccessFooterBridge,
} from "../cipher-view-banner/request-access-footer.bridge";

import { CipherViewFooterActionsComponent } from "./cipher-view-footer-actions.component";

/**
 * Builds a {@link RequestAccessFooterActions} handle over live, settable signals, so a test can
 * drive `expanded`/`visible`/`submittable` the way the card would and observe the footer react.
 *
 * `toggle` and `submit` default to flipping `expanded` themselves, mirroring what the real card
 * does — Cancel and a successful submit both collapse the form.
 */
function makeActions(cipherId = "cipher-1") {
  const visible = signal(true);
  const expanded = signal(false);
  const submittable = signal(true);
  const toggle = jest.fn(async () => {
    expanded.set(!expanded());
  });
  const submit = jest.fn(async () => {
    expanded.set(false);
  });

  const handle: RequestAccessFooterActions = {
    cipherId,
    visible: visible.asReadonly(),
    expanded: expanded.asReadonly(),
    submittable: submittable.asReadonly(),
    toggle,
    submit,
  };

  return { handle, visible, expanded, submittable, toggle, submit };
}

describe("CipherViewFooterActionsComponent", () => {
  let fixture: ComponentFixture<CipherViewFooterActionsComponent>;
  let bridge: RequestAccessFooterBridge;

  function cipherView(id = "cipher-1"): CipherView {
    const cipher = new CipherView();
    cipher.id = id;
    return cipher;
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  async function create(cipher: CipherView): Promise<void> {
    fixture = TestBed.createComponent(CipherViewFooterActionsComponent);
    fixture.componentRef.setInput("cipher", cipher);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CipherViewFooterActionsComponent],
      providers: [
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
    // The real, root-provided bridge — a bare signal wrapper with no dependencies of its own, so
    // publishing a fixture handle onto it is simpler than mocking it.
    bridge = TestBed.inject(RequestAccessFooterBridge);
  });

  it("renders nothing when no handle has been published", async () => {
    await create(cipherView());

    expect(query("button")).toBeNull();
  });

  it("renders nothing for a handle published under a different cipher id", async () => {
    const { handle } = makeActions("cipher-OTHER");
    bridge.publish(handle);

    await create(cipherView("cipher-1"));

    expect(query("button")).toBeNull();
  });

  it("renders nothing when the matching handle is not visible", async () => {
    const { handle, visible } = makeActions();
    visible.set(false);
    bridge.publish(handle);

    await create(cipherView());

    expect(query("button")).toBeNull();
  });

  it("offers Request access at rest and calls toggle on click", async () => {
    const { handle, toggle } = makeActions();
    bridge.publish(handle);

    await create(cipherView());

    const button = query("#pam-cipher-view-banner_button_request-toggle");
    expect(button).not.toBeNull();
    expect(query("[data-testid='cipher-view-footer-actions-toggle']")).not.toBeNull();

    button?.click();

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("offers Submit request and Cancel once expanded", async () => {
    const { handle, expanded } = makeActions();
    expanded.set(true);
    bridge.publish(handle);

    await create(cipherView());

    expect(query("#pam-cipher-view-banner_button_request-toggle")).toBeNull();
    expect(query("#pam-cipher-view-banner_button_request-submit")).not.toBeNull();
    expect(query("#pam-cipher-view-banner_button_request-cancel")).not.toBeNull();
  });

  it("offers Cancel alone when the fold-out has no form to submit", async () => {
    const { handle, expanded, submittable } = makeActions();
    expanded.set(true);
    submittable.set(false);
    bridge.publish(handle);

    await create(cipherView());

    expect(query("#pam-cipher-view-banner_button_request-submit")).toBeNull();
    expect(query("#pam-cipher-view-banner_button_request-cancel")).not.toBeNull();
  });

  it("drives submit through [bitAction] on the Submit request button", async () => {
    const { handle, expanded, submit } = makeActions();
    expanded.set(true);
    bridge.publish(handle);

    await create(cipherView());

    query("#pam-cipher-view-banner_button_request-submit")?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("calls toggle, not submit, when Cancel is clicked", async () => {
    const { handle, expanded, toggle, submit } = makeActions();
    expanded.set(true);
    bridge.publish(handle);

    await create(cipherView());

    query("#pam-cipher-view-banner_button_request-cancel")?.click();

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it("returns focus to the toggle after Cancel collapses the form", async () => {
    const { handle, expanded } = makeActions();
    expanded.set(true);
    bridge.publish(handle);

    await create(cipherView());

    query("#pam-cipher-view-banner_button_request-cancel")?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.activeElement).toBe(query("#pam-cipher-view-banner_button_request-toggle"));
  });

  it("returns focus to the toggle after a submit that collapses the form", async () => {
    const { handle, expanded } = makeActions();
    expanded.set(true);
    bridge.publish(handle);

    await create(cipherView());

    query("#pam-cipher-view-banner_button_request-submit")?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.activeElement).toBe(query("#pam-cipher-view-banner_button_request-toggle"));
  });

  it("does not move focus when the form stays open (e.g. a submit that fails validation)", async () => {
    const { handle, expanded, submit } = makeActions();
    submit.mockImplementation(async () => {
      // Left expanded, as a rejected/invalid submit would.
    });
    expanded.set(true);
    bridge.publish(handle);

    await create(cipherView());

    const elsewhere = document.createElement("input");
    document.body.appendChild(elsewhere);
    elsewhere.focus();

    query("#pam-cipher-view-banner_button_request-submit")?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });
});
