import { env } from "../config/env.js";

const getMode = () => process.env.EMAIL_MODE || "log";

export const sendTemplatedEmail = async ({ to, subject, text }) => {
  const mode = getMode();
  if (!env.emailFrom || mode === "disabled") {
    return { delivered: false, mode };
  }

  if (mode === "log") {
    console.log("[mail:log]", JSON.stringify({ to, subject, text }));
    return { delivered: true, mode };
  }

  console.log("[mail:smtp-not-configured]", JSON.stringify({ to, subject, text }));
  return { delivered: false, mode };
};
