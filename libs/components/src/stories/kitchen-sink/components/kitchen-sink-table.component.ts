import { ChangeDetectionStrategy, Component } from "@angular/core";

import { IconTileComponent } from "../../../icon-tile";
import {
  BitCellComponent,
  BitHeaderCellComponent,
  BitHeaderRowComponent,
  BitRowComponent,
  BitTableV2Component,
} from "../../../table/v2";
import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "bit-kitchen-sink-table",
  imports: [
    KitchenSinkSharedModule,
    BitTableV2Component,
    BitCellComponent,
    BitHeaderCellComponent,
    BitRowComponent,
    BitHeaderRowComponent,
    IconTileComponent,
  ],
  template: `
    <bit-table-v2>
      <bit-header-row>
        <bit-header-cell>Product</bit-header-cell>
        <bit-header-cell>User</bit-header-cell>
        <bit-header-cell></bit-header-cell>
      </bit-header-row>
      <bit-row>
        <bit-cell>
          <bit-icon-tile slot="start" icon="bwi-globe" size="sm" />
          Password Manager
          <span slot="secondary">Vault, autofill, and credential generator</span>
        </bit-cell>
        <bit-cell>Everyone</bit-cell>
        <bit-cell>
          <button
            type="button"
            bitIconButton="bwi-ellipsis-v"
            [bitMenuTriggerFor]="menu1"
            label="Options"
          ></button>
          <bit-menu #menu1>
            <a href="#" bitMenuItem>Anchor link</a>
            <a href="#" bitMenuItem>Another link</a>
            <bit-menu-divider></bit-menu-divider>
            <button type="button" bitMenuItem>Button after divider</button>
          </bit-menu>
        </bit-cell>
      </bit-row>
      <bit-row>
        <bit-cell>
          <bit-icon-tile slot="start" icon="bwi-globe" size="sm" />
          Secrets Manager
          <span slot="secondary">API keys, certificates, and infrastructure secrets</span>
        </bit-cell>
        <bit-cell>Developers</bit-cell>
        <bit-cell>
          <button
            type="button"
            bitIconButton="bwi-ellipsis-v"
            [bitMenuTriggerFor]="menu2"
            label="Options"
          ></button>
          <bit-menu #menu2>
            <a href="#" bitMenuItem>Anchor link</a>
            <a href="#" bitMenuItem>Another link</a>
            <bit-menu-divider></bit-menu-divider>
            <button type="button" bitMenuItem>Button after divider</button>
          </bit-menu>
        </bit-cell>
      </bit-row>
    </bit-table-v2>
  `,
})
export class KitchenSinkTableComponent {}
