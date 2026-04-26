import { describe, expect, it } from "vitest";
import { formatActionLabel, formatStateLabel } from "./i18n";

describe("friendly sync copy", () => {
  it("does not expose push or pull wording in primary labels", () => {
    expect(formatActionLabel("en", "push").toLowerCase()).not.toContain("push");
    expect(formatActionLabel("en", "pull").toLowerCase()).not.toContain("pull");
    expect(formatActionLabel("zh-CN", "push")).toBe("上传到 GitHub");
    expect(formatActionLabel("zh-CN", "pull")).toBe("下载到这台 Mac");
  });

  it("describes sync states in user-facing terms", () => {
    expect(formatStateLabel("zh-CN", "only-local")).toBe("本机有，GitHub 没有");
    expect(formatStateLabel("zh-CN", "only-remote")).toBe("GitHub 有，本机没有");
    expect(formatStateLabel("zh-CN", "conflict")).toBe("两边都改过");
    expect(formatStateLabel("zh-CN", "pending-delete")).toBe("可能已删除");
  });
});
