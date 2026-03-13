import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { mockI18n } from "../lit-stories/mock-data";
import { ButtonRow } from "../rows/button-row";

import { NotificationButtonRow } from "./button-row";

jest.mock("lit", () => ({
  html: jest.fn((_strings: TemplateStringsArray, ...values: any[]) => values),
}));
jest.mock("../icons", () => ({
  Business: jest.fn(),
  Family: jest.fn(),
  Folder: jest.fn(),
  User: jest.fn(),
  CollectionShared: jest.fn(),
}));
jest.mock("../rows/button-row", () => ({ ButtonRow: jest.fn() }));
jest.mock("../signals/selected-folder", () => ({
  selectedFolder: { get: jest.fn(() => "0"), set: jest.fn() },
}));
jest.mock("../signals/selected-vault", () => ({
  selectedVault: { get: jest.fn(() => "0"), set: jest.fn() },
}));
jest.mock("../signals/selected-collection", () => ({
  selectedCollection: { get: jest.fn(() => "0"), set: jest.fn() },
}));

describe("NotificationButtonRow", () => {
  const defaultProps = {
    i18n: mockI18n,
    primaryButton: {
      text: "Save",
      handlePrimaryButtonClick: jest.fn(),
    },
    personalVaultIsAllowed: true,
    theme: ThemeTypes.Light,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("folder options", () => {
    it("marks the No Folder option as default when its id is an empty string", () => {
      const folders = [
        { id: "folder-uuid", name: "Alpha" },
        { id: "", name: "No Folder" },
      ];

      NotificationButtonRow({ ...defaultProps, folders });

      const { selectButtons } = (ButtonRow as jest.Mock).mock.calls[0][0];
      const folderSelectButton = selectButtons.find((b: any) => b.id === "folder");
      const noFolderOption = folderSelectButton.options.find((o: any) => o.text === "No Folder");

      expect(noFolderOption.default).toBe(true);
      expect(noFolderOption.value).toBe("0");
    });

    it("does not mark real folders as default", () => {
      const folders = [
        { id: "folder-uuid", name: "Alpha" },
        { id: "", name: "No Folder" },
      ];

      NotificationButtonRow({ ...defaultProps, folders });

      const { selectButtons } = (ButtonRow as jest.Mock).mock.calls[0][0];
      const folderSelectButton = selectButtons.find((b: any) => b.id === "folder");
      const alphaOption = folderSelectButton.options.find((o: any) => o.text === "Alpha");

      expect(alphaOption.default).toBe(false);
      expect(alphaOption.value).toBe("folder-uuid");
    });
  });
});
