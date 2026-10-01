/**
 * LINE Flex Message Template for Stock Alert (แจ้งเตือนสินค้าใกล้หมด / หมดสต็อก)
 * แยกไฟล์ออกมาเฉพาะ เพื่อให้ปรับแต่ง ดีไซน์ เพิ่ม-แก้ไข ได้ง่าย
 */

import { DEFAULT_STORE_NAME, getSystemStoreName } from "./index";

export interface FlexStockAlertItem {
  name: string;
  stock: number;
  minStock: number;
  unitName: string;
  status: "OUT_OF_STOCK" | "LOW_STOCK";
}

export interface StockAlertFlexOptions {
  storeName?: string;
  title?: string;
  themeColor?: string;
}

export function createStockAlertFlexBubble(
  items: FlexStockAlertItem[],
  options: StockAlertFlexOptions = {},
) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const storeName = getSystemStoreName(options.storeName);
  const title = options.title || "แจ้งเตือนสต็อกสินค้าต้องสั่งซื้อ";
  const headerBg = "#ef4444"; // Red for alert

  const itemRows = items.map((item, index) => {
    const isOut = item.status === "OUT_OF_STOCK" || item.stock <= 0;
    return {
      type: "box" as const,
      layout: "horizontal" as const,
      spacing: "sm" as const,
      contents: [
        {
          type: "text" as const,
          text: `${index + 1}. ${item.name}`,
          size: "sm" as const,
          color: "#1f2937",
          flex: 6,
          wrap: true,
        },
        {
          type: "text" as const,
          text: isOut ? "สินค้าหมด (0)" : `เหลือ ${item.stock} ${item.unitName}`,
          size: "sm" as const,
          color: isOut ? "#dc2626" : "#d97706",
          weight: "bold" as const,
          align: "end" as const,
          flex: 4,
        },
      ],
    };
  });

  return {
    type: "flex" as const,
    altText: `⚠️ ${title} (${items.length} รายการ) - ${storeName}`,
    contents: {
      type: "bubble" as const,
      size: "giga" as const,
      header: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: headerBg,
        paddingAll: "lg" as const,
        contents: [
          {
            type: "text" as const,
            text: `🏪 ${storeName}`,
            weight: "bold" as const,
            color: "#ffffff",
            size: "lg" as const,
            align: "center" as const,
            wrap: true,
          },
          {
            type: "text" as const,
            text: `⚠️ ${title}`,
            weight: "bold" as const,
            color: "#fee2e2",
            size: "sm" as const,
            align: "center" as const,
            margin: "xs" as const,
            wrap: true,
          },
          {
            type: "text" as const,
            text: `📅 วันที่: ${dateStr} เวลา ${timeStr} น.`,
            color: "#fecaca",
            size: "xs" as const,
            align: "center" as const,
            margin: "xs" as const,
            wrap: true,
          },
        ],
      },
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        contents: [
          {
            type: "box" as const,
            layout: "horizontal" as const,
            contents: [
              {
                type: "text" as const,
                text: "สินค้าที่ต้องตรวจสอบ",
                size: "xs" as const,
                color: "#6b7280",
                weight: "bold" as const,
                flex: 6,
              },
              {
                type: "text" as const,
                text: "สถานะคงเหลือ",
                size: "xs" as const,
                color: "#6b7280",
                weight: "bold" as const,
                align: "end" as const,
                flex: 4,
              },
            ],
          },
          {
            type: "separator" as const,
            margin: "sm" as const,
          },
          {
            type: "box" as const,
            layout: "vertical" as const,
            margin: "md" as const,
            spacing: "md" as const,
            contents:
              itemRows.length > 0
                ? itemRows
                : [
                    {
                      type: "text" as const,
                      text: "สินค้าทุกรายการมีสต็อกเพียงพอ",
                      size: "sm" as const,
                      color: "#10b981",
                      weight: "bold" as const,
                    },
                  ],
          },
          {
            type: "separator" as const,
            margin: "lg" as const,
          },
          {
            type: "box" as const,
            layout: "horizontal" as const,
            margin: "md" as const,
            contents: [
              {
                type: "text" as const,
                text: "รวมสินค้าที่ต้องเติมสต็อก",
                size: "sm" as const,
                color: "#374151",
              },
              {
                type: "text" as const,
                text: `${items.length} รายการ`,
                size: "sm" as const,
                weight: "bold" as const,
                color: "#dc2626",
                align: "end" as const,
              },
            ],
          },
        ],
      },
    },
  };
}
