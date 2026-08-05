export const DelineaXmlTestData = `<?xml version="1.0" encoding="utf-8"?>
<ImportFile xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Folders>
    <Folder>
      <FolderName>Finance</FolderName>
      <FolderPath>\\Finance</FolderPath>
      <Permissions />
      <MappedSecretTypes />
    </Folder>
  </Folders>
  <Secrets>
    <Secret>
      <SecretName>AC units at Operations</SecretName>
      <SecretTemplateName>Kee Pass</SecretTemplateName>
      <FolderPath>\\Finance</FolderPath>
      <SiteId>-1</SiteId>
      <TotpKey />
      <TotpBackupCodes />
      <SecretItems>
        <SecretItem>
          <FieldName>Username</FieldName>
          <Slug>username</Slug>
          <Value>myUser</Value>
        </SecretItem>
        <SecretItem>
          <FieldName>URL</FieldName>
          <Slug>url</Slug>
          <Value>https://bitwarden.com</Value>
        </SecretItem>
        <SecretItem>
          <FieldName>Password</FieldName>
          <Slug>password</Slug>
          <Value>SoftBatchCookies123!</Value>
        </SecretItem>
        <SecretItem>
          <FieldName>Notes</FieldName>
          <Slug>notes</Slug>
          <Value>Level 1 = 1024</Value>
        </SecretItem>
        <SecretItem>
          <FieldName>Date Created</FieldName>
          <Slug>date-created</Slug>
          <Value>2020-03-09 09:29:08 AM</Value>
        </SecretItem>
        <SecretItem>
          <FieldName>Expires</FieldName>
          <Slug>expires</Slug>
          <Value>2020-03-09 08:52:49 AM</Value>
        </SecretItem>
      </SecretItems>
      <SecretDependencies />
      <SecretDependencyGroups />
      <Permissions />
    </Secret>
  </Secrets>
  <Groups />
  <Sites />
  <SiteConnectors />
</ImportFile>`;

export const DelineaXmlTestDataMissingRoot = `<?xml version="1.0" encoding="utf-8"?><ImportFle />`;
