// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, Location } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Observable, combineLatest, first, map, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  ButtonModule,
  CardComponent,
  SelectModule,
  FormFieldModule,
  AsyncActionsModule,
} from "@bitwarden/components";
import { AssignCollectionsComponent, CollectionAssignmentParams } from "@bitwarden/vault";

import { PopOutComponent } from "../../../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";

@Component({
  standalone: true,
  selector: "app-assign-collections",
  templateUrl: "./assign-collections.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CommonModule,
    JslibModule,
    SelectModule,
    FormFieldModule,
    AssignCollectionsComponent,
    CardComponent,
    ReactiveFormsModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopupFooterComponent,
    PopOutComponent,
  ],
})
export class AssignCollections {
  /** Params needed to populate the assign collections component */
  params: CollectionAssignmentParams;

  constructor(
    private location: Location,
    private collectionService: CollectionService,
    private cipherService: CipherService,
    private accountService: AccountService,
    route: ActivatedRoute,
  ) {
    const cipher$: Observable<CipherView> = route.queryParams.pipe(
      switchMap(({ cipherId }) => this.cipherService.get(cipherId)),
      switchMap((cipherDomain) =>
        this.accountService.activeAccount$.pipe(
          map((account) => account?.id),
          switchMap((userId) =>
            this.cipherService
              .getKeyForCipherKeyDecryption(cipherDomain, userId)
              .then(cipherDomain.decrypt.bind(cipherDomain)),
          ),
        ),
      ),
    );

    combineLatest([cipher$, this.collectionService.decryptedCollections$])
      .pipe(takeUntilDestroyed(), first())
      .subscribe(([cipherView, collections]) => {
        let availableCollections = collections.filter((c) => !c.readOnly);
        const organizationId = (cipherView?.organizationId as OrganizationId) ?? null;

        // If the cipher is already a part of an organization,
        // only show collections that belong to that organization
        if (organizationId) {
          availableCollections = availableCollections.filter(
            (c) => c.organizationId === organizationId,
          );
        }

        this.params = {
          ciphers: [cipherView],
          organizationId,
          availableCollections,
        };
      });
  }

  /** Navigates the user back to the previous screen */
  navigateBack() {
    this.location.back();
  }
}
