import { FskFile } from "./fsecure-fsk-types";

export const LoginTestEntry: FskFile = {
  data: {
    "1c3a2e31dcaa8459edd70a9d895ce298": {
      color: "#00A34D",
      createdDate: 0,
      creditCvv: "",
      creditExpiry: "",
      creditNumber: "",
      favorite: 1666440874,
      modifiedDate: 0,
      notes: "some note for example.com",
      password: "somePassword",
      passwordList: [],
      passwordModifiedDate: 0,
      rev: 1,
      service: "example.com",
      style: "website",
      type: 1,
      url: "https://www.example.com",
      username: "jdoe",
    },
  },
};

export const CreditCardTestEntry: FskFile = {
  data: {
    "156498a46a3254f16035cbbbd09c2b8f": {
      color: "#00baff",
      createdDate: 1666438977,
      creditCvv: "123",
      creditExpiry: "22.10.2026",
      creditNumber: "4242424242424242",
      favorite: 0,
      modifiedDate: 1666438977,
      notes: "some notes to my card",
      password: "1234",
      passwordList: [],
      passwordModifiedDate: 1666438977,
      rev: 1,
      service: "My credit card",
      style: "creditcard",
      type: 2,
      url: "mybank",
      username: "John Doe",
    },
  },
};
