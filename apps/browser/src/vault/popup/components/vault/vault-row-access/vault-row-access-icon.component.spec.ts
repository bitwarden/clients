import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { VaultRowAccessIconComponent } from "./vault-row-access-icon.component";
import { VAULT_ROW_ACCESS, VaultRowAccessStatus } from "./vault-row-access.token";

describe("VaultRowAccessIconComponent", () => {
  let fixture: ComponentFixture<VaultRowAccessIconComponent>;
  let status$: BehaviorSubject<VaultRowAccessStatus | null>;

  const cipher = { id: "c1", name: "Amazon", partial: true } as unknown as CipherViewLike;

  function iconClasses(): string[] {
    const icon = fixture.nativeElement.querySelector("bit-icon");
    return icon == null ? [] : Array.from(icon.classList);
  }

  async function setup(provide = true) {
    status$ = new BehaviorSubject<VaultRowAccessStatus | null>(null);
    await TestBed.configureTestingModule({
      imports: [VaultRowAccessIconComponent],
      providers: provide
        ? [{ provide: VAULT_ROW_ACCESS, useValue: { status$: () => status$ } }]
        : [],
    }).compileComponents();
    fixture = TestBed.createComponent(VaultRowAccessIconComponent);
    fixture.componentRef.setInput("cipher", cipher);
    fixture.detectChanges();
  }

  it.each([
    ["request", "bwi-lock-encrypted"],
    ["unavailable", "bwi-lock-encrypted"],
    ["pending", "bwi-clock"],
    ["ready", "bwi-lock"],
    ["active", "bwi-unlock"],
  ] as const)("shows %s as %s", async (kind, icon) => {
    await setup();

    status$.next({ kind, label: kind, canExtend: false });
    fixture.detectChanges();

    expect(iconClasses()).toContain(icon);
  });

  it("renders nothing for an item privileged control does not govern", async () => {
    await setup();

    expect(iconClasses()).toEqual([]);
  });

  it("renders nothing when no host provides row access", async () => {
    await setup(false);

    expect(iconClasses()).toEqual([]);
  });
});
