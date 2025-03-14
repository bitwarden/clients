// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { RouterModule } from "@angular/router";

import { CollectionView } from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  CardComponent,
  DialogModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { OrgIconDirective } from "../../components/org-icon.directive";
import { VaultItemVisualizerDialogComponent } from "../vault-item-visualizer/vault-item-visualizer-dialog.component";

@Component({
  selector: "app-item-details-v2",
  templateUrl: "item-details-v2.component.html",
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    DialogModule,
    JslibModule,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    OrgIconDirective,
    FormFieldModule,
    IconButtonModule,
    VaultItemVisualizerDialogComponent,
  ],
})
export class ItemDetailsV2Component {
  @Input() cipher: CipherView;
  @Input() organization?: Organization;
  @Input() collections?: CollectionView[];
  @Input() folder?: FolderView;
  @Input() hideOwner?: boolean = false;

  constructor(private dialogService: DialogService) {}

  get showOwnership() {
    return this.cipher.organizationId && this.organization && !this.hideOwner;
  }

  async showVisualization() {
    return await this.dialogService.open(VaultItemVisualizerDialogComponent, {
      data: { cipher: this.cipher },
    });
  }
}
