import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherShareAccessService } from "./cipher-share-access.service";
import { ShareItemService } from "./share-item.service";
import { ShareLinkService } from "./share-link.service";

describe("CipherShareAccessService", () => {
  let service: CipherShareAccessService;
  let shareLinkService: MockProxy<ShareLinkService>;
  let shareItemService: MockProxy<ShareItemService>;
  let canBeShared: BehaviorSubject<boolean>;

  const cipher = Object.assign(new CipherView(), { id: "cipher-id", name: "item" });

  /** Lets the deferred tracking microtask run and its answer land. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    canBeShared = new BehaviorSubject(true);
    shareLinkService = mock<ShareLinkService>();
    shareLinkService.cipherCanBeShared$.mockReturnValue(canBeShared.asObservable());
    shareItemService = mock<ShareItemService>();

    TestBed.configureTestingModule({
      providers: [
        { provide: ShareLinkService, useValue: shareLinkService },
        { provide: ShareItemService, useValue: shareItemService },
      ],
    });
    service = TestBed.inject(CipherShareAccessService);
  });

  describe("canShare", () => {
    it("is false until the share check has resolved", async () => {
      expect(service.canShare(cipher)).toBe(false);

      await settle();

      expect(service.canShare(cipher)).toBe(true);
    });

    it("reflects the latest answer from cipherCanBeShared$", async () => {
      service.canShare(cipher);
      await settle();

      canBeShared.next(false);

      expect(service.canShare(cipher)).toBe(false);
    });

    it("checks each cipher on its own", async () => {
      const other = Object.assign(new CipherView(), { id: "other-id", name: "other" });
      service.canShare(cipher);
      service.canShare(other);
      await settle();

      expect(shareLinkService.cipherCanBeShared$).toHaveBeenCalledTimes(2);
    });

    it("subscribes once per cipher, however often it is read", async () => {
      service.canShare(cipher);
      await settle();
      service.canShare(cipher);
      service.canShare(cipher);
      await settle();

      expect(shareLinkService.cipherCanBeShared$).toHaveBeenCalledTimes(1);
    });

    it("stops watching the least-recently-read cipher once the cap is exceeded", async () => {
      const ciphers = Array.from({ length: 201 }, (_, i) =>
        Object.assign(new CipherView(), { id: `cipher-${i}`, name: `item ${i}` }),
      );
      ciphers.forEach((c) => service.canShare(c));
      await settle();

      // cipher-0 was the least recently read, so it was evicted and its answer dropped.
      service.canShare(ciphers[0]);
      await settle();

      expect(shareLinkService.cipherCanBeShared$).toHaveBeenCalledTimes(202);
    });

    it("keeps a cipher that was read recently when the cap is exceeded", async () => {
      const ciphers = Array.from({ length: 200 }, (_, i) =>
        Object.assign(new CipherView(), { id: `cipher-${i}`, name: `item ${i}` }),
      );
      ciphers.forEach((c) => service.canShare(c));
      await settle();

      // Touch cipher-0 so cipher-1 becomes the least recently read, then overflow by one.
      service.canShare(ciphers[0]);
      await settle();
      service.canShare(Object.assign(new CipherView(), { id: "overflow", name: "overflow" }));
      await settle();

      // Still watched, so reading it again does not subscribe a second time: 200 + overflow = 201.
      service.canShare(ciphers[0]);
      await settle();
      expect(shareLinkService.cipherCanBeShared$).toHaveBeenCalledTimes(201);
    });

    it("is false for a cipher without an id", async () => {
      const unsaved = new CipherView();

      expect(service.canShare(unsaved)).toBe(false);
      await settle();

      expect(shareLinkService.cipherCanBeShared$).not.toHaveBeenCalled();
    });
  });

  describe("share", () => {
    it("runs the same share flow as the share link directive", async () => {
      await service.share(cipher);

      expect(shareItemService.share).toHaveBeenCalledWith(cipher);
    });
  });
});
