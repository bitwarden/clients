import { ChangeDetectorRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ReactiveFormsModule } from "@angular/forms";

import { ViewCacheService } from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";

import { CipherFormService } from "../abstractions/cipher-form.service";
import { CipherFormCacheService } from "../services/default-cipher-form-cache.service";

import { CipherFormComponent } from "./cipher-form.component";

describe("CipherFormComponent", () => {
  let component: CipherFormComponent;
  let fixture: ComponentFixture<CipherFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CipherFormComponent, ReactiveFormsModule],
      providers: [
        { provide: ChangeDetectorRef, useValue: {} },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ToastService, useValue: { showToast: jest.fn() } },
        { provide: CipherFormService, useValue: { saveCipher: jest.fn() } },
        {
          provide: CipherFormCacheService,
          useValue: { init: jest.fn(), getCachedCipherView: jest.fn() },
        },
        { provide: ViewCacheService, useValue: { signal: jest.fn(() => () => null) } },
        { provide: ConfigService, useValue: {} },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CipherFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create the component", () => {
    expect(component).toBeTruthy();
  });

  describe("getCipherView", () => {
    it("should return null if updatedCipherView is null", () => {
      component["updatedCipherView"] = null as any;
      expect(component.getCipherView).toBeNull();
    });

    it("should return null if updatedCipherView.login is undefined", () => {
      component["updatedCipherView"] = new CipherView();
      delete component["updatedCipherView"].login; // Simulating undefined login
      expect(component.getCipherView).toBeNull();
    });

    it("should return null if updatedCipherView.login is null", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = null as any;
      expect(component.getCipherView).toBeNull();
    });

    it("should return null if updatedCipherView.login.uris is undefined", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = {} as any; // login exists but uris is undefined
      expect(component.getCipherView).toBeNull();
    });

    it("should return null if updatedCipherView.login.uris is null", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = { uris: null } as any;
      expect(component.getCipherView).toBeNull();
    });

    it("should return null if updatedCipherView.login.uris is an empty array", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = { uris: [] } as any;
      expect(component.getCipherView).toBeNull();
    });

    it("should return updatedCipherView if login.uris contains at least one URI", () => {
      component["updatedCipherView"] = new CipherView();
      component["updatedCipherView"].login = { uris: [{ uri: "https://example.com" }] } as any;
      expect(component.getCipherView).toEqual(component["updatedCipherView"]);
    });
  });
});
