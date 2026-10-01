/**
 * LINE Mini App Entrance Portal Flex Message Template
 * Enables LINE Messaging API to act as the primary entrance gateway to the store's LINE Mini App
 */

import { DEFAULT_STORE_NAME, getSystemStoreName } from "./index";

export interface MiniAppPortalOptions {
  storeName?: string;
  liffId?: string;
  customBaseUrl?: string;
}

export function createMiniAppPortalFlexBubble(options: MiniAppPortalOptions = {}) {
  const storeName = getSystemStoreName(options.storeName);
  const liffId = options.liffId || "2007000000-xxxxxx";
  const baseUrl = options.customBaseUrl || `https://liff.line.me/${liffId}`;

  const reorderUrl = `${baseUrl}/reorder`;
  const stockUrl = `${baseUrl}/stock`;
  const scanUrl = `${baseUrl}/scan`;
  const dashboardUrl = `${baseUrl}`;

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#06C755",
      paddingAll: "20px",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: "🏪 LINE MINI APP PORTAL",
              weight: "bold",
              color: "#FFFFFF",
              size: "xs",
              letterSpacing: "1px",
              flex: 1,
            },
            {
              type: "text",
              text: "VERIFIED",
              color: "#D1FAE5",
              size: "xxs",
              weight: "bold",
              align: "end",
            },
          ],
        },
        {
          type: "text",
          text: storeName,
          weight: "bold",
          color: "#FFFFFF",
          size: "xl",
          margin: "md",
        },
        {
          type: "text",
          text: "ระบบจัดการร้านโชว์ห่วย สต็อก และสั่งซื้อสินค้า",
          color: "#ECFDF5",
          size: "xs",
          margin: "xs",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "18px",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: "✨ เลือกเมนูเพื่อเปิดใช้งาน Mini App ทันที:",
          weight: "bold",
          size: "sm",
          color: "#1F2937",
        },
        // Menu 1: Dashboard (Default Entrance)
        {
          type: "box",
          layout: "horizontal",
          backgroundColor: "#F0FDF4",
          cornerRadius: "12px",
          paddingAll: "12px",
          action: {
            type: "uri",
            label: "เปิดแดชบอร์ดร้านค้า",
            uri: dashboardUrl,
          },
          contents: [
            {
              type: "text",
              text: "📊",
              size: "lg",
              flex: 0,
            },
            {
              type: "box",
              layout: "vertical",
              margin: "md",
              contents: [
                {
                  type: "text",
                  text: "แดชบอร์ด & ภาพรวมร้านค้า (หน้าหลัก)",
                  weight: "bold",
                  size: "sm",
                  color: "#065F46",
                },
                {
                  type: "text",
                  text: "ยอดขาย, สต็อกสินค้าพร้อมขาย, และการทำงานด่วน",
                  size: "xxs",
                  color: "#047857",
                  margin: "xs",
                },
              ],
            },
          ],
        },
        // Menu 2: Reorder
        {
          type: "box",
          layout: "horizontal",
          backgroundColor: "#F8FAFC",
          cornerRadius: "12px",
          paddingAll: "12px",
          action: {
            type: "uri",
            label: "สั่งซื้อสินค้า",
            uri: reorderUrl,
          },
          contents: [
            {
              type: "text",
              text: "🛒",
              size: "lg",
              flex: 0,
            },
            {
              type: "box",
              layout: "vertical",
              margin: "md",
              contents: [
                {
                  type: "text",
                  text: "สั่งซื้อสินค้าประจำวัน (Reorder)",
                  weight: "bold",
                  size: "sm",
                  color: "#1E293B",
                },
                {
                  type: "text",
                  text: "คำนวณยอดสั่ง, ออกใบ PO, ส่งเข้า LINE",
                  size: "xxs",
                  color: "#64748B",
                  margin: "xs",
                },
              ],
            },
          ],
        },
        // Menu 3: Stock
        {
          type: "box",
          layout: "horizontal",
          backgroundColor: "#F8FAFC",
          cornerRadius: "12px",
          paddingAll: "12px",
          action: {
            type: "uri",
            label: "ตรวจนับสต็อก",
            uri: stockUrl,
          },
          contents: [
            {
              type: "text",
              text: "📦",
              size: "lg",
              flex: 0,
            },
            {
              type: "box",
              layout: "vertical",
              margin: "md",
              contents: [
                {
                  type: "text",
                  text: "จัดการสต็อก & สินค้าคงเหลือ (Stock)",
                  weight: "bold",
                  size: "sm",
                  color: "#1E293B",
                },
                {
                  type: "text",
                  text: "ตรวจนับสต็อก, แจ้งเตือนสินค้าใกล้หมด/หมด",
                  size: "xxs",
                  color: "#64748B",
                  margin: "xs",
                },
              ],
            },
          ],
        },
        // Menu 4: Scanner
        {
          type: "box",
          layout: "horizontal",
          backgroundColor: "#F8FAFC",
          cornerRadius: "12px",
          paddingAll: "12px",
          action: {
            type: "uri",
            label: "สแกนบาร์โค้ด",
            uri: scanUrl,
          },
          contents: [
            {
              type: "text",
              text: "📷",
              size: "lg",
              flex: 0,
            },
            {
              type: "box",
              layout: "vertical",
              margin: "md",
              contents: [
                {
                  type: "text",
                  text: "สแกนบาร์โค้ดด่วน (POS Scanner)",
                  weight: "bold",
                  size: "sm",
                  color: "#1E293B",
                },
                {
                  type: "text",
                  text: "สแกนค้นหาสินค้า, รับเข้า, จ่ายออก รวดเร็ว",
                  size: "xxs",
                  color: "#64748B",
                  margin: "xs",
                },
              ],
            },
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      paddingTop: "0px",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#06C755",
          height: "sm",
          action: {
            type: "uri",
            label: "📊 เข้าสู่หน้าแดชบอร์ดหลัก",
            uri: dashboardUrl,
          },
        },
        {
          type: "text",
          text: "เปิดใช้งานผ่าน LINE Mini App ไม่ต้องโหลดแอพเพิ่ม",
          align: "center",
          size: "xxs",
          color: "#9CA3AF",
          margin: "sm",
        },
      ],
    },
  };
}
