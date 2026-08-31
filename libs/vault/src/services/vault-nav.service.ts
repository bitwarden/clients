import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { VaultsNavViewModel } from "../models/vault-nav-view-model";

export abstract class VaultNavService {
  /**
   * The vaults the side nav offers the given user, and how they are presented.
   *
   * Takes the user rather than resolving the active account itself so that a caller reading other
   * per-user state alongside it — `vaultScopeGuard` reads the user's collections — pins both to the
   * one account it resolved. Two streams that each resolve the active account can straddle an
   * account switch and pair one user's vaults with another user's collections.
   */
  abstract viewModel$(userId: UserId): Observable<VaultsNavViewModel>;
}
