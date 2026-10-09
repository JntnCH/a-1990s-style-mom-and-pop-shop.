/**
 * LINE Flex Message Template for Stock Alert (แจ้งเตือนสินค้าใกล้หมด / หมดสต็อก)
 * แยกไฟล์ออกมาเฉพาะ เพื่อให้ปรับแต่ง ดีไซน์ เพิ่ม-แก้ไข ได้ง่าย
 */

import { DEFAULT_STORE_NAME, getSystemStoreName } from "./index";
import {
  type FlexItemGroupBy,
  groupAndSortFlexItems,
  type ItemWithCategoryAndZone,
} from "./flex-grouper";

export interface FlexStockAlertItem extends ItemWithCategoryAndZone {
  name: string;
  stock: number;
  minStock: number;
  unitName: string;
  status: "OUT_OF_STOCK" | "LOW_STOCK";
  categoryId?: string;
  categoryName?: string;
  zoneId?: string;
  zoneName?: string;
  barcode?: string;
}

export interface StockAlertFlexOptions {
  storeName?: string;
  title?: string;
  themeColor?: string;
  groupBy?: FlexItemGroupBy;
  showGroupHeaders?: boolean;
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

  const groupBy = options.groupBy || "zone_then_category";
  const showGroupHeaders = options.showGroupHeaders !== false;

  // Group and sort alert items so products in the same category or zone are adjacent
  const groupedList = groupAndSortFlexItems(items, groupBy);

  const itemRows: Record<string, unknown>[] = [];
  let globalIndex = 0;

  groupedList.forEach((grp, grpIdx) => {
    // Add red-tinted group header for alert items
    if (showGroupHeaders && grp.headerTitle && groupBy !== "none") {
      itemRows.push({
        type: "box",
        layout: "horizontal",
        backgroundColor: "#fef2f2",
        paddingAll: "sm",
        cornerRadius: "md",
        margin: grpIdx === 0 ? "xs" : "md",
        contents: [
          {
            type: "text",
            text: grp.headerTitle,
            size: "xs",
            color: "#991b1b",
            weight: "bold",
            wrap: true,
            flex: 8,
          },
          {
            type: "text",
            text: `${grp.items.length} รายการ`,
            size: "xxs",
            color: "#dc2626",
            align: "end",
            weight: "bold",
            flex: 4,
          },
        ],
      });
    }

    grp.items.forEach(({ item }) => {
      globalIndex++;
      const isOut = item.status === "OUT_OF_STOCK" || item.stock <= 0;
      itemRows.push({
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        margin: "xs",
        contents: [
          {
            type: "text",
            text: `${globalIndex}. ${item.name}`,
            size: "sm",
            color: "#1f2937",
            flex: 6,
            wrap: true,
          },
          {
            type: "text",
            text: isOut ? "สินค้าหมด (0)" : `เหลือ ${item.stock} ${item.unitName}`,
            size: "sm",
            color: isOut ? "#dc2626" : "#d97706",
            weight: "bold",
            align: "end",
            flex: 4,
            wrap: true,
          },
        ],
      });
    });
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
