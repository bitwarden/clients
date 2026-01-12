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

const asteriskPlaceholders = new Array(6).fill({
  appName: "***",
  userName: "**********",
  userEmail: "**********",
  message: "**********",
});

export const placeholderEvents = [
  {
    date: getRandomDateTime(),
    appName: "Extension - Firefox",
    userName: "Alice",
    userEmail: "alice@email.com",
    message: "Logged in",
  },
  {
    date: getRandomDateTime(),
    appName: "Mobile - iOS",
    userName: "Bob",
    message: `Viewed item <span class="tw-text-code">000000</span>`,
  },
  {
    date: getRandomDateTime(),
    appName: "Desktop - Linux",
    userName: "Carlos",
    userEmail: "carlos@email.com",
    message: "Login attempt failed with incorrect password",
  },
  {
    date: getRandomDateTime(),
    appName: "Web vault - Chrome",
    userName: "Ivan",
    userEmail: "ivan@email.com",
    message: `Confirmed user <span class="tw-text-code">000000</span>`,
  },
  {
    date: getRandomDateTime(),
    appName: "Mobile - Android",
    userName: "Franz",
    userEmail: "franz@email.com",
    message: `Sent item <span class="tw-text-code">000000</span> to trash`,
  },
]
  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  .concat(asteriskPlaceholders);
