import { ChangeDetectionStrategy, Component } from "@angular/core";

import { IconTileComponent } from "../../../icon-tile";
import { RowDirective } from "../../../table/row.directive";
import { BitCellComponent, BitHeaderCellComponent, BitTableV2Component } from "../../../table/v2";
import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "bit-kitchen-sink-table",
  imports: [
    KitchenSinkSharedModule,
    BitTableV2Component,
    BitCellComponent,
    BitHeaderCellComponent,
    RowDirective,
    IconTileComponent,
  ],
  template: `
    <bit-table-v2>
      <tr bit-header-row>
        <th bit-cell>Product</th>
        <th bit-cell>User</th>
        <th bit-cell></th>
      </tr>
      <tr bit-row>
        <td bit-cell>
          <bit-icon-tile slot="start" icon="bwi-globe" size="sm" />
          Password Manager
          <span slot="secondary">Vault, autofill, and credential generator</span>
        </td>
        <td bit-cell>Everyone</td>
        <td bit-cell>
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
        </td>
      </tr>
      <tr bit-row>
        <td bit-cell>
          <bit-icon-tile slot="start" icon="bwi-globe" size="sm" />
          Secrets Manager
          <span slot="secondary">API keys, certificates, and infrastructure secrets</span>
        </td>
        <td bit-cell>Developers</td>
        <td bit-cell>
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
        </td>
      </tr>
    </bit-table-v2>
  `,
})
export class KitchenSinkTableComponent {}
