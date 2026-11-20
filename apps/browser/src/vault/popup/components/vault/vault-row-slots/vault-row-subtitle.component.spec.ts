import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { VaultRowSubtitleComponent } from "./vault-row-subtitle.component";
import { VAULT_ROW_SUBTITLE } from "./vault-row-subtitle.token";

describe("VaultRowSubtitleComponent", () => {
  let fixture: ComponentFixture<VaultRowSubtitleComponent>;
  let subtitle$: BehaviorSubject<string | null>;

  const cipher = { id: "c1", name: "Company Facebook", subTitle: "frodo@shire.com" };

  const text = () => fixture.nativeElement.textContent.trim();

  async function create(provided: boolean) {
    subtitle$ = new BehaviorSubject<string | null>(null);
    await TestBed.configureTestingModule({
      imports: [VaultRowSubtitleComponent],
      providers: [
        { provide: I18nService, useValue: { t: (k: string) => k } },
        ...(provided
          ? [{ provide: VAULT_ROW_SUBTITLE, useValue: { subtitle$: () => subtitle$ } }]
          : []),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(VaultRowSubtitleComponent);
    fixture.componentRef.setInput("cipher", cipher as unknown as CipherViewLike);
    fixture.detectChanges();
  }

  it("shows the cipher's own subtitle when nothing is provided", async () => {
    await create(false);

    expect(text()).toBe("frodo@shire.com");
  });

  it("shows the cipher's own subtitle while the provider returns null", async () => {
    await create(true);

    expect(text()).toBe("frodo@shire.com");
  });

  it("shows the provider's subtitle and follows its updates", async () => {
    await create(true);

    subtitle$.next("8h left");
    fixture.detectChanges();
    expect(text()).toBe("8h left");

    subtitle$.next("7h left");
    fixture.detectChanges();
    expect(text()).toBe("7h left");
  });

  it("renders nothing without a cipher", async () => {
    await create(true);

    fixture.componentRef.setInput("cipher", null);
    fixture.detectChanges();

    expect(text()).toBe("");
  });
});
