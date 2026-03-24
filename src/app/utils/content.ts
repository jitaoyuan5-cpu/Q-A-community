export const extractFirstCodeBlock = (markdown: string) => {
  const match = markdown.match(/```(?:[\w-]+)?\n([\s\S]*?)```/);
  return match?.[1]?.trim() || "";
};

export const guessPlaygroundTemplate = (code: string) => {
  if (/<\w+/.test(code) || /createRoot|React\./.test(code)) return "react" as const;
  if (/interface |type |:\s*\w+/.test(code)) return "typescript" as const;
  return "html" as const;
};
