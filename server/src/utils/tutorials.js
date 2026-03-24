export const tutorialDifficulties = ["beginner", "intermediate", "advanced"];

export const detectVideoProvider = (value = "") => {
  const url = String(value);
  if (/youtu\.be|youtube\.com/i.test(url)) return "youtube";
  if (/bilibili\.com/i.test(url)) return "bilibili";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  return null;
};

export const buildEmbedUrl = (value = "") => {
  const url = String(value).trim();
  const provider = detectVideoProvider(url);
  if (!provider) return null;

  if (provider === "youtube") {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/i);
    if (!match) return null;
    return { provider, embedUrl: `https://www.youtube.com/embed/${match[1]}` };
  }

  if (provider === "bilibili") {
    const match = url.match(/(BV[\w\d]+)/i);
    if (!match) return null;
    return { provider, embedUrl: `https://player.bilibili.com/player.html?bvid=${match[1]}&page=1` };
  }

  const match = url.match(/vimeo\.com\/(\d+)/i);
  if (!match) return null;
  return { provider, embedUrl: `https://player.vimeo.com/video/${match[1]}` };
};

export const normalizeStarterFiles = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value).filter(([key, content]) => key && typeof content === "string");
  if (!entries.length) return null;
  return Object.fromEntries(entries);
};
