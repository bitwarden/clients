import { CipherType } from "../../../../vault/enums";
import { Type } from "../../data";
import { Achievement, AchievementId, MetricId } from "../../types";

/**
 * Creates the ability to add configs for different achievements at
 * defined thresholds for items created in the vault. Creating the config
 * with no cipher type is used for validations where the type is not needed
 */
export class ItemCreatedCountConfig implements Achievement {
  // Define the achievements here
  static readonly AllConfigs: ItemCreatedCountConfig[] = [
    // Any vault items added
    new ItemCreatedCountConfig(
      "vault-item-created",
      "The chosen one",
      "Saved your first item to Bitwarden",
      0,
      1,
    ),
    new ItemCreatedCountConfig(
      "vault-items-created-ten",
      "A decade of security",
      "Saved your 10th item to Bitwarden",
      1,
      10,
    ),
    new ItemCreatedCountConfig(
      "vault-items-created-fifty",
      "It's 50/50",
      "Saved your 50th item to Bitwarden",
      10,
      50,
    ),
    new ItemCreatedCountConfig(
      "vault-items-created-one-hundred",
      "Century mark, Now you are thinking with ciphers",
      "Saved your 100th item to Bitwarden",
      50,
      100,
    ),

    // Login items added
    new ItemCreatedCountConfig(
      "login-item-created",
      "Access granted",
      "Saved your first login item with Bitwarden",
      0,
      1,
      CipherType.Login,
    ),
    new ItemCreatedCountConfig(
      "10-login-items-added",
      "10 login Items Added",
      "Add 10 items of type login to your vault",
      1,
      10,
      CipherType.Login,
    ),
    new ItemCreatedCountConfig(
      "50-login-items-added",
      "50 login items added",
      "Add 50 items of type login to your vault",
      10,
      50,
      CipherType.Login,
    ),
    new ItemCreatedCountConfig(
      "login-item-created-one-hundred",
      "100 login items added",
      "Add 100 items of type login to your vault",
      50,
      100,
      CipherType.Login,
    ),

    // Card items
    new ItemCreatedCountConfig(
      "card-item-created",
      "Put it on my card",
      "Saved your first card item to Bitwarden",
      0,
      1,
      CipherType.Card,
    ),
    // new ItemCreatedCountConfig("card-item-created-3", "3rd card items added", "Add 3 cards to Bitwarden", 3, CipherType.Card),
    // new ItemCreatedCountConfig("card-item-created-10", "10th card item added", "Add 10 cards to Bitwarden", 10, CipherType.Card),

    // Identity items added
    new ItemCreatedCountConfig(
      "identity-item-created",
      "Papers, please",
      "Saved your first identity to Bitwarden",
      0,
      1,
      CipherType.Identity,
    ),

    // Note items
    new ItemCreatedCountConfig(
      "note-item-created",
      "For my eyes only",
      "Saved your first secure note to Bitwarden",
      0,
      1,
      CipherType.SecureNote,
    ),
    // new ItemCreatedCountConfig(
    //   "note-item-created-ten",
    //   "10 card items added",
    //   10,
    //   CipherType.SecureNote,
    // ),
    // new ItemCreatedCountConfig(
    //   "note-item-created-fifty",
    //   "50 card items added",
    //   50,
    //   CipherType.SecureNote,
    // ),
    // new ItemCreatedCountConfig(
    //   "note-item-created-one-hundred",
    //   "100 card items added",
    //   100,
    //   CipherType.SecureNote,
    // ),

    // SSH Key - Achievements indicate only one so just set threshold at 1
    new ItemCreatedCountConfig(
      "ssh-key-item-created",
      "Keyed up",
      "Added your first SSH Key to Bitwarden",
      0,
      1,
      CipherType.SshKey,
    ),
  ];

  base: Achievement;
  get achievement() {
    return this.base.achievement;
  }

  get name() {
    return this.base.name;
  }

  get description() {
    return this.base.description;
  }

  get validator() {
    return this.base.validator;
  }

  get active() {
    return this.base.active;
  }

  get hidden() {
    return this.base.hidden;
  }
  cipherType: CipherType | null = null;
  low: number;
  high: number;
  private constructor(
    key: string,
    name: string,
    description: string,
    low: number = 0,
    high: number = 1,
    cipherType: CipherType | null = null,
  ) {
    this.cipherType = cipherType;
    this.low = low;
    this.high = high;
    this.base = {
      achievement: key as AchievementId,
      name: name,
      description: description,
      validator: Type.Threshold,
      active: {
        metric:
          `item-${cipherType ? `${CipherType[cipherType].toLowerCase()}-` : ""}quantity` as MetricId,
        // low: threshold - 1,
        low: low,
        high: high,
      },
      hidden: false,
    };
  }
}
