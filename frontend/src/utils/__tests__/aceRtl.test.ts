import { describe, expect, it } from "vitest";
import { applyMarkdownSourceDirection } from "@/utils/aceRtl";

describe("applyMarkdownSourceDirection", () => {
  const source = [
    "# כותרת / English",
    "[קישור](https://example.test/a?x=1&y=2)",
    "| עברית | English |",
    "| --- | --- |",
    "```ts",
    "const message = 'שלום';",
    "```",
  ].join("\n");

  it.each([
    ["rtl", true],
    ["ltr", false],
    ["auto", false],
  ] as const)(
    "sets display RTL to %s without changing the source",
    (dir, rtl) => {
      const calls: [string, boolean][] = [];
      const editor = {
        setOption(name: string, value: boolean) {
          calls.push([name, value]);
        },
      };

      applyMarkdownSourceDirection(editor, dir);

      expect(calls).toEqual([["rtl", rtl]]);
      expect(source).not.toMatch(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/);
    }
  );
});
