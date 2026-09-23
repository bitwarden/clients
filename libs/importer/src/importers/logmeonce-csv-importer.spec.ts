import { LogMeOnceCsvImporter } from "./logmeonce-csv-importer";

const oldFormatCSV = `"name","url","username","password","group","extra"
"Facebook (auser)","https://www.facebook.com/","auser","123456","Favorites",""`;

const newFormatCSV = `"name","url","note","group","username","password","passkey","extra"
"Facebook (auser)","https://www.facebook.com/","","Favorites","auser","123456","",""`;

describe("LogMeOnce CSV Importer", () => {
  let importer: LogMeOnceCsvImporter;

  beforeEach(() => {
    importer = new LogMeOnceCsvImporter();
  });

  it.each([oldFormatCSV, newFormatCSV])(
    "should parse login data when provided valid CSV in old or new formats",
    async (csv) => {
      const result = await importer.parse(csv);
      expect(result != null).toBe(true);

      expect(result.ciphers.length).toEqual(1);
      const cipher = result.ciphers[0];
      expect(cipher.name).toEqual("Facebook (auser)");
      expect(cipher.login.uris.length).toEqual(1);
      expect(cipher.login.uris[0].uri).toEqual("https://www.facebook.com/");
      expect(cipher.login.username).toEqual("auser");
      expect(cipher.login.password).toEqual("123456");

      expect(result.folders.length).toEqual(1);
      expect(result.folders[0].name).toEqual("Favorites");
      expect(result.folderRelationships.length).toEqual(1);
      expect(result.folderRelationships[0]).toEqual([0, 0]);
    },
  );
});
