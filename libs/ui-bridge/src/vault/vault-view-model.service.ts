import { computed, inject, Injectable } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CollectionService } from "@bitwarden/admin-console/common";
import { combineLatest, filter, firstValueFrom, map, switchMap } from "rxjs";

import {
  CollectionSummary,
  FolderSummary,
  ItemDetail,
  ItemKind,
  ItemSummary,
  VaultViewModel,
} from "./vault-view-model";

function cipherTypeToKind(type: CipherType): ItemKind {
  switch (type) {
    case CipherType.Login:
      return "login";
    case CipherType.Card:
      return "card";
    case CipherType.Identity:
      return "identity";
    case CipherType.SshKey:
      return "sshKey";
    default:
      return "note";
  }
}

function extractHostname(uri: string | undefined | null): string | undefined {
  if (!uri) return undefined;
  try {
    return new URL(uri).hostname;
  } catch {
    return uri.split("/")[0];
  }
}

function toSummary(c: CipherView, iconsUrl: string | null): ItemSummary {
  const kind = cipherTypeToKind(c.type);
  let subtitle: string | undefined;
  if (kind === "login") {
    subtitle = c.login?.username ?? c.login?.uri;
  } else if (kind === "card") {
    subtitle = c.card?.brand ? `${c.card.brand} •••• ${c.card.number?.slice(-4) ?? ""}` : undefined;
  } else if (kind === "identity") {
    subtitle = [c.identity?.firstName, c.identity?.lastName].filter(Boolean).join(" ") || undefined;
  } else if (kind === "sshKey") {
    subtitle = (c as any).sshKey?.fingerprint ?? undefined;
  }

  const host = extractHostname(c.login?.uri);
  const iconUrl = iconsUrl && host ? `${iconsUrl}/${host}/icon.png` : undefined;

  return {
    id: c.id,
    kind,
    title: c.name,
    subtitle,
    favorite: c.favorite,
    organizationId: c.organizationId ?? undefined,
    folderId: c.folderId ?? undefined,
    tagIds: c.collectionIds ?? [],
    iconKey: host,
    iconUrl,
    hasTotp: kind === "login" && !!c.login?.totp,
    revisionDate: c.revisionDate?.toISOString() ?? "",
  };
}

function toDetail(
  c: CipherView,
  iconsUrl: string | null,
  folderName?: string,
  collectionNames?: string[],
): ItemDetail {
  const summary = toSummary(c, iconsUrl);
  return {
    ...summary,
    username: c.login?.username ?? undefined,
    password: c.login?.password ?? undefined,
    uris: c.login?.uris?.map((u) => u.uri).filter((u): u is string => !!u),
    notes: c.notes ?? undefined,
    totpAvailable: summary.hasTotp,
    folderName,
    collectionNames: collectionNames?.length ? collectionNames : undefined,
    creationDate: c.revisionDate?.toISOString() ?? undefined,
  };
}

@Injectable({ providedIn: "root" })
export class VaultViewModelService implements VaultViewModel {
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly totpService = inject(TotpService);
  private readonly folderService = inject(FolderService);
  private readonly collectionService = inject(CollectionService);
  private readonly environmentService = inject(EnvironmentService);
  private readonly domainSettingsService = inject(DomainSettingsService);
  private readonly i18nService = inject(I18nService);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(
    filter((a) => a != null),
    getUserId,
  );

  private readonly iconsUrl$ = combineLatest([
    this.environmentService.environment$,
    this.domainSettingsService.showFavicons$,
  ]).pipe(map(([env, show]) => (show ? env.getIconsUrl() : null)));

  private readonly iconsUrl = toSignal(this.iconsUrl$, { initialValue: null });

  private readonly cipherViews = toSignal(
    this.activeUserId$.pipe(
      switchMap((userId) => this.cipherService.cipherViews$(userId)),
      map((views) => views ?? []),
    ),
    { initialValue: [] as CipherView[] },
  );

  private readonly summaries = computed<readonly ItemSummary[]>(() => {
    const url = this.iconsUrl();
    return this.cipherViews()
      .filter((c) => !c.deletedDate && !c.isDeleted)
      .map((c) => toSummary(c, url))
      .sort((a, b) => a.title.localeCompare(b.title));
  });

  private readonly trashed = computed<readonly ItemSummary[]>(() => {
    const url = this.iconsUrl();
    return this.cipherViews()
      .filter((c) => c.deletedDate || c.isDeleted)
      .map((c) => toSummary(c, url))
      .sort((a, b) => a.title.localeCompare(b.title));
  });

  private readonly folderViews = toSignal(
    this.activeUserId$.pipe(
      switchMap((userId) => this.folderService.folderViews$(userId)),
      map((folders) => folders ?? []),
    ),
    { initialValue: [] },
  );

  private readonly collectionViews = toSignal(
    this.activeUserId$.pipe(
      switchMap((userId) => this.collectionService.decryptedCollections$(userId)),
      map((cols) => cols ?? []),
    ),
    { initialValue: [] as any[] },
  );

  items(): readonly ItemSummary[] {
    return this.summaries();
  }

  trashedItems(): readonly ItemSummary[] {
    return this.trashed();
  }

  folders(): readonly FolderSummary[] {
    return this.folderViews()
      .filter((f) => f.id != null)
      .map((f) => ({ id: f.id!, name: f.name }));
  }

  collections(): readonly CollectionSummary[] {
    return this.collectionViews().map((c) => ({
      id: c.id,
      name: c.name,
      organizationId: c.organizationId,
    }));
  }

  t(key: string): string {
    return this.i18nService.t(key);
  }

  async getDetail(id: string): Promise<ItemDetail> {
    const userId = await firstValueFrom(this.activeUserId$);
    const url = await firstValueFrom(this.iconsUrl$);
    const all = await this.cipherService.getAllDecrypted(userId);
    const cipher = all.find((c) => c.id === id);
    if (!cipher) {
      throw new Error(`Cipher ${id} not found`);
    }

    let folderName: string | undefined;
    if (cipher.folderId) {
      const folders = await firstValueFrom(this.folderService.folderViews$(userId));
      const folder = folders?.find((f) => f.id === cipher.folderId);
      folderName = folder?.name;
    }

    let collectionNames: string[] | undefined;
    if (cipher.collectionIds?.length) {
      const collections = await firstValueFrom(this.collectionService.decryptedCollections$(userId));
      collectionNames = collections
        .filter((c) => cipher.collectionIds!.includes(c.id))
        .map((c) => c.name);
    }

    return toDetail(cipher, url, folderName, collectionNames);
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
