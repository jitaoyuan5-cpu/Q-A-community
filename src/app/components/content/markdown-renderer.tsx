const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeUrl = (value: string) => {
  if (/^(https?:\/\/|\/uploads\/)/i.test(value)) return value;
  return "#";
};

const highlightCode = (code: string) => {
  let html = escapeHtml(code);
  html = html.replace(
    /\b(const|let|var|function|return|if|else|await|async|export|import|from|type|interface)\b/g,
    '<span class="md-token-keyword">$1</span>',
  );
  html = html.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, '<span class="md-token-string">$1</span>');
  html = html.replace(/\b(\d+)\b/g, '<span class="md-token-number">$1</span>');
  return html;
};

const renderInline = (line: string) => {
  let html = escapeHtml(line);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${normalizeUrl(src)}" alt="${alt}" class="markdown-image" />`);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => `<a href="${normalizeUrl(href)}" target="_blank" rel="noreferrer">${text}</a>`);
  return html;
};

export const markdownToHtml = (markdown: string) => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine ?? "";
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        parts.push(`<pre><code>${highlightCode(codeLines.join("\n"))}</code></pre>`);
        inCodeBlock = false;
        codeLines = [];
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      parts.push("");
      continue;
    }
    if (line.startsWith("##### ")) {
      parts.push(`<h5>${renderInline(line.slice(6))}</h5>`);
      continue;
    }
    if (line.startsWith("#### ")) {
      parts.push(`<h4>${renderInline(line.slice(5))}</h4>`);
      continue;
    }
    if (line.startsWith("### ")) {
      parts.push(`<h3>${renderInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      parts.push(`<h2>${renderInline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      parts.push(`<h1>${renderInline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("> ")) {
      parts.push(`<blockquote>${renderInline(line.slice(2))}</blockquote>`);
      continue;
    }
    if (line.startsWith("- ")) {
      const last = parts[parts.length - 1];
      const item = `<li>${renderInline(line.slice(2))}</li>`;
      if (last?.startsWith("<ul>")) parts[parts.length - 1] = last.replace("</ul>", `${item}</ul>`);
      else parts.push(`<ul>${item}</ul>`);
      continue;
    }
    parts.push(`<p>${renderInline(line)}</p>`);
  }

  if (inCodeBlock) parts.push(`<pre><code>${highlightCode(codeLines.join("\n"))}</code></pre>`);
  return parts.filter(Boolean).join("");
};

export function MarkdownRenderer({ content, className = "" }: { content: string; className?: string }) {
  return <div className={`markdown-body ${className}`.trim()} dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} />;
}
