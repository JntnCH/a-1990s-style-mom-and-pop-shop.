import { describe, expect, it } from "vitest";
import {
  autoFillMissingCategoryCodes,
  generateCategoryCode,
  getCategoryCodeSuggestions,
} from "./category-code-generator";

describe("category-code-generator", () => {
  const existingDefaults = [
    { id: "cat-beverage", code: "BEV", name: "เครื่องดื่ม" },
    { id: "cat-snack", code: "SNK", name: "ขนมขบเคี้ยว" },
    { id: "cat-food", code: "FOD", name: "อาหารสำเร็จรูปและแห้ง" },
    { id: "cat-household", code: "HSH", name: "ของใช้ในครัวเรือน" },
    { id: "cat-personal", code: "PER", name: "ของใช้ส่วนตัว" },
    { id: "cat-general", code: "GEN", name: "สินค้าเบ็ดเตล็ด" },
  ];

  it("generates correct codes for screenshot categories (นม, เหล้า, เบียร์, บุหรี่, โค้ก)", () => {
    expect(generateCategoryCode("นม", existingDefaults)).toBe("MLK");
    expect(generateCategoryCode("เหล้า", existingDefaults)).toBe("ALC");
    expect(generateCategoryCode("เบียร์", existingDefaults)).toBe("BEER");
    expect(generateCategoryCode("บุหรี่", existingDefaults)).toBe("TOB");
    expect(generateCategoryCode("โค้ก", existingDefaults)).toBe("COKE");
  });

  it("handles duplicate codes by picking alternate or suffix", () => {
    // If MLK is already taken, it should pick DAIRY or MLK2
    const withMlk = [...existingDefaults, { id: "1", code: "MLK", name: "นมสด" }];
    const newCode = generateCategoryCode("นมข้น", withMlk);
    expect(newCode).toBe("DAIRY");
  });

  it("generates suggestions for a category", () => {
    const suggestions = getCategoryCodeSuggestions("นม", existingDefaults);
    expect(suggestions).toContain("MLK");
    expect(suggestions).toContain("DAIRY");
  });

  it("auto fills missing codes from a list", () => {
    const listWithMissing = [
      ...existingDefaults,
      { id: "cat-1", name: "นม", code: "-" },
      { id: "cat-2", name: "เหล้า", code: "" },
      { id: "cat-3", name: "เบียร์", code: "—" },
      { id: "cat-4", name: "บุหรี่", code: "" },
      { id: "cat-5", name: "โค้ก", code: "-" },
    ];

    const result = autoFillMissingCategoryCodes(listWithMissing);
    expect(result.fixedCount).toBe(5);
    const cat1 = result.updated.find((c) => c.name === "นม");
    expect(cat1?.code).toBe("MLK");
    const cat2 = result.updated.find((c) => c.name === "เหล้า");
    expect(cat2?.code).toBe("ALC");
    const cat3 = result.updated.find((c) => c.name === "เบียร์");
    expect(cat3?.code).toBe("BEER");
    const cat4 = result.updated.find((c) => c.name === "บุหรี่");
    expect(cat4?.code).toBe("TOB");
    const cat5 = result.updated.find((c) => c.name === "โค้ก");
    expect(cat5?.code).toBe("COKE");
  });

  it("handles English category names", () => {
    expect(generateCategoryCode("Bakery", existingDefaults)).toBe("BAK");
    expect(generateCategoryCode("Ice Cream", existingDefaults)).toBe("FRZ");
  });

  it("handles sequential fallback when name is generic or empty", () => {
    const code = generateCategoryCode("", existingDefaults);
    expect(code).toMatch(/^CAT-\d+/);
  });
});
