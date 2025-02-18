function getRandomDateTime() {
  const now = new Date();
  const past24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const randomTime =
    past24Hours.getTime() + Math.random() * (now.getTime() - past24Hours.getTime());
  const randomDate = new Date(randomTime);

  return randomDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export const dummyEvents = [
  {
    timeStamp: getRandomDateTime(),
    deviceType: "Extension - Firefox",
    member: "Alice",
    event: "Logged in",
  },
  {
    timeStamp: getRandomDateTime(),
    deviceType: "Mobile - iOS",
    member: "Bob",
    event: `Viewed item <span class="tw-text-code">000000</span>`,
  },
  {
    timeStamp: getRandomDateTime(),
    deviceType: "Desktop - Linux",
    member: "Carlos",
    event: "Login attempt failed with incorrect password",
  },
  {
    timeStamp: getRandomDateTime(),
    deviceType: "Web vault - Chrome",
    member: "Ivan",
    event: `Confirmed user <span class="tw-text-code">000000</span>`,
  },
  {
    timeStamp: getRandomDateTime(),
    deviceType: "Mobile - Android",
    member: "Franz",
    event: `Sent item <span class="tw-text-code">000000</span> to trash`,
  },
].sort((a, b) => new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime());
