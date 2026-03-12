import { View } from "@bitwarden/common/models/view/view";

import { MemberRegistryEntryData } from "../data/member-registry-entry.data";

/**
 * View model for a member registry entry containing decrypted properties
 *
 * Constructed directly from {@link MemberRegistryEntryData} (the registry payload is decrypted
 * as a unit by the `AccessReport` domain model, not field-by-field). Provides a `displayName`
 * computed property for UI display.
 *
 * - See {@link MemberRegistryEntryData} for data model
 */
export class MemberRegistryEntryView implements View {
  id: string = "";
  userName?: string;
  email: string = "";

  constructor(data?: MemberRegistryEntryData) {
    if (data == null) {
      return;
    }

    this.id = data.id;
    this.userName = data.userName;
    this.email = data.email;
  }

  /** Display name: userName when set, falls back to email */
  get displayName(): string {
    return this.userName ?? this.email;
  }

  toJSON() {
    return this;
  }

  static fromData(data: MemberRegistryEntryData): MemberRegistryEntryView {
    const view = new MemberRegistryEntryView();
    view.id = data.id;
    view.userName = data.userName;
    view.email = data.email;
    return view;
  }

  static fromJSON(obj: Partial<MemberRegistryEntryData> | undefined): MemberRegistryEntryView {
    return Object.assign(new MemberRegistryEntryView(), obj);
  }
}
