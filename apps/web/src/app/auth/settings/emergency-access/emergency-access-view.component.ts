import { Component, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EmergencyAccessViewResponse } from "@bitwarden/common/auth/models/response/emergency-access.response";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import {
  SymmetricCryptoKey,
  UserKey,
} from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { EmergencyAccessAttachmentsComponent } from "./emergency-access-attachments.component";
import { EmergencyAddEditComponent } from "./emergency-add-edit.component";

@Component({
  selector: "emergency-access-view",
  templateUrl: "emergency-access-view.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class EmergencyAccessViewComponent implements OnInit {
  @ViewChild("cipherAddEdit", { read: ViewContainerRef, static: true })
  cipherAddEditModalRef: ViewContainerRef;
  @ViewChild("attachments", { read: ViewContainerRef, static: true })
  attachmentsModalRef: ViewContainerRef;

  id: string;
  ciphers: CipherView[] = [];
  loaded = false;

  constructor(
    private cipherService: CipherService,
    private cryptoService: CryptoService,
    private modalService: ModalService,
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.route.params.subscribe((qParams) => {
      if (qParams.id == null) {
        return this.router.navigate(["settings/emergency-access"]);
      }

      this.id = qParams.id;

      this.load();
    });
  }

  async selectCipher(cipher: CipherView) {
    // eslint-disable-next-line
    const [_, childComponent] = await this.modalService.openViewRef(
      EmergencyAddEditComponent,
      this.cipherAddEditModalRef,
      (comp) => {
        comp.cipherId = cipher == null ? null : cipher.id;
        comp.cipher = cipher;
      }
    );

    return childComponent;
  }

  async load() {
    const response = await this.apiService.postEmergencyAccessView(this.id);
    this.ciphers = await this.getAllCiphers(response);
    this.loaded = true;
  }

  async viewAttachments(cipher: CipherView) {
    await this.modalService.openViewRef(
      EmergencyAccessAttachmentsComponent,
      this.attachmentsModalRef,
      (comp) => {
        comp.cipher = cipher;
        comp.emergencyAccessId = this.id;
      }
    );
  }

  protected async getAllCiphers(response: EmergencyAccessViewResponse): Promise<CipherView[]> {
    const ciphers = response.ciphers;

    const decCiphers: CipherView[] = [];
    const oldKeyBuffer = await this.cryptoService.rsaDecrypt(response.keyEncrypted);
    const oldUserKey = new SymmetricCryptoKey(oldKeyBuffer) as UserKey;

    const promises: any[] = [];
    ciphers.forEach((cipherResponse) => {
      const cipherData = new CipherData(cipherResponse);
      const cipher = new Cipher(cipherData);
      promises.push(cipher.decrypt(oldUserKey).then((c) => decCiphers.push(c)));
    });

    await Promise.all(promises);
    decCiphers.sort(this.cipherService.getLocaleSortingFunction());

    return decCiphers;
  }
}
