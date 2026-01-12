import { Component } from "@angular/core";

import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-kitchen-sink-table",
  imports: [KitchenSinkSharedModule],
  template: `
    <bit-table>
      <ng-container header>
        <tr>
          <th bitCell>Product</th>
          <th bitCell>User</th>
          <th bitCell>Options</th>
        </tr>
      </ng-container>
      <ng-template body>
        <tr bitRow>
          <td bitCell>Password Manager</td>
          <td bitCell>Everyone</td>
          <td bitCell>
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
        <tr bitRow>
          <td bitCell>Secrets Manager</td>
          <td bitCell>Developers</td>
          <td bitCell>
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
      </ng-template>
    </bit-table>
  `,
})
export class KitchenSinkTableComponent {}
