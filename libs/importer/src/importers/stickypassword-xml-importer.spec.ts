import { StickyPasswordXmlImporter } from "./stickypassword-xml-importer";

const buildXml = (loginAttributes: string) => `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <Database>
    <Logins>
      <Login ID="1" ${loginAttributes} Password="hunter2" />
    </Logins>
    <Accounts>
      <Account ID="10" Name="Example" Link="https://example.com" Comments="Account comment">
        <LoginLinks>
          <Login SourceLoginID="1" />
        </LoginLinks>
      </Account>
    </Accounts>
  </Database>
</root>`;

describe("Sticky Password XML Importer", () => {
  let importer: StickyPasswordXmlImporter;

  beforeEach(() => {
    importer = new StickyPasswordXmlImporter();
  });

  it("uses the Name attribute as the username when there is no description", async () => {
    const result = await importer.parse(buildXml('Name="user@example.com"'));

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    const cipher = result.ciphers[0];
    expect(cipher.name).toBe("Example");
    expect(cipher.login.username).toBe("user@example.com");
    expect(cipher.login.password).toBe("hunter2");
    expect(cipher.login.uris[0].uri).toBe("https://example.com");
    expect(cipher.notes).toBe("Account comment");
  });

  it("uses the RealLogin attribute as the username when the login has a description", async () => {
    const result = await importer.parse(
      buildXml('Name="Work account" RealLogin="user@example.com"'),
    );

    expect(result.success).toBe(true);
    const cipher = result.ciphers[0];
    expect(cipher.login.username).toBe("user@example.com");
    expect(cipher.login.password).toBe("hunter2");
    expect(cipher.notes).toBe("Account comment\nWork account");
  });
});
