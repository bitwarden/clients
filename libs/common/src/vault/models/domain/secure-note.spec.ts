import { SecureNoteType } from "../../enums";
import { SecureNoteData } from "../data/secure-note.data";

import { SecureNote } from "./secure-note";

describe("SecureNote", () => {
  let data: SecureNoteData;

  beforeEach(() => {
    data = {
      type: SecureNoteType.Generic,
    };
  });

  it("Convert from empty", () => {
    const data = new SecureNoteData();
    const secureNote = new SecureNote(data);

    expect(secureNote).toEqual({
      type: undefined,
    });
  });

  it("Convert", () => {
    const secureNote = new SecureNote(data);

    expect(secureNote).toEqual({
      type: 0,
    });
  });

  it("toSecureNoteData", () => {
    const secureNote = new SecureNote(data);
    expect(secureNote.toSecureNoteData()).toEqual(data);
  });

  it("Decrypt", async () => {
    const secureNote = new SecureNote();
    secureNote.type = SecureNoteType.Generic;

    const view = await secureNote.decrypt();

    expect(view).toEqual({
      type: 0,
    });
  });

  describe("fromJSON", () => {
    it("returns undefined if object is null", () => {
      expect(SecureNote.fromJSON(null)).toBeUndefined();
    });
  });

  describe("toSdkSecureNote", () => {
    it("returns the correct SDK SecureNote object", () => {
      const secureNote = new SecureNote();
      secureNote.type = SecureNoteType.Generic;

      const sdkSecureNote = secureNote.toSdkSecureNote();

      expect(sdkSecureNote).toEqual({
        type: 0,
      });
    });
  });
});
