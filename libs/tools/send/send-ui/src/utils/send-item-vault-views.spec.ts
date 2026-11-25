import { SendItemMetadataView } from "@bitwarden/common/tools/send/models/view/send-item-metadata.view";
import { SendItemView } from "@bitwarden/common/tools/send/models/view/send-item.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { toSendItemVaultViews } from "./send-item-vault-views";

describe("toSendItemVaultViews", () => {
  function createSendItem(metadata?: Partial<SendItemMetadataView>): SendItemView {
    const sendItem = new SendItemView();
    sendItem.data = new CipherView();
    sendItem.data.id = "cipher-id";
    sendItem.data.name = "Item name";
    sendItem.metadata = Object.assign(new SendItemMetadataView(), metadata);
    return sendItem;
  }

  it("returns empty views when there is no item", () => {
    expect(toSendItemVaultViews(null)).toEqual({});
    expect(toSendItemVaultViews(undefined)).toEqual({});
  });

  it("returns only the cipher when the metadata has no folder, organization or collections", () => {
    const views = toSendItemVaultViews(createSendItem());

    expect(views.cipher?.id).toBe("cipher-id");
    expect(views.cipher?.folderId).toBeUndefined();
    expect(views.cipher?.organizationId).toBeUndefined();
    expect(views.cipher?.collectionIds).toEqual([]);
    expect(views.folder).toBeUndefined();
    expect(views.organization).toBeUndefined();
    expect(views.collections).toBeUndefined();
  });

  it("links the folder, organization and collections to the cipher", () => {
    const views = toSendItemVaultViews(
      createSendItem({
        folderName: "Work",
        organizationName: "Acme",
        collectionNames: ["Engineering", "Finance"],
      }),
    );

    expect(views.folder?.name).toBe("Work");
    expect(views.organization?.name).toBe("Acme");
    expect(views.collections?.map((c) => c.name)).toEqual(["Engineering", "Finance"]);

    expect(views.cipher?.folderId).toBe(views.folder?.id);
    expect(views.cipher?.organizationId).toBe(views.organization?.id);
    expect(views.cipher?.collectionIds).toEqual(views.collections?.map((c) => c.id));
    views.collections?.forEach((collection) => {
      expect(collection.organizationId).toBe(views.organization?.id);
    });
  });

  it("does not mutate the source cipher", () => {
    const sendItem = createSendItem({ folderName: "Work", organizationName: "Acme" });

    const views = toSendItemVaultViews(sendItem);

    expect(views.cipher).not.toBe(sendItem.data);
    expect(sendItem.data?.folderId).toBeUndefined();
    expect(sendItem.data?.organizationId).toBeUndefined();
  });
});
