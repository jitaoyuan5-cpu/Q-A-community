import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { apiRequest } from "../../api/client";
import type { UploadAsset } from "../../types";
import { MarkdownRenderer } from "./markdown-renderer";

const toolbarItems = [
  { label: "H1", wrap: "# 标题" },
  { label: "H2", wrap: "## 标题" },
  { label: "H3", wrap: "### 标题" },
  { label: "H4", wrap: "#### 标题" },
  { label: "H5", wrap: "##### 标题" },
  { label: "粗体", wrap: "**加粗内容**" },
  { label: "斜体", wrap: "*斜体内容*" },
  { label: "代码", wrap: "```tsx\nconst value = 1;\n```" },
  { label: "引用", wrap: "> 引用内容" },
  { label: "链接", wrap: "[链接文本](https://example.com)" },
];

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  minHeightClass = "min-h-48",
  textareaId,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClass?: string;
  textareaId?: string;
}) {
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const insertText = (snippet: string) => {
    onChange(value ? `${value}\n${snippet}` : snippet);
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const asset = await apiRequest<UploadAsset>("/uploads", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          dataBase64: await fileToBase64(file),
        }),
      });
      insertText(`![${file.name}](${asset.url})`);
    } catch (err) {
      setError(`图片上传失败：${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        {toolbarItems.map((item) => (
          <button key={item.label} type="button" className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700" onClick={() => insertText(item.wrap)}>
            {item.label}
          </button>
        ))}
        <button type="button" className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700" onClick={() => fileInputRef.current?.click()}>
          <ImagePlus className="mr-1 h-3 w-3" />
          {uploading ? "上传中..." : "图片"}
        </button>
        <button type="button" className={`ml-auto rounded-md px-2 py-1 text-xs ${preview ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`} onClick={() => setPreview((current) => !current)}>
          {preview ? "编辑" : "预览"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) await uploadImage(file);
            event.currentTarget.value = "";
          }}
        />
      </div>
      {preview ? (
        <div className={`${minHeightClass} p-3`}>
          <MarkdownRenderer content={value || "暂无内容"} />
        </div>
      ) : (
        <textarea
          id={textareaId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${minHeightClass} w-full resize-y rounded-b-xl border-0 p-3 outline-none`}
          placeholder={placeholder}
        />
      )}
      {error && <p className="border-t border-slate-200 px-3 py-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
