/**
 * LINE Flex Message Template for Daily Inventory Summary (รายงานสรุปสต็อกสินค้าประจำวัน)
 * แยกไฟล์ออกมาเฉพาะ เพื่อให้ปรับแต่ง ดีไซน์ เพิ่ม-แก้ไข ได้ง่าย
 */

export interface DailySummaryFlexData {
  totalProducts: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalEstimatedCost: number;
  reorderCount: number;
}

export interface DailySummaryFlexOptions {
  storeName?: string;
  themeColor?: string;
}

export function createDailySummaryFlexBubble(
  data: DailySummaryFlexData,
  options: DailySummaryFlexOptions = {},
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
  const storeName = options.storeName || "ร้าน MiniMark";
  const themeColor = options.themeColor || "#2563eb"; // Blue

  return {
    type: "flex" as const,
    altText: `📊 รายงานสรุปสต็อกประจำวัน - ${storeName}`,
    contents: {
      type: "bubble" as const,
      size: "giga" as const,
      header: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: themeColor,
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
            text: "📊 สรุปภาพรวมสต็อกสินค้า",
            weight: "bold" as const,
            color: "#dbeafe",
            size: "sm" as const,
            align: "center" as const,
            margin: "xs" as const,
            wrap: true,
          },
          {
            type: "text" as const,
            text: `📅 วันที่: ${dateStr} เวลา ${timeStr} น.`,
            color: "#bfdbfe",
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
            margin: "md" as const,
            contents: [
              {
                type: "text" as const,
                text: "สินค้าทั้งหมดในระบบ",
                size: "sm" as const,
                color: "#4b5563",
              },
              {
                type: "text" as const,
                text: `${data.totalProducts} รายการ`,
                size: "sm" as const,
                weight: "bold" as const,
                color: "#111827",
                align: "end" as const,
              },
            ],
          },
          {
            type: "box" as const,
            layout: "horizontal" as const,
            margin: "sm" as const,
            contents: [
              {
                type: "text" as const,
                text: "สินค้าพร้อมจำหน่าย",
                size: "sm" as const,
                color: "#4b5563",
              },
              {
                type: "text" as const,
                text: `${data.inStockCount} รายการ`,
                size: "sm" as const,
                weight: "bold" as const,
                color: "#059669",
                align: "end" as const,
              },
            ],
          },
          {
            type: "box" as const,
            layout: "horizontal" as const,
            margin: "sm" as const,
            contents: [
              {
                type: "text" as const,
                text: "สินค้าใกล้หมด (เตือน)",
                size: "sm" as const,
                color: "#4b5563",
              },
              {
                type: "text" as const,
                text: `${data.lowStockCount} รายการ`,
                size: "sm" as const,
                weight: "bold" as const,
                color: "#d97706",
                align: "end" as const,
              },
            ],
          },
          {
            type: "box" as const,
            layout: "horizontal" as const,
            margin: "sm" as const,
            contents: [
              {
                type: "text" as const,
                text: "สินค้าหมดสต็อก",
                size: "sm" as const,
                color: "#4b5563",
              },
              {
                type: "text" as const,
                text: `${data.outOfStockCount} รายการ`,
                size: "sm" as const,
                weight: "bold" as const,
                color: "#dc2626",
                align: "end" as const,
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
                text: "มูลค่าสต็อกคงเหลือ (ทุน)",
                size: "sm" as const,
                color: "#374151",
              },
              {
                type: "text" as const,
                text: `฿${data.totalEstimatedCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
                size: "md" as const,
                weight: "bold" as const,
                color: "#2563eb",
                align: "end" as const,
              },
            ],
          },
        ],
      },
    },
  };
}
