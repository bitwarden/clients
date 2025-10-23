import { Component } from "@angular/core";

import { CollectionFilterComponent as BaseCollectionFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/collection-filter.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-collection-filter",
  templateUrl: "collection-filter.component.html",
  standalone: false,
})
export class CollectionFilterComponent extends BaseCollectionFilterComponent {}
