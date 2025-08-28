import { CipherListView } from "@bitwarden/sdk-internal";

import { CipherType } from "../enums";
import { Attachment } from "../models/domain/attachment";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";
import { Fido2CredentialView } from "../models/view/fido2-credential.view";
import { IdentityView } from "../models/view/identity.view";
import { LoginUriView } from "../models/view/login-uri.view";
import { LoginView } from "../models/view/login.view";

import { CipherViewLikeUtils } from "./cipher-view-like-utils";

describe("CipherViewLikeUtils", () => {
  const createCipherView = (type: CipherType = CipherType.Login): CipherView => {
    const cipherView = new CipherView();
    // Always set a type to avoid issues within `CipherViewLikeUtils`
    cipherView.type = type;

    return cipherView;
  };

  describe("isCipherListView", () => {
    it("returns true when the cipher is a CipherListView", () => {
      const cipherListViewLogin = {
        type: {
          login: {},
        },
      } as CipherListView;
      const cipherListViewSshKey = {
        type: "sshKey",
      } as CipherListView;

      expect(CipherViewLikeUtils.isCipherListView(cipherListViewLogin)).toBe(true);
      expect(CipherViewLikeUtils.isCipherListView(cipherListViewSshKey)).toBe(true);
    });

    it("returns false when the cipher is not a CipherListView", () => {
      const cipherView = createCipherView();
      cipherView.type = CipherType.SecureNote;

      expect(CipherViewLikeUtils.isCipherListView(cipherView)).toBe(false);
    });
  });

  describe("getLogin", () => {
    it("returns null when the cipher is not a login", () => {
      const cipherView = createCipherView(CipherType.SecureNote);

      expect(CipherViewLikeUtils.getLogin(cipherView)).toBeNull();
      expect(CipherViewLikeUtils.getLogin({ type: "identity" } as CipherListView)).toBeNull();
    });

    describe("CipherView", () => {
      it("returns the login object", () => {
        const cipherView = createCipherView(CipherType.Login);

        expect(CipherViewLikeUtils.getLogin(cipherView)).toEqual(cipherView.login);
      });
    });

    describe("CipherListView", () => {
      it("returns the login object", () => {
        const cipherListView = {
          type: {
            login: {
              username: "testuser",
              hasFido2: false,
            },
          },
        } as CipherListView;

        expect(CipherViewLikeUtils.getLogin(cipherListView)).toEqual(
          (cipherListView.type as any).login,
        );
      });
    });
  });

  describe("getCard", () => {
    it("returns null when the cipher is not a card", () => {
      const cipherView = createCipherView(CipherType.SecureNote);

      expect(CipherViewLikeUtils.getCard(cipherView)).toBeNull();
      expect(CipherViewLikeUtils.getCard({ type: "identity" } as CipherListView)).toBeNull();
    });

    describe("CipherView", () => {
      it("returns the card object", () => {
        const cipherView = createCipherView(CipherType.Card);

        expect(CipherViewLikeUtils.getCard(cipherView)).toEqual(cipherView.card);
      });
    });

    describe("CipherListView", () => {
      it("returns the card object", () => {
        const cipherListView = {
          type: {
            card: {
              brand: "Visa",
            },
          },
        } as CipherListView;

        expect(CipherViewLikeUtils.getCard(cipherListView)).toEqual(
          (cipherListView.type as any).card,
        );
      });
    });
  });

  describe("isArchived", () => {
    it("returns true when the cipher is archived", () => {
      const cipherListView = {
        id: "1",
        archivedDate: "2024-02-02",
        type: "identity",
      } as CipherListView;
      const cipherView = createCipherView();
      cipherView.archivedDate = new Date();

      expect(CipherViewLikeUtils.isArchived(cipherListView)).toBe(true);
      expect(CipherViewLikeUtils.isArchived(cipherView)).toBe(true);
    });

    it("returns false when the cipher is not archived", () => {
      const cipherListView = {
        id: "2",
        type: "identity",
      } as CipherListView;
      const cipherView = createCipherView();

      expect(CipherViewLikeUtils.isArchived(cipherListView)).toBe(false);
      expect(CipherViewLikeUtils.isArchived(cipherView)).toBe(false);
    });
  });

  describe("isDeleted", () => {
    it("returns true when the cipher is deleted", () => {
      const cipherListView = { deletedDate: "2024-02-02", type: "identity" } as CipherListView;
      const cipherView = createCipherView();
      cipherView.deletedDate = new Date();

      expect(CipherViewLikeUtils.isDeleted(cipherListView)).toBe(true);
      expect(CipherViewLikeUtils.isDeleted(cipherView)).toBe(true);
    });

    it("returns false when the cipher is not deleted", () => {
      const cipherListView = { deletedDate: undefined, type: "identity" } as CipherListView;
      const cipherView = createCipherView();

      expect(CipherViewLikeUtils.isDeleted(cipherListView)).toBe(false);
      expect(CipherViewLikeUtils.isDeleted(cipherView)).toBe(false);
    });
  });

  describe("canAssignToCollections", () => {
    describe("CipherView", () => {
      let cipherView: CipherView;

      beforeEach(() => {
        cipherView = createCipherView();
      });

      it("returns true when the cipher is not assigned to an organization", () => {
        expect(CipherViewLikeUtils.canAssignToCollections(cipherView)).toBe(true);
      });

      it("returns false when the cipher is assigned to an organization and cannot be edited", () => {
        cipherView.organizationId = "org-id";
        cipherView.edit = false;
        cipherView.viewPassword = false;

        expect(CipherViewLikeUtils.canAssignToCollections(cipherView)).toBe(false);
      });

      it("returns true when the cipher is assigned to an organization and can be edited", () => {
        cipherView.organizationId = "org-id";
        cipherView.edit = true;
        cipherView.viewPassword = true;

        expect(CipherViewLikeUtils.canAssignToCollections(cipherView)).toBe(true);
      });
    });

    describe("CipherListView", () => {
      let cipherListView: CipherListView;

      beforeEach(() => {
        cipherListView = {
          organizationId: undefined,
          edit: false,
          viewPassword: false,
          type: { login: {} },
        } as CipherListView;
      });

      it("returns true when the cipher is not assigned to an organization", () => {
        expect(CipherViewLikeUtils.canAssignToCollections(cipherListView)).toBe(true);
      });

      it("returns false when the cipher is assigned to an organization and cannot be edited", () => {
        cipherListView.organizationId = "org-id";

        expect(CipherViewLikeUtils.canAssignToCollections(cipherListView)).toBe(false);
      });

      it("returns true when the cipher is assigned to an organization and can be edited", () => {
        cipherListView.organizationId = "org-id";
        cipherListView.edit = true;
        cipherListView.viewPassword = true;

        expect(CipherViewLikeUtils.canAssignToCollections(cipherListView)).toBe(true);
      });
    });
  });

  describe("getType", () => {
    describe("CipherView", () => {
      it("returns the type of the cipher", () => {
        const cipherView = createCipherView();
        cipherView.type = CipherType.Login;

        expect(CipherViewLikeUtils.getType(cipherView)).toBe(CipherType.Login);

        cipherView.type = CipherType.SecureNote;
        expect(CipherViewLikeUtils.getType(cipherView)).toBe(CipherType.SecureNote);

        cipherView.type = CipherType.SshKey;
        expect(CipherViewLikeUtils.getType(cipherView)).toBe(CipherType.SshKey);

        cipherView.type = CipherType.Identity;
        expect(CipherViewLikeUtils.getType(cipherView)).toBe(CipherType.Identity);

        cipherView.type = CipherType.Card;
        expect(CipherViewLikeUtils.getType(cipherView)).toBe(CipherType.Card);
      });
    });

    describe("CipherListView", () => {
      it("converts the `CipherViewListType` to `CipherType`", () => {
        const cipherListView = {
          type: { login: {} },
        } as CipherListView;

        expect(CipherViewLikeUtils.getType(cipherListView)).toBe(CipherType.Login);

        cipherListView.type = { card: { brand: "Visa" } };
        expect(CipherViewLikeUtils.getType(cipherListView)).toBe(CipherType.Card);

        cipherListView.type = "sshKey";
        expect(CipherViewLikeUtils.getType(cipherListView)).toBe(CipherType.SshKey);

        cipherListView.type = "identity";
        expect(CipherViewLikeUtils.getType(cipherListView)).toBe(CipherType.Identity);

        cipherListView.type = "secureNote";
        expect(CipherViewLikeUtils.getType(cipherListView)).toBe(CipherType.SecureNote);
      });
    });
  });

  describe("subtitle", () => {
    describe("CipherView", () => {
      it("returns the subtitle of the cipher", () => {
        const cipherView = createCipherView();
        cipherView.login = new LoginView();
        cipherView.login.username = "Test Username";

        expect(CipherViewLikeUtils.subtitle(cipherView)).toBe("Test Username");
      });
    });

    describe("CipherListView", () => {
      it("returns the subtitle of the cipher", () => {
        const cipherListView = {
          subtitle: "Test Subtitle",
          type: "identity",
        } as CipherListView;

        expect(CipherViewLikeUtils.subtitle(cipherListView)).toBe("Test Subtitle");
      });
    });
  });

  describe("hasAttachments", () => {
    describe("CipherView", () => {
      it("returns true when the cipher has attachments", () => {
        const cipherView = createCipherView();
        cipherView.attachments = [new AttachmentView({ id: "1" } as Attachment)];

        expect(CipherViewLikeUtils.hasAttachments(cipherView)).toBe(true);
      });

      it("returns false when the cipher has no attachments", () => {
        const cipherView = new CipherView();
        (cipherView.attachments as any) = null;

        expect(CipherViewLikeUtils.hasAttachments(cipherView)).toBe(false);
      });
    });

    describe("CipherListView", () => {
      it("returns true when there are attachments", () => {
        const cipherListView = { attachments: 1, type: "secureNote" } as CipherListView;

        expect(CipherViewLikeUtils.hasAttachments(cipherListView)).toBe(true);
      });

      it("returns false when there are no attachments", () => {
        const cipherListView = { attachments: 0, type: "secureNote" } as CipherListView;

        expect(CipherViewLikeUtils.hasAttachments(cipherListView)).toBe(false);
      });
    });
  });

  describe("canLaunch", () => {
    it("returns false when the cipher is not a login", () => {
      const cipherView = createCipherView(CipherType.SecureNote);

      expect(CipherViewLikeUtils.canLaunch(cipherView)).toBe(false);
      expect(CipherViewLikeUtils.canLaunch({ type: "identity" } as CipherListView)).toBe(false);
    });

    describe("CipherView", () => {
      it("returns true when the login has URIs that can be launched", () => {
        const cipherView = createCipherView(CipherType.Login);
        cipherView.login = new LoginView();
        cipherView.login.uris = [{ uri: "https://example.com" } as LoginUriView];

        expect(CipherViewLikeUtils.canLaunch(cipherView)).toBe(true);
      });

      it("returns true when the uri does not have a protocol", () => {
        const cipherView = createCipherView(CipherType.Login);
        cipherView.login = new LoginView();
        const uriView = new LoginUriView();
        uriView.uri = "bitwarden.com";
        cipherView.login.uris = [uriView];

        expect(CipherViewLikeUtils.canLaunch(cipherView)).toBe(true);
      });

      it("returns false when the login has no URIs", () => {
        const cipherView = createCipherView(CipherType.Login);
        cipherView.login = new LoginView();

        expect(CipherViewLikeUtils.canLaunch(cipherView)).toBe(false);
      });
    });

    describe("CipherListView", () => {
      it("returns true when the login has URIs that can be launched", () => {
        const cipherListView = {
          type: { login: { uris: [{ uri: "https://example.com" }] } },
        } as CipherListView;

        expect(CipherViewLikeUtils.canLaunch(cipherListView)).toBe(true);
      });

      it("returns true when the uri does not have a protocol", () => {
        const cipherListView = {
          type: { login: { uris: [{ uri: "bitwarden.com" }] } },
        } as CipherListView;

        expect(CipherViewLikeUtils.canLaunch(cipherListView)).toBe(true);
      });

      it("returns false when the login has no URIs", () => {
        const cipherListView = { type: { login: {} } } as CipherListView;

        expect(CipherViewLikeUtils.canLaunch(cipherListView)).toBe(false);
      });
    });
  });

  describe("getLaunchUri", () => {
    it("returns undefined when the cipher is not a login", () => {
      const cipherView = createCipherView(CipherType.SecureNote);

      expect(CipherViewLikeUtils.getLaunchUri(cipherView)).toBeUndefined();
      expect(
        CipherViewLikeUtils.getLaunchUri({ type: "identity" } as CipherListView),
      ).toBeUndefined();
    });

    describe("CipherView", () => {
      it("returns the first launch-able URI", () => {
        const cipherView = createCipherView(CipherType.Login);
        cipherView.login = new LoginView();
        cipherView.login.uris = [
          { uri: "" } as LoginUriView,
          { uri: "https://example.com" } as LoginUriView,
          { uri: "https://another.com" } as LoginUriView,
        ];

        expect(CipherViewLikeUtils.getLaunchUri(cipherView)).toBe("https://example.com");
      });

      it("returns undefined when there are no URIs", () => {
        const cipherView = createCipherView(CipherType.Login);
        cipherView.login = new LoginView();

        expect(CipherViewLikeUtils.getLaunchUri(cipherView)).toBeUndefined();
      });

      it("appends protocol when there are none", () => {
        const cipherView = createCipherView(CipherType.Login);
        cipherView.login = new LoginView();
        const uriView = new LoginUriView();
        uriView.uri = "bitwarden.com";
        cipherView.login.uris = [uriView];

        expect(CipherViewLikeUtils.getLaunchUri(cipherView)).toBe("http://bitwarden.com");
      });
    });

    describe("CipherListView", () => {
      it("returns the first launch-able URI", () => {
        const cipherListView = {
          type: { login: { uris: [{ uri: "" }, { uri: "https://example.com" }] } },
        } as CipherListView;

        expect(CipherViewLikeUtils.getLaunchUri(cipherListView)).toBe("https://example.com");
      });

      it("returns undefined when there are no URIs", () => {
        const cipherListView = { type: { login: {} } } as CipherListView;

        expect(CipherViewLikeUtils.getLaunchUri(cipherListView)).toBeUndefined();
      });
    });
  });

  describe("matchesUri", () => {
    const emptySet = new Set<string>();

    it("returns false when the cipher is not a login", () => {
      const cipherView = createCipherView(CipherType.SecureNote);

      expect(CipherViewLikeUtils.matchesUri(cipherView, "https://example.com", emptySet)).toBe(
        false,
      );
    });

    describe("CipherView", () => {
      it("returns true when the URI matches", () => {
        const cipherView = createCipherView(CipherType.Login);
        cipherView.login = new LoginView();
        const uri = new LoginUriView();
        uri.uri = "https://example.com";
        cipherView.login.uris = [uri];

        expect(CipherViewLikeUtils.matchesUri(cipherView, "https://example.com", emptySet)).toBe(
          true,
        );
      });

      it("returns false when the URI does not match", () => {
        const cipherView = createCipherView(CipherType.Login);
        cipherView.login = new LoginView();
        const uri = new LoginUriView();
        uri.uri = "https://www.bitwarden.com";
        cipherView.login.uris = [uri];

        expect(
          CipherViewLikeUtils.matchesUri(cipherView, "https://www.another.com", emptySet),
        ).toBe(false);
      });
    });

    describe("CipherListView", () => {
      it("returns true when the URI matches", () => {
        const cipherListView = {
          type: { login: { uris: [{ uri: "https://example.com" }] } },
        } as CipherListView;

        expect(
          CipherViewLikeUtils.matchesUri(cipherListView, "https://example.com", emptySet),
        ).toBe(true);
      });

      it("returns false when the URI does not match", () => {
        const cipherListView = {
          type: { login: { uris: [{ uri: "https://bitwarden.com" }] } },
        } as CipherListView;

        expect(
          CipherViewLikeUtils.matchesUri(cipherListView, "https://another.com", emptySet),
        ).toBe(false);
      });
    });
  });

  describe("hasCopyableValue", () => {
    describe("CipherView", () => {
      it("returns true for login fields", () => {
        const cipherView = createCipherView(CipherType.Login);
        cipherView.login = new LoginView();
        cipherView.login.username = "testuser";
        cipherView.login.password = "testpass";

        expect(CipherViewLikeUtils.hasCopyableValue(cipherView, "username")).toBe(true);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherView, "password")).toBe(true);
      });

      it("returns true for card fields", () => {
        const cipherView = createCipherView(CipherType.Card);
        cipherView.card = { number: "1234-5678-9012-3456", code: "123" } as any;

        expect(CipherViewLikeUtils.hasCopyableValue(cipherView, "cardNumber")).toBe(true);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherView, "securityCode")).toBe(true);
      });

      it("returns true for identity fields", () => {
        const cipherView = createCipherView(CipherType.Identity);
        cipherView.identity = new IdentityView();
        cipherView.identity.email = "example@bitwarden.com";
        cipherView.identity.phone = "123-456-7890";

        expect(CipherViewLikeUtils.hasCopyableValue(cipherView, "email")).toBe(true);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherView, "phone")).toBe(true);
      });

      it("returns false when values are not populated", () => {
        const cipherView = createCipherView(CipherType.Login);

        expect(CipherViewLikeUtils.hasCopyableValue(cipherView, "email")).toBe(false);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherView, "password")).toBe(false);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherView, "securityCode")).toBe(false);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherView, "username")).toBe(false);
      });
    });

    describe("CipherListView", () => {
      it("returns true for copyable fields in a login cipher", () => {
        const cipherListView = {
          type: { login: { username: "testuser" } },
          copyableFields: ["LoginUsername", "LoginPassword"],
        } as CipherListView;

        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "username")).toBe(true);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "password")).toBe(true);
      });

      it("returns true for copyable fields in a card cipher", () => {
        const cipherListView = {
          type: { card: { brand: "MasterCard" } },
          copyableFields: ["CardNumber", "CardSecurityCode"],
        } as CipherListView;

        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "cardNumber")).toBe(true);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "securityCode")).toBe(true);
      });

      it("returns true for copyable fields in an sshKey ciphers", () => {
        const cipherListView = {
          type: "sshKey",
          copyableFields: ["SshKey"],
        } as CipherListView;

        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "privateKey")).toBe(true);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "publicKey")).toBe(true);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "keyFingerprint")).toBe(true);
      });

      it("returns true for copyable fields in an identity cipher", () => {
        const cipherListView = {
          type: "identity",
          copyableFields: ["IdentityUsername", "IdentityEmail", "IdentityPhone"],
        } as CipherListView;

        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "username")).toBe(true);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "email")).toBe(true);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "phone")).toBe(true);
      });

      it("returns false for when missing a field", () => {
        const cipherListView = {
          type: { login: {} },
          copyableFields: ["LoginUsername"],
        } as CipherListView;

        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "password")).toBe(false);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "phone")).toBe(false);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "address")).toBe(false);
        expect(CipherViewLikeUtils.hasCopyableValue(cipherListView, "publicKey")).toBe(false);
      });
    });
  });

  describe("hasFido2Credentials", () => {
    describe("CipherView", () => {
      it("returns true when the login has FIDO2 credentials", () => {
        const cipherView = createCipherView(CipherType.Login);
        cipherView.login = new LoginView();
        cipherView.login.fido2Credentials = [new Fido2CredentialView()];

        expect(CipherViewLikeUtils.hasFido2Credentials(cipherView)).toBe(true);
      });

      it("returns false when the login has no FIDO2 credentials", () => {
        const cipherView = createCipherView(CipherType.Login);
        cipherView.login = new LoginView();

        expect(CipherViewLikeUtils.hasFido2Credentials(cipherView)).toBe(false);
      });
    });

    describe("CipherListView", () => {
      it("returns true when the login has FIDO2 credentials", () => {
        const cipherListView = {
          type: { login: { fido2Credentials: [{ credentialId: "fido2-1" }] } },
        } as CipherListView;

        expect(CipherViewLikeUtils.hasFido2Credentials(cipherListView)).toBe(true);
      });

      it("returns false when the login has no FIDO2 credentials", () => {
        const cipherListView = { type: { login: {} } } as CipherListView;

        expect(CipherViewLikeUtils.hasFido2Credentials(cipherListView)).toBe(false);
      });
    });
  });

  describe("decryptionFailure", () => {
    it("returns true when the cipher has a decryption failure", () => {
      const cipherView = createCipherView();
      cipherView.decryptionFailure = true;

      expect(CipherViewLikeUtils.decryptionFailure(cipherView)).toBe(true);
    });

    it("returns false when the cipher does not have a decryption failure", () => {
      const cipherView = createCipherView();
      cipherView.decryptionFailure = false;

      expect(CipherViewLikeUtils.decryptionFailure(cipherView)).toBe(false);
    });

    it("returns false when the cipher is a CipherListView without decryptionFailure", () => {
      const cipherListView = { type: "secureNote" } as CipherListView;

      expect(CipherViewLikeUtils.decryptionFailure(cipherListView)).toBe(false);
    });
  });
});
