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

  // Any vault items added
  static readonly ItemCreated = new ItemCreatedCountConfig(
    "vault-item-created",
    "1st item added",
    1,
  );
  static readonly ItemsCreated10 = new ItemCreatedCountConfig(
    "vault-items-created-ten",
    "10 items created",
    10,
  );
  static readonly ItemsCreated50 = new ItemCreatedCountConfig(
    "vault-items-created-fifty",
    "50 items created",
    50,
  );
  static readonly ItemsCreated100 = new ItemCreatedCountConfig(
    "vault-items-created-one-hundred",
    "100 items created",
    100,
  );

  // Login items added
  static readonly LoginItemCreated = new ItemCreatedCountConfig(
    "login-item-created",
    "1st login item added",
    1,
    CipherType.Login,
  );
  static readonly LoginItemCreated10 = new ItemCreatedCountConfig(
    "login-item-created-ten",
    "10 login items added",
    10,
    CipherType.Login,
  );
  static readonly LoginItemCreated50 = new ItemCreatedCountConfig(
    "login-item-created-fifty",
    "50 login items added",
    50,
    CipherType.Login,
  );
  static readonly LoginItemCreated100 = new ItemCreatedCountConfig(
    "login-item-created-one-hundred",
    "100 login items added",
    100,
    CipherType.Login,
  );

  // Card items
  static readonly CardItemCreated = new ItemCreatedCountConfig(
    "card-item-created",
    "1st card item added",
    1,
    CipherType.Card,
  );
  static readonly CardItemCreated3 = new ItemCreatedCountConfig(
    "card-item-created-3",
    "3rd card items added",
    3,
    CipherType.Card,
  );
  static readonly CardItemCreated5 = new ItemCreatedCountConfig(
    "card-item-created-5",
    "5th card item added",
    5,
    CipherType.Card,
  );

  // Note items
  static readonly NoteItemCreated = new ItemCreatedCountConfig(
    "note-item-created",
    "1st card item added",
    1,
    CipherType.SecureNote,
  );
  static readonly NoteItemCreated10 = new ItemCreatedCountConfig(
    "note-item-created-ten",
    "10 card items added",
    10,
    CipherType.SecureNote,
  );
  static readonly NoteItemCreated50 = new ItemCreatedCountConfig(
    "note-item-created-fifty",
    "50 card items added",
    50,
    CipherType.SecureNote,
  );
  static readonly NoteItemCreated100 = new ItemCreatedCountConfig(
    "note-item-created-one-hundred",
    "100 card items added",
    100,
    CipherType.SecureNote,
  );

  // SSH Key - Achievements indicate only one so just set threshold at 1
  static readonly SSHKeyItemCreated = new ItemCreatedCountConfig(
    "ssh-key-item-created",
    "1st SSH Key added",
    1,
  );

  base: Achievement;
  get achievement() {
    return this.base.achievement;
  }

  get name() {
    return this.base.name;
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
  cipherType: CipherType = null;
  threshold: number;
  private constructor(key: string, name: string, threshold: number, cipherType: CipherType = null) {
    this.cipherType = cipherType;
    this.threshold = threshold;
    this.base = {
      achievement: key as AchievementId,
      name: name,
      validator: Type.Threshold,
      active: {
        metric:
          `item-${cipherType ? `${CipherType[cipherType].toLowerCase()}-` : ""}quantity` as MetricId,
        low: threshold - 1,
        high: threshold,
      },
      hidden: false,
    };
  }
}
