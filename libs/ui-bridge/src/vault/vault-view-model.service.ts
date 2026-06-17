import { computed, inject, Injectable, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { firstValueFrom, map, switchMap } from "rxjs";

import { ItemDetail, ItemKind, ItemSummary, VaultViewModel } from "./vault-view-model";

function cipherTypeToKind(type: CipherType): ItemKind {
  switch (type) {
    case CipherType.Login:
      return "login";
    case CipherType.Card:
      return "card";
    case CipherType.Identity:
      return "identity";
    default:
      return "note";
  }
}

function toSummary(c: CipherView): ItemSummary {
  const kind = cipherTypeToKind(c.type);
  let subtitle: string | undefined;
  if (kind === "login") {
    subtitle = c.login?.username ?? c.login?.uri;
  } else if (kind === "card") {
    subtitle = c.card?.brand ? `${c.card.brand} •••• ${c.card.number?.slice(-4) ?? ""}` : undefined;
  } else if (kind === "identity") {
    subtitle = [c.identity?.firstName, c.identity?.lastName].filter(Boolean).join(" ") || undefined;
  }

  return {
    id: c.id,
    kind,
    title: c.name,
    subtitle,
    favorite: c.favorite,
    organizationId: c.organizationId ?? undefined,
    tagIds: c.collectionIds ?? [],
    iconKey: kind === "login" ? c.login?.uri : undefined,
    hasTotp: kind === "login" && !!c.login?.totp,
    revisionDate: c.revisionDate?.toISOString() ?? "",
  };
}

function toDetail(c: CipherView): ItemDetail {
  const summary = toSummary(c);
  return {
    ...summary,
    username: c.login?.username ?? undefined,
    password: c.login?.password ?? undefined,
    uris: c.login?.uris?.map((u) => u.uri).filter((u): u is string => !!u),
    notes: c.notes ?? undefined,
    totpAvailable: summary.hasTotp,
  };
}

@Injectable({ providedIn: "root" })
export class VaultViewModelService implements VaultViewModel {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly totpService = inject(TotpService);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly cipherViews = toSignal(
    this.activeUserId$.pipe(
      switchMap((userId) => this.cipherService.cipherViews$(userId)),
      map((views) => views ?? []),
    ),
    { initialValue: [] as CipherView[] },
  );

  private readonly summaries = computed<readonly ItemSummary[]>(() =>
    this.cipherViews()
      .filter((c) => !c.deletedDate && !c.isDeleted)
      .map(toSummary)
      .sort((a, b) => a.title.localeCompare(b.title)),
  );

  items(): readonly ItemSummary[] {
    return this.summaries();
  }

  async getDetail(id: string): Promise<ItemDetail> {
    const userId = await firstValueFrom(this.activeUserId$);
    const all = await this.cipherService.getAllDecrypted(userId);
    const cipher = all.find((c) => c.id === id);
    if (!cipher) {
      throw new Error(`Cipher ${id} not found`);
    }
    return toDetail(cipher);
  }

  async save(detail: ItemDetail): Promise<void> {
    const userId = await firstValueFrom(this.activeUserId$);
    const all = await this.cipherService.getAllDecrypted(userId);
    const cipher = all.find((c) => c.id === detail.id);
    if (!cipher) {
      throw new Error(`Cipher ${detail.id} not found`);
    }

    cipher.name = detail.title;
    cipher.notes = detail.notes ?? null;
    cipher.favorite = detail.favorite;

    if (cipher.login && cipher.type === CipherType.Login) {
      cipher.login.username = detail.username ?? null;
      cipher.login.password = detail.password ?? null;
    }

    await this.cipherService.updateWithServer(cipher, userId);
  }

  async toggleFavorite(id: string): Promise<void> {
    const userId = await firstValueFrom(this.activeUserId$);
    const all = await this.cipherService.getAllDecrypted(userId);
    const cipher = all.find((c) => c.id === id);
    if (!cipher) {
      throw new Error(`Cipher ${id} not found`);
    }
    cipher.favorite = !cipher.favorite;
    await this.cipherService.updateWithServer(cipher, userId);
  }

  async getTotpCode(id: string): Promise<{ code: string; period: number } | null> {
    const userId = await firstValueFrom(this.activeUserId$);
    const all = await this.cipherService.getAllDecrypted(userId);
    const cipher = all.find((c) => c.id === id);
    if (!cipher?.login?.totp) {
      return null;
    }
    const response = await firstValueFrom(this.totpService.getCode$(cipher.login.totp));
    return { code: response.code, period: response.period };
  }
}
