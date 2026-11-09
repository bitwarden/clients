import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { VAULT_ROW_ACCESS, VaultRowAccessStatus } from "./vault-row-access.token";
import { VaultRowSubtitleComponent } from "./vault-row-subtitle.component";

describe("VaultRowSubtitleComponent", () => {
  let fixture: ComponentFixture<VaultRowSubtitleComponent>;
  let status$: BehaviorSubject<VaultRowAccessStatus | null>;
  let revealed$: BehaviorSubject<ReadonlyMap<CipherId, CipherView>>;

  const cipher = {
    id: "c1",
    name: "Company Facebook",
    partial: true,
    subtitle: "",
  } as unknown as CipherViewLike;

  const revealedView = { id: "c1", subTitle: "frodo@shire.com" } as unknown as CipherView;

  const text = () => fixture.nativeElement.textContent.trim();

  beforeEach(async () => {
    status$ = new BehaviorSubject<VaultRowAccessStatus | null>(null);
    revealed$ = new BehaviorSubject<ReadonlyMap<CipherId, CipherView>>(new Map());
    await TestBed.configureTestingModule({
      imports: [VaultRowSubtitleComponent],
      providers: [
        { provide: I18nService, useValue: { t: (k: string) => k } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "UserId" }) } },
        { provide: RevealedCipherService, useValue: { revealed$: () => revealed$ } },
        { provide: VAULT_ROW_ACCESS, useValue: { status$: () => status$ } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(VaultRowSubtitleComponent);
    fixture.componentRef.setInput("cipher", cipher);
    fixture.detectChanges();
  });

  it.each([
    ["request", "Request to use"],
    ["pending", "Pending approval"],
    ["unavailable", "Unavailable to request"],
  ] as const)("shows only the %s status on a gated row, hiding the username", (kind, label) => {
    status$.next({ kind, label, canExtend: false });
    fixture.detectChanges();

    expect(text()).toBe(label);
  });

  it("shows the status before the username once access is active", () => {
    revealed$.next(new Map([["c1" as CipherId, revealedView]]));
    status$.next({ kind: "active", label: "8h left", canExtend: true });
    fixture.detectChanges();

    expect(text()).toBe("8h left • frodo@shire.com");
  });

  it("shows just the countdown while the revealed username is not yet available", () => {
    status$.next({ kind: "active", label: "5m left", canExtend: true });
    fixture.detectChanges();

    expect(text()).toBe("5m left");
  });

  it("shows Ready to use without a username, since credentials stay masked until start", () => {
    status$.next({ kind: "ready", label: "Ready to use", canExtend: false });
    fixture.detectChanges();

    expect(text()).toBe("Ready to use");
  });

  it("shows the cipher's own subtitle when privileged control does not govern it", () => {
    fixture.componentRef.setInput("cipher", { ...cipher, partial: false, subTitle: "user@x.com" });
    fixture.detectChanges();

    expect(text()).toBe("user@x.com");
  });
});
