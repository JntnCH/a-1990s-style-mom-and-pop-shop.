/**
 * LINE Flex Message Template for Purchase Orders (ใบสั่งซื้อสินค้า)
 * แยกไฟล์ออกมาเฉพาะ เพื่อให้ปรับแต่ง ดีไซน์ เพิ่ม-แก้ไข และดูแลได้ง่าย
 */

export interface FlexOrderItem {
  name: string;
  quantity: number;
  unitName: string;
  costPrice?: number;
  barcode?: string;
}

export interface PurchaseOrderFlexOptions {
  storeName?: string;
  note?: string;
  orderNumber?: string;
  dateStr?: string;
  timeStr?: string;
  themeColor?: string;
}

/**
 * สร้าง Flex Message Bubble สำหรับใบสั่งซื้อสินค้าประจำวัน
 * รูปแบบแสดงผล: รายการ -> จำนวน -> หน่วยนับ พร้อมยอดรวมและมูลค่าโดยประมาณ
 */
export function createPurchaseOrderFlexBubble(
  items: FlexOrderItem[],
  options: PurchaseOrderFlexOptions = {},
) {
  const now = new Date();
  const dateStr =
    options.dateStr ||
    now.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const timeStr =
    options.timeStr ||
    now.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const storeName = options.storeName || "ร้าน MiniMark";
  const note = options.note || "ใบสั่งซื้อสินค้าประจำวัน";
  const themeColor = options.themeColor || "#06c755";

  const totalItems = items.reduce((sum, o) => sum + o.quantity, 0);
  const totalCost = items.reduce((sum, o) => sum + o.quantity * (o.costPrice || 0), 0);

  const itemRows = items.map((item, index) => ({
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
        text: `${item.quantity} ${item.unitName}`,
        size: "sm" as const,
        color: "#059669",
        weight: "bold" as const,
        align: "end" as const,
        flex: 4,
      },
    ],
  }));

  return {
    type: "flex" as const,
    altText: `📦 ${note} (${totalItems} ชิ้น) - ${storeName}`,
    contents: {
      type: "bubble" as const,
      size: "mega" as const,
      header: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: themeColor,
        paddingAll: "lg" as const,
        contents: [
          {
            type: "text" as const,
            text: `📦 ${note}`,
            weight: "bold" as const,
            color: "#ffffff",
            size: "lg" as const,
          },
          {
            type: "text" as const,
            text: `${storeName} • ${dateStr} ${timeStr} น.`,
            color: "#e6fffa",
            size: "xs" as const,
            margin: "xs" as const,
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
                text: "รายการสินค้าที่จะสั่งซื้อ",
                size: "xs" as const,
                color: "#6b7280",
                weight: "bold" as const,
                flex: 6,
              },
              {
                type: "text" as const,
                text: "จำนวน / หน่วยนับ",
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
                      text: "ไม่มีรายการสินค้า",
                      size: "sm" as const,
                      color: "#9ca3af",
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
                text: "รวมจำนวนสินค้าทั้งหมด",
                size: "sm" as const,
                color: "#374151",
              },
              {
                type: "text" as const,
                text: `${totalItems} รายการ`,
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
            margin: "xs" as const,
            contents: [
              {
                type: "text" as const,
                text: "ประมาณการยอดเงินสั่งซื้อ",
                size: "sm" as const,
                color: "#374151",
              },
              {
                type: "text" as const,
                text: `฿${totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
                size: "md" as const,
                weight: "bold" as const,
                color: "#059669",
                align: "end" as const,
              },
            ],
          },
        ],
      },
    },
  };
}
