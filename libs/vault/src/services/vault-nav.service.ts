import { Observable } from "rxjs";

import { VaultsNavViewModel } from "../models/vault-nav-view-model";

export abstract class VaultNavService {
  abstract readonly viewModel$: Observable<VaultsNavViewModel>;
}
