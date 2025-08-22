import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { BitTotpCountdownComponent } from "./totp-countdown.component";

describe("BitTotpCountdownComponent", () => {
  let component: BitTotpCountdownComponent;
  let fixture: ComponentFixture<BitTotpCountdownComponent>;
  let totpService: jest.Mocked<TotpService>;

  const mockCipher1 = {
    id: "cipher-id",
    name: "Test Cipher",
    login: { totp: "totp-secret" },
  } as CipherView;

  const mockCipher2 = {
    id: "cipher-id-2",
    name: "Test Cipher 2",
    login: { totp: "totp-secret-2" },
  } as CipherView;

  const mockTotpResponse1 = {
    code: "123456",
    period: 30,
  };

  const mockTotpResponse2 = {
    code: "987654",
    period: 10,
  };

  beforeEach(async () => {
    totpService = mock<TotpService>({
      getCode$: jest.fn().mockImplementation((totp) => {
        if (totp === mockCipher1.login.totp) {
          return of(mockTotpResponse1);
        }

        return of(mockTotpResponse2);
      }),
    });

    await TestBed.configureTestingModule({
      providers: [{ provide: TotpService, useValue: totpService }],
    }).compileComponents();

    fixture = TestBed.createComponent(BitTotpCountdownComponent);
    component = fixture.componentInstance;
    component.cipher = mockCipher1;
    fixture.detectChanges();
  });

  it("initializes totpInfo$ observable", (done) => {
    component.totpInfo$?.subscribe((info) => {
      expect(info.totpCode).toBe(mockTotpResponse1.code);
      expect(info.totpCodeFormatted).toBe("123 456");
      done();
    });
  });

  it("emits sendCopyCode when TOTP code is available", (done) => {
    const emitter = jest.spyOn(component.sendCopyCode, "emit");

    component.totpInfo$?.subscribe((info) => {
      expect(emitter).toHaveBeenCalledWith({
        totpCode: info.totpCode,
        totpCodeFormatted: info.totpCodeFormatted,
      });
      done();
    });
  });

  it("updates totpInfo$ when cipher changes", (done) => {
    component.cipher = mockCipher2;
    component.ngOnChanges({
      cipher: {
        currentValue: mockCipher2,
        previousValue: mockCipher1,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    component.totpInfo$?.subscribe((info) => {
      expect(info.totpCode).toBe(mockTotpResponse2.code);
      expect(info.totpCodeFormatted).toBe("987 654");
      done();
    });
  });
});
