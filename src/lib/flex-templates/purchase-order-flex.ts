/**
 * LINE Flex Message Template for Purchase Orders (ใบสั่งซื้อสินค้า)
 * แยกไฟล์ออกมาเฉพาะ เพื่อให้ปรับแต่ง ดีไซน์ เพิ่ม-แก้ไข และดูแลได้ง่าย
 */

/**
 * LINE Flex Message Template for Purchase Orders (ใบสั่งซื้อสินค้า)
 * ออกแบบโครงสร้าง:
 * 1. ชื่อร้านขึ้นก่อนเด่นชัด
 * 2. ข้อมูลไม่ซ้ำซ้อน (วันที่แสดงบรรทัดเดียว ไม่ซ้ำในชื่อหัวข้อ)
 * 3. ทุกตัวอักษร wrap: true ไม่ออกนอกบล็อกและไม่โดนตัดเป็น ...
 * 4. รองรับการแทนที่ด้วย Custom JSON จาก LINE Simulator
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
  liffId?: string;
  customBaseUrl?: string;
}

/**
 * สร้าง Flex Message Bubble สำหรับใบสั่งซื้อสินค้าประจำวัน
 * รูปแบบแสดงผล: รายการ -> จำนวน -> หน่วยนับ พร้อมยอดรวมและมูลค่าโดยประมาณ
 * พร้อมปุ่มลัดสำหรับเปิดหน้าแดชบอร์ดหลัก และเปิดดูใบสั่งซื้อ
 */
export function createPurchaseOrderFlexBubble(
  items: FlexOrderItem[],
  options: PurchaseOrderFlexOptions = {},
) {
  // Check if user has saved a custom template in localStorage
  if (typeof window !== "undefined") {
    try {
      const customSaved = localStorage.getItem("minimark_custom_po_flex_json");
      if (customSaved && customSaved.trim()) {
        const parsed = JSON.parse(customSaved);
        if (parsed && typeof parsed === "object") {
          if (parsed.type === "flex" && parsed.contents) {
            return parsed;
          }
          if (parsed.type === "bubble" || parsed.type === "carousel") {
            return {
              type: "flex" as const,
              altText: `📦 ใบสั่งซื้อสินค้า - ${options.storeName || "ร้าน โชห่วยยุค 90s"}`,
              contents: parsed,
            };
          }
        }
      }
    } catch {
      // fallback to default generator
    }
  }

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
  // Clean note so date is not repeated if passed in note
  const cleanNote = note.replace(/\s*\(.*?\)\s*/g, "").trim() || "ใบสั่งซื้อสินค้าประจำวัน";
  const themeColor = options.themeColor || "#06c755";
  const liffId = options.liffId || "2011710264-gaZ7oEcK";
  const baseUrl = options.customBaseUrl || `https://liff.line.me/${liffId}`;
  const dashboardUrl = `${baseUrl}`;
  const reorderUrl = `${baseUrl}/reorder`;

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
        wrap: true,
      },
    ],
  }));

  return {
    type: "flex" as const,
    altText: `📦 ${storeName} — ${cleanNote} (${totalItems} รายการ)`,
    contents: {
      type: "bubble" as const,
      size: "mega" as const,
      header: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: themeColor,
        paddingAll: "lg" as const,
        action: {
          type: "uri" as const,
          label: "เปิดหน้าแดชบอร์ดหลัก",
          uri: dashboardUrl,
        },
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
            text: `📦 ${cleanNote}`,
            weight: "bold" as const,
            color: "#e6fffa",
            size: "sm" as const,
            align: "center" as const,
            margin: "xs" as const,
            wrap: true,
          },
          {
            type: "text" as const,
            text: `📅 วันที่: ${dateStr} เวลา ${timeStr} น.`,
            color: "#d1fae5",
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
                text: "รายการสินค้าที่จะสั่งซื้อ",
                size: "xs" as const,
                color: "#6b7280",
                weight: "bold" as const,
                flex: 6,
                wrap: true,
              },
              {
                type: "text" as const,
                text: "จำนวน / หน่วยนับ",
                size: "xs" as const,
                color: "#6b7280",
                weight: "bold" as const,
                align: "end" as const,
                flex: 4,
                wrap: true,
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
                      wrap: true,
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
                flex: 6,
                wrap: true,
              },
              {
                type: "text" as const,
                text: `${totalItems} รายการ`,
                size: "sm" as const,
                weight: "bold" as const,
                color: "#111827",
                align: "end" as const,
                flex: 4,
                wrap: true,
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
                flex: 5,
                wrap: true,
              },
              {
                type: "text" as const,
                text: `฿${totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
                size: "md" as const,
                weight: "bold" as const,
                color: "#059669",
                align: "end" as const,
                flex: 5,
                wrap: true,
              },
            ],
          },
        ],
      },
      footer: {
        type: "box" as const,
        layout: "vertical" as const,
        spacing: "sm" as const,
        paddingAll: "md" as const,
        paddingTop: "none" as const,
        contents: [
          {
            type: "button" as const,
            style: "primary" as const,
            color: "#06C755",
            height: "sm" as const,
            action: {
              type: "uri" as const,
              label: "📊 เปิดแดชบอร์ดร้าน (หน้าแรก)",
              uri: dashboardUrl,
            },
          },
          {
            type: "button" as const,
            style: "secondary" as const,
            height: "sm" as const,
            action: {
              type: "uri" as const,
              label: "📋 จัดการใบสั่งซื้อ & ตรวจรับ",
              uri: reorderUrl,
            },
          },
        ],
      },
    },
  };
}
