import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

import { CipherId } from "@bitwarden/common/types/guid";

/**
 * Represents an active share link created for a vault item.
 */
export interface ShareLink {
  id: string;
  cipherId: CipherId;
  emails: string[];
  expiresAt: Date;
  oneTimeShare: boolean;
  url: string;
}

/**
 * Stub service for managing share links.
 * Uses in-memory state until the backend API is available.
 */
@Injectable({ providedIn: "root" })
export class ShareLinkService {
  private nextId = 3;
  private links = new BehaviorSubject<ShareLink[]>([
    {
      id: "share-link-0",
      cipherId: "mock-cipher-id" as CipherId,
      emails: ["sgamgee@shire.com", "fbaggins@shire.com", "mbrands@shire.com", "ppippin@shire.com"],
      expiresAt: new Date("2026-06-03"),
      oneTimeShare: false,
      url: "https://vault.bitwarden.com/share/share-link-0",
    },
    {
      id: "share-link-1",
      cipherId: "mock-cipher-id" as CipherId,
      emails: ["sauron@mordor.com"],
      expiresAt: new Date("2026-05-26"),
      oneTimeShare: true,
      url: "https://vault.bitwarden.com/share/share-link-1",
    },
  ]);

  /** Observable of all active share links. */
  readonly links$ = this.links.asObservable();

  /**
   * Creates a new share link with mock data.
   *
   * @param cipherId - The cipher to share
   * @param emails - Comma-delimited email addresses
   * @param expiryHours - Number of hours until expiry
   * @param oneTimeShare - Whether the link can only be viewed once
   * @returns The created share link
   */
  async createShareLink(
    cipherId: CipherId,
    emails: string[],
    expiryHours: number,
    oneTimeShare: boolean,
  ): Promise<ShareLink> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

    const id = `share-link-${this.nextId++}`;
    const link: ShareLink = {
      id,
      cipherId,
      emails,
      expiresAt,
      oneTimeShare,
      url: `https://vault.bitwarden.com/share/${id}`,
    };

    const current = this.links.getValue();
    this.links.next([...current, link]);

    return link;
  }

  /**
   * Returns active share links for a given cipher.
   */
  getLinksForCipher(_cipherId: CipherId): ShareLink[] {
    return this.links.getValue();
  }

  /**
   * Deletes a share link by id.
   */
  async deleteLink(linkId: string): Promise<void> {
    const current = this.links.getValue();
    this.links.next(current.filter((l) => l.id !== linkId));
  }
}
