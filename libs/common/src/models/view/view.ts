// See https://contributing.bitwarden.com/architecture/clients/data-model/#view for proper use.
// View models represent the decrypted state of a corresponding Domain model.
// They typically match the Domain model but contains a decrypted string for any EncString fields.
// Don't use this to represent arbitrary component view data as that isn't what it is for.
export class View {}
