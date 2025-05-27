import { Component } from "@angular/core";

import { CollectionFilterComponent as BaseCollectionFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/collection-filter.component";

@Component({
  selector: "app-collection-filter",
  templateUrl: "collection-filter.component.html",
  standalone: false,
})
export class CollectionFilterComponent extends BaseCollectionFilterComponent {}
