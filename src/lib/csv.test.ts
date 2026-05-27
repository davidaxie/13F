import { describe, it, expect } from "vitest";
import { toCSV, slugify, type CsvColumn } from "./csv";

describe("toCSV", () => {
  it("renders header + body rows with CRLF terminators", () => {
    const rows = [{ a: 1, b: 2 }];
    const cols: CsvColumn<{ a: number; b: number }>[] = [
      { label: "A", get: (r) => r.a },
      { label: "B", get: (r) => r.b },
    ];
    const csv = toCSV(rows, cols);
    expect(csv).toBe("A,B\r\n1,2\r\n");
  });

  it("escapes commas, quotes, and newlines per RFC 4180", () => {
    const rows = [
      { name: "Smith, Jane", note: 'She said "hi"' },
      { name: "Doe", note: "line1\nline2" },
    ];
    const cols: CsvColumn<(typeof rows)[number]>[] = [
      { label: "name", get: (r) => r.name },
      { label: "note", get: (r) => r.note },
    ];
    const csv = toCSV(rows, cols);
    // Comma → quoted; quote → doubled and quoted; newline → quoted.
    expect(csv).toBe(
      `name,note\r\n"Smith, Jane","She said ""hi"""\r\nDoe,"line1\nline2"\r\n`,
    );
  });

  it("emits empty string for null / undefined", () => {
    const rows = [{ a: null, b: undefined, c: 0 }];
    const cols: CsvColumn<(typeof rows)[number]>[] = [
      { label: "a", get: (r) => r.a },
      { label: "b", get: (r) => r.b },
      { label: "c", get: (r) => r.c },
    ];
    expect(toCSV(rows, cols)).toBe("a,b,c\r\n,,0\r\n");
  });

  it("handles empty rows array", () => {
    const cols: CsvColumn<{ x: number }>[] = [{ label: "x", get: (r) => r.x }];
    expect(toCSV([], cols)).toBe("x\r\n");
  });
});

describe("slugify", () => {
  it("lowercases, collapses non-alnum to single dashes, trims edges", () => {
    expect(slugify("Berkshire Hathaway Inc")).toBe("berkshire-hathaway-inc");
    expect(slugify("Q4 2026")).toBe("q4-2026");
    expect(slugify("---weird-input---")).toBe("weird-input");
    expect(slugify("Smith, Jane!")).toBe("smith-jane");
  });

  it("caps at 60 chars", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBe(60);
  });
});
