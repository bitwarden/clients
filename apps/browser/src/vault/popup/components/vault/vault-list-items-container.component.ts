import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeModule,
  ButtonModule,
  IconButtonModule,
  ItemModule,
  SectionComponent,
  TypographyModule,
} from "@bitwarden/components";

import { VaultListItemComponent } from "./vault-list-item.component";

@Component({
  imports: [
    CommonModule,
    ItemModule,
    ButtonModule,
    BadgeModule,
    IconButtonModule,
    SectionComponent,
    TypographyModule,
    JslibModule,
    VaultListItemComponent,
  ],
  selector: "app-vault-list-items-container",
  template: `
    <ng-container *ngIf="ciphers">
      <bit-section *ngIf="ciphers.length > 0">
        <!-- Temporary will be replaced with popup-section-header -->
        <h2 bitTypography="h6" class="tw-flex">
          <span class="tw-flex-grow tw-text-primary-700 tw-font-bold">{{ title }}</span>
          <span class="tw-text-muted">{{ ciphers.length }}</span>
        </h2>
        <bit-item-group>
          <app-vault-list-item
            *ngFor="let item of ciphers"
            [cipher]="item"
            [showAutoFill]="showAutoFill"
          ></app-vault-list-item>
        </bit-item-group>
      </bit-section>
    </ng-container>
  `,
  standalone: true,
})
export class VaultListItemsContainerComponent implements OnInit {
  @Input()
  ciphers: CipherView[];

  @Input()
  title: string;

  @Input()
  showAutoFill: boolean;

  ngOnInit() {}
}
