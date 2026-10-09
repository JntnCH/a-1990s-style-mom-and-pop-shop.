import { describe, expect, it } from "vitest";
import {
  createPurchaseOrderFlexBubble,
  createStockAlertFlexBubble,
  createDailySummaryFlexBubble,
} from "./index";

describe("Flex Message Template Customization (Separated Qty/Unit & Large Font)", () => {
  it("creates Purchase Order flex with separated quantity and unit columns by default", () => {
    const flex = createPurchaseOrderFlexBubble([
      {
        name: "ปลาร้า แม่เหรียญ",
        quantity: 5,
        unitName: "แพ็ค",
        costPrice: 180,
      },
    ]);

    expect(flex.type).toBe("flex");
    const contents = flex.contents;
    expect(contents.type).toBe("bubble");

    // Header has larger store title
    const headerContents = contents.header.contents;
    const storeText = headerContents[0];
    expect(storeText.size).toBe("xl");

    // Body should contain table header with 3 separated columns
    const bodyContents = contents.body.contents;
    const tableHeader = bodyContents[0] as {
      type: string;
      layout: string;
      contents: Array<{ text: string; flex?: number; size?: string }>;
    };

    expect(tableHeader.type).toBe("box");
    expect(tableHeader.layout).toBe("horizontal");
    expect(tableHeader.contents.length).toBe(3);
    expect(tableHeader.contents[0].text).toBe("รายการสินค้า");
    expect(tableHeader.contents[1].text).toBe("จำนวน");
    expect(tableHeader.contents[2].text).toBe("หน่วยนับ");
    expect(tableHeader.contents[0].size).toBe("sm");

    // Item row should have 3 separated columns with larger fonts (after group header banner)
    const itemsBox = bodyContents[2] as {
      contents: Array<{
        type: string;
        layout: string;
        contents: Array<{ text: string; size?: string; flex?: number; color?: string }>;
      }>;
    };
    // If group header is enabled, item row is after group header
    const productRow = itemsBox.contents.find((c) => c.contents && c.contents.length === 3);
    expect(productRow).toBeDefined();
    expect(productRow?.contents[0].text).toContain("ปลาร้า แม่เหรียญ");
    expect(productRow?.contents[0].size).toBe("md");
    expect(productRow?.contents[1].text).toBe("5");
    expect(productRow?.contents[1].size).toBe("lg");
    expect(productRow?.contents[2].text).toBe("แพ็ค");
    expect(productRow?.contents[2].size).toBe("md");
  });

  it("creates Stock Alert flex with separated stock and unit columns and large font", () => {
    const flex = createStockAlertFlexBubble([
      {
        name: "นมสดจืด",
        stock: 2,
        minStock: 10,
        unitName: "กล่อง",
        status: "LOW_STOCK",
      },
    ]);

    expect(flex.type).toBe("flex");
    const contents = flex.contents;
    expect(contents.type).toBe("bubble");

    // Body table header should have 3 columns
    const bodyContents = contents.body.contents;
    const tableHeader = bodyContents[0] as {
      contents: Array<{ text: string; size?: string }>;
    };
    expect(tableHeader.contents.length).toBe(3);
    expect(tableHeader.contents[0].text).toBe("รายการสินค้า");
    expect(tableHeader.contents[1].text).toBe("คงเหลือ");
    expect(tableHeader.contents[2].text).toBe("หน่วยนับ");

    // Alert row has separated values (after group header banner)
    const itemsBox = bodyContents[2] as {
      contents: Array<{
        contents: Array<{ text: string; size?: string }>;
      }>;
    };
    const productRow = itemsBox.contents.find((c) => c.contents && c.contents.length === 3);
    expect(productRow).toBeDefined();
    expect(productRow?.contents[0].text).toContain("นมสดจืด");
    expect(productRow?.contents[1].text).toBe("2");
    expect(productRow?.contents[1].size).toBe("lg");
    expect(productRow?.contents[2].text).toBe("กล่อง");
    expect(productRow?.contents[2].size).toBe("md");
  });

  it("allows toggling back to 2 columns and medium font when requested", () => {
    const flex = createPurchaseOrderFlexBubble(
      [
        {
          name: "บะหมี่ไวไว",
          quantity: 10,
          unitName: "ซอง",
        },
      ],
      {
        separateQuantityUnit: false,
        fontSize: "medium",
      },
    );

    const bodyContents = flex.contents.body.contents;
    const tableHeader = bodyContents[0] as {
      contents: Array<{ text: string; size?: string }>;
    };
    expect(tableHeader.contents.length).toBe(2);
    expect(tableHeader.contents[0].text).toBe("รายการสินค้าที่จะสั่งซื้อ");
    expect(tableHeader.contents[1].text).toBe("จำนวน / หน่วยนับ");
    expect(tableHeader.contents[0].size).toBe("xs");
  });

  it("creates Daily Summary flex with large typography", () => {
    const flex = createDailySummaryFlexBubble({
      totalProducts: 50,
      inStockCount: 40,
      lowStockCount: 7,
      outOfStockCount: 3,
      totalEstimatedCost: 12500,
      reorderCount: 10,
    });

    expect(flex.contents.header.contents[0].size).toBe("xl");
    expect(flex.contents.header.contents[1].size).toBe("md");
  });
});
