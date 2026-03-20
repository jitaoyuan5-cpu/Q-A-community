import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MarkdownEditor } from "../../src/app/components/content/markdown-editor";
import { MarkdownRenderer } from "../../src/app/components/content/markdown-renderer";
import { render } from "@testing-library/react";

describe("markdown editor integration", () => {
  it("toggles preview and renders formatted markdown", async () => {
    const user = userEvent.setup();
    let value = "# 标题\n\n**bold**";
    const { rerender } = render(<MarkdownEditor value={value} onChange={(next) => { value = next; }} />);

    await user.click(screen.getByRole("button", { name: "预览" }));
    expect(screen.getByText("标题")).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();

    rerender(<MarkdownEditor value={value} onChange={(next) => { value = next; }} />);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "粗体" }));
    expect(value).toContain("**加粗内容**");
  });

  it("exposes H1 to H5 heading tools", async () => {
    const user = userEvent.setup();
    let value = "";
    render(<MarkdownEditor value={value} onChange={(next) => { value = next; }} />);

    for (const level of ["H1", "H2", "H3", "H4", "H5"]) {
      await user.click(screen.getByRole("button", { name: level }));
    }

    expect(value).toContain("# 标题");
    expect(value).toContain("## 标题");
    expect(value).toContain("### 标题");
    expect(value).toContain("#### 标题");
    expect(value).toContain("##### 标题");
  });

  it("renders level 4 and level 5 headings", () => {
    render(<MarkdownRenderer content={"#### 四级标题\n##### 五级标题"} />);

    expect(screen.getByRole("heading", { level: 4, name: "四级标题" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 5, name: "五级标题" })).toBeInTheDocument();
  });
});
