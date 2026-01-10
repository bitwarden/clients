// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EncString } from "../../../../key-management/crypto/models/enc-string";
import { SendType } from "../../enums/send-type";
import { SendTextApi } from "../../models/api/send-text.api";
import { SendTextData } from "../../models/data/send-text.data";
import { SendData } from "../../models/data/send.data";
import { Send } from "../../models/domain/send";
import { SendView } from "../../models/view/send.view";

export function testSendViewData(id: string, name: string) {
  const data = new SendView({} as any);
  data.id = id;
  data.name = name;
  data.disabled = false;
  data.accessCount = 2;
  data.accessId = "1";
  data.revisionDate = null;
  data.expirationDate = null;
  data.deletionDate = null;
  data.notes = "Notes!!";
  data.key = null;
  return data;
}

export function createSendData(value: Partial<SendData> = {}) {
  const defaultSendData: Partial<SendData> = {
    id: "1",
    name: "Test Send",
    accessId: "123",
    type: SendType.Text,
    notes: "notes!",
    file: null,
    text: new SendTextData(new SendTextApi({ Text: "send text" })),
    key: "key",
    maxAccessCount: 12,
    accessCount: 2,
    revisionDate: "2024-09-04",
    expirationDate: "2024-09-04",
    deletionDate: "2024-09-04",
    password: "password",
    disabled: false,
    hideEmail: false,
  };

  const testSend: any = {};
  for (const prop in defaultSendData) {
    testSend[prop] = value[prop as keyof SendData] ?? defaultSendData[prop as keyof SendData];
  }
  return testSend;
}

export function testSendData(id: string, name: string) {
  const data = new SendData({} as any);
  data.id = id;
  data.name = name;
  data.disabled = false;
  data.accessCount = 2;
  data.accessId = "1";
  data.revisionDate = null;
  data.expirationDate = null;
  data.deletionDate = null;
  data.notes = "Notes!!";
  data.key = null;
  return data;
}

export function testSend(id: string, name: string) {
  const data = new Send({} as any);
  data.id = id;
  data.name = new EncString(name);
  data.disabled = false;
  data.accessCount = 2;
  data.accessId = "1";
  data.revisionDate = null;
  data.expirationDate = null;
  data.deletionDate = null;
  data.notes = new EncString("Notes!!");
  data.key = null;
  return data;
}
