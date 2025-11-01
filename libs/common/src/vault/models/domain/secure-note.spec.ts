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

    expect(data).toBeDefined();
    expect(secureNote).toEqual({ type: SecureNoteType.Generic });
    expect(data.type).toBe(SecureNoteType.Generic);
  });

  it("Convert from undefined", () => {
    const data = new SecureNoteData(undefined);
    expect(data.type).toBe(SecureNoteType.Generic);
  });

  it("Convert", () => {
    const secureNote = new SecureNote(data);

    expect(secureNote).toEqual({ type: 0 });
    expect(data.type).toBe(SecureNoteType.Generic);
  });

  it("toSecureNoteData", () => {
    const secureNote = new SecureNote(data);
    expect(secureNote.toSecureNoteData()).toEqual(data);
    expect(secureNote.toSecureNoteData().type).toBe(SecureNoteType.Generic);
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

    it("creates SecureNote instance from JSON object", () => {
      const jsonObj = { type: SecureNoteType.Generic };
      const result = SecureNote.fromJSON(jsonObj);

      expect(result).toBeInstanceOf(SecureNote);
      expect(result.type).toBe(SecureNoteType.Generic);
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

  describe("fromSdkSecureNote", () => {
    it("returns undefined when null is provided", () => {
      const result = SecureNote.fromSdkSecureNote(null);

      expect(result).toBeUndefined();
    });

    it("returns undefined when undefined is provided", () => {
      const result = SecureNote.fromSdkSecureNote(undefined);

      expect(result).toBeUndefined();
    });

    it("creates SecureNote with Generic type from SDK object", () => {
      const sdkSecureNote = {
        type: SecureNoteType.Generic,
      };

      const result = SecureNote.fromSdkSecureNote(sdkSecureNote);

      expect(result).toBeInstanceOf(SecureNote);
      expect(result.type).toBe(SecureNoteType.Generic);
    });

    it("preserves the type value from SDK object", () => {
      const sdkSecureNote = {
        type: SecureNoteType.Generic,
      };

      const result = SecureNote.fromSdkSecureNote(sdkSecureNote);

      expect(result.type).toBe(0);
    });

    it("creates a new SecureNote instance", () => {
      const sdkSecureNote = {
        type: SecureNoteType.Generic,
      };

      const result = SecureNote.fromSdkSecureNote(sdkSecureNote);

      expect(result).not.toBe(sdkSecureNote);
      expect(result).toBeInstanceOf(SecureNote);
    });

    it("handles SDK object with undefined type", () => {
      const sdkSecureNote = {
        type: undefined as SecureNoteType,
      };

      const result = SecureNote.fromSdkSecureNote(sdkSecureNote);

      expect(result).toBeInstanceOf(SecureNote);
      expect(result.type).toBeUndefined();
    });

    it("returns symmetric with toSdkSecureNote", () => {
      const original = new SecureNote();
      original.type = SecureNoteType.Generic;

      const sdkFormat = original.toSdkSecureNote();
      const reconstructed = SecureNote.fromSdkSecureNote(sdkFormat);

      expect(reconstructed.type).toBe(original.type);
    });
  });
});
