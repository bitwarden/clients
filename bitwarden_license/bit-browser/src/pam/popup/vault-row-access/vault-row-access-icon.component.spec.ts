import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { BrowserVaultRowAccessService } from "./browser-vault-row-access.service";
import { VaultRowAccessIconComponent } from "./vault-row-access-icon.component";
import { VaultRowAccessStatus } from "./vault-row-access-status";

describe("VaultRowAccessIconComponent", () => {
  let fixture: ComponentFixture<VaultRowAccessIconComponent>;
  let status$: BehaviorSubject<VaultRowAccessStatus | null>;

  const cipher = { id: "c1", name: "Amazon", partial: true } as unknown as CipherViewLike;

  function iconClasses(): string[] {
    const icon = fixture.nativeElement.querySelector("bit-icon");
    return icon == null ? [] : Array.from(icon.classList);
  }

  beforeEach(async () => {
    status$ = new BehaviorSubject<VaultRowAccessStatus | null>(null);
    await TestBed.configureTestingModule({
      imports: [VaultRowAccessIconComponent],
      providers: [
        { provide: I18nService, useValue: { t: (k: string) => k } },
        { provide: BrowserVaultRowAccessService, useValue: { status$: () => status$ } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(VaultRowAccessIconComponent);
    fixture.componentRef.setInput("cipher", cipher);
    fixture.detectChanges();
  });

  it.each([
    ["request", "bwi-lock-encrypted"],
    ["unavailable", "bwi-lock-encrypted"],
    ["pending", "bwi-clock"],
    ["ready", "bwi-lock"],
    ["active", "bwi-unlock"],
  ] as const)("shows %s as %s", (kind, icon) => {
    status$.next({ kind, label: kind, canExtend: false });
    fixture.detectChanges();

    expect(iconClasses()).toContain(icon);
  });

  it("titles the icon Privileged", () => {
    status$.next({ kind: "request", label: "request", canExtend: false });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector("bit-icon").title).toBe("pamAccessBadgePrivileged");
  });

  it("renders nothing for an item privileged control does not govern", () => {
    expect(iconClasses()).toEqual([]);
  });
});
