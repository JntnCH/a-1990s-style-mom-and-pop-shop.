/**
 * LINE Integration Service
 * Handles LINE LIFF, Mini App detection, and LINE Flex Message for Purchase Orders.
 * Strictly adheres to Zero-Secret-Leakage: All keys come from Environment Injection.
 */

import type { ProductItem } from "./store";
import {
  createDailySummaryFlexBubble,
  createPurchaseOrderFlexBubble,
  createStockAlertFlexBubble,
  type FlexStockAlertItem,
} from "./flex-templates";
import { sendLineMessagingApiFn } from "./line-server-fn";

export interface LineOrderItem {
  product: ProductItem;
  quantity: number;
  unitName: string;
}

export interface LineConfigStatus {
  hasLiffId: boolean;
  liffIdDisplay: string;
  isInClient: boolean;
  isLoggedIn: boolean;
  profileName?: string | undefined;
  profilePicture?: string | undefined;
  error?: string | undefined;
}

// Strictly retrieve LIFF ID from Vite env without any hardcoded fallback
export function getClientLiffId(): string | null {
  if (typeof window === "undefined") return null;
  const id = import.meta.env["VITE_LINE_LIFF_ID"];
  if (!id || typeof id !== "string" || id.trim() === "") {
    return null;
  }
  return id.trim();
}

let liffInstance: typeof import("@line/liff").default | null = null;
let liffInitPromise: Promise<boolean> | null = null;

/**
 * Initializes LINE LIFF SDK safely (Browser-only, no fallback secrets)
 */
export async function initLiff(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const liffId = getClientLiffId();
  if (!liffId) {
    return false;
  }

  if (liffInitPromise) {
    return liffInitPromise;
  }

  liffInitPromise = (async () => {
    try {
      const liffMod = await import("@line/liff");
      const liff = liffMod.default;
      liffInstance = liff;
      await liff.init({ liffId });
      return true;
    } catch (err) {
      console.warn("LIFF initialization note:", err);
      return false;
    }
  })();

  return liffInitPromise;
}

/**
 * Gets current LIFF and LINE environment diagnostics.
 */
export async function getLineStatus(): Promise<LineConfigStatus> {
  const liffId = getClientLiffId();
  if (!liffId) {
    return {
      hasLiffId: false,
      liffIdDisplay: "ไม่ได้ตั้งค่า (รอ VITE_LINE_LIFF_ID)",
      isInClient: false,
      isLoggedIn: false,
    };
  }

  const initialized = await initLiff();
  if (!initialized || !liffInstance) {
    return {
      hasLiffId: true,
      liffIdDisplay: `${liffId.slice(0, 4)}...${liffId.slice(-4)}`,
      isInClient: false,
      isLoggedIn: false,
      error: "LIFF Init ไม่สำเร็จ หรือรหัส LIFF ID ไม่ถูกต้อง",
    };
  }

  const inClient = liffInstance.isInClient();
  const loggedIn = liffInstance.isLoggedIn();
  let profileName: string | undefined;
  let profilePicture: string | undefined;

  if (loggedIn) {
    try {
      const profile = await liffInstance.getProfile();
      profileName = profile.displayName;
      profilePicture = profile.pictureUrl;
    } catch {
      // Profile fetch optional
    }
  }

  return {
    hasLiffId: true,
    liffIdDisplay: `${liffId.slice(0, 4)}...${liffId.slice(-4)}`,
    isInClient: inClient,
    isLoggedIn: loggedIn,
    profileName,
    profilePicture,
  };
}

/**
 * Generates LINE Flex Message payload for Daily Purchase Order.
 * Specifications: รายการ -> จำนวน -> หน่วยนับ
 */
export function buildOrderFlexMessage(
  orders: LineOrderItem[],
  note: string = "ใบสั่งซื้อสินค้าประจำวัน",
  storeName: string = "ร้าน MiniMark",
) {
  const items = orders.map((o) => ({
    name: o.product.name,
    quantity: o.quantity,
    unitName: o.unitName,
    costPrice: o.product.costPrice,
    barcode: o.product.barcode,
  }));

  return createPurchaseOrderFlexBubble(items, {
    storeName,
    note,
  });
}

/**
 * Creates plain text fallback for web share intent
 */
export function buildOrderPlainText(
  orders: LineOrderItem[],
  storeName: string = "ร้าน MiniMark",
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH");
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  let text = `📦 ใบสั่งซื้อสินค้าประจำวัน — ${storeName}\n`;
  text += `📅 วันที่: ${dateStr} เวลา ${timeStr} น.\n`;
  text += `────────────────────\n`;
  text += `รายการสินค้า (รายการ -> จำนวน -> หน่วยนับ):\n`;

  orders.forEach((item, index) => {
    text += `${index + 1}. ${item.product.name} ➔ ${item.quantity} ${item.unitName}\n`;
  });

  const totalItems = orders.reduce((sum, o) => sum + o.quantity, 0);
  const totalCost = orders.reduce((sum, o) => sum + o.quantity * (o.product.costPrice || 0), 0);

  text += `────────────────────\n`;
  text += `รวมสินค้า: ${totalItems} หน่วย\n`;
  text += `ประมาณการค่าใช้จ่าย: ฿${totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}\n`;
  text += `ส่งจากระบบ MiniMark`;

  return text;
}

export type LineShareTarget = "group" | "personal";

export interface LineShareResult {
  success: boolean;
  channel: "liff_picker" | "liff_send" | "server_flex";
  message: string;
}

/**
 * Dispatches the order to LINE via the original LIFF Target Picker flow.
 * If LIFF is unavailable, falls back to the server-side Flex push endpoint.
 */
export async function sendOrderToLine(
  orders: LineOrderItem[],
  target: LineShareTarget = "group",
  storeName: string = "ร้าน MiniMark",
): Promise<LineShareResult> {
  const flex = buildOrderFlexMessage(
    orders,
    `ใบสั่งซื้อประจำวัน (${target === "group" ? "กลุ่ม" : "ส่วนตัว"})`,
    storeName,
  );

  const liffId = getClientLiffId();

  if (liffId) {
    const initialized = await initLiff();
    if (initialized && liffInstance) {
      // If inside LINE LIFF with shareTargetPicker capability
      if (liffInstance.isApiAvailable("shareTargetPicker")) {
        try {
          const res = await liffInstance.shareTargetPicker([flex]);
          if (res) {
            return {
              success: true,
              channel: "liff_picker",
              message:
                target === "group" ? "ส่งเข้า LINE กลุ่มสำเร็จ" : "ส่งเข้า LINE ส่วนตัวสำเร็จ",
            };
          }
          return {
            success: false,
            channel: "liff_picker",
            message: "ผู้ใช้ยกเลิกการเลือกแชท LINE",
          };
        } catch (pickerErr) {
          console.warn("LIFF shareTargetPicker error:", pickerErr);
        }
      }

      // If already in client chat and can send messages directly
      if (liffInstance.isInClient()) {
        try {
          await liffInstance.sendMessages([flex]);
          return {
            success: true,
            channel: "liff_send",
            message: "ส่งข้อความ Flex Message เข้าแชท LINE เรียบร้อยแล้ว",
          };
        } catch (sendErr) {
          console.warn("LIFF sendMessages error:", sendErr);
        }
      }
    }
  }

  // Fallback: keep the message as Flex and send via LINE Messaging API.
  // The server resolves LINE_TO_ID; no plain-text share URL is used.
  try {
    const res = await sendLineMessagingApiFn({
      data: {
        orderSummary: `ใบสั่งซื้อประจำวัน (${target === "group" ? "กลุ่ม" : "ส่วนตัว"})`,
        flexMessage: flex,
      },
    });
    if (res.success) {
      return {
        success: true,
        channel: "server_flex",
        message: "ส่ง Flex Message ผ่าน LINE Messaging API สำเร็จ",
      };
    }
    return {
      success: false,
      channel: "server_flex",
      message: res.error || "ไม่สามารถส่ง Flex Message ผ่าน LINE Messaging API ได้",
    };
  } catch (err: unknown) {
    return {
      success: false,
      channel: "server_flex",
      message: `ส่ง Flex Message ไม่สำเร็จ: ${String(err)}`,
    };
  }
}

export interface OrderFlexItem {
  name: string;
  quantity: number;
  unitName: string;
  barcode?: string;
  priceEstimate?: number;
}

export function formatDailyOrderFlexMessage(items: OrderFlexItem[], dateStr?: string) {
  const nowStr = new Date().toISOString();
  const lineOrders: LineOrderItem[] = items.map((i) => ({
    product: {
      id: i.barcode || i.name,
      barcode: i.barcode || "",
      codeType: "Barcode",
      name: i.name,
      categoryId: "",
      zoneId: "",
      unitId: "",
      costPrice: i.priceEstimate && i.quantity ? i.priceEstimate / i.quantity : 0,
      sellPrice: 0,
      stock: 0,
      minStock: 0,
      reorderQuantity: i.quantity,
      updatedAt: nowStr,
    },
    quantity: i.quantity,
    unitName: i.unitName,
  }));
  return buildOrderFlexMessage(lineOrders, `ใบสั่งซื้อประจำวัน (${dateStr || "วันนี้"})`);
}

export function formatOrderPlainText(items: OrderFlexItem[], dateStr?: string): string {
  const nowStr = new Date().toISOString();
  const lineOrders: LineOrderItem[] = items.map((i) => ({
    product: {
      id: i.barcode || i.name,
      barcode: i.barcode || "",
      codeType: "Barcode",
      name: i.name,
      categoryId: "",
      zoneId: "",
      unitId: "",
      costPrice: i.priceEstimate && i.quantity ? i.priceEstimate / i.quantity : 0,
      sellPrice: 0,
      stock: 0,
      minStock: 0,
      reorderQuantity: i.quantity,
      updatedAt: nowStr,
    },
    quantity: i.quantity,
    unitName: i.unitName,
  }));
  return buildOrderPlainText(lineOrders);
}

export async function sendDailyOrderToLine(
  items: (OrderFlexItem & { product?: ProductItem })[],
  target: LineShareTarget = "group",
  dateStr?: string,
): Promise<{ success: boolean; method?: string; error?: string }> {
  const nowStr = new Date().toISOString();
  const lineOrders: LineOrderItem[] = items.map((i) => ({
    product: i.product || {
      id: i.barcode || i.name,
      barcode: i.barcode || "",
      codeType: "Barcode",
      name: i.name,
      categoryId: "",
      zoneId: "",
      unitId: "",
      costPrice: i.priceEstimate && i.quantity ? i.priceEstimate / i.quantity : 0,
      sellPrice: 0,
      stock: 0,
      minStock: 0,
      reorderQuantity: i.quantity,
      updatedAt: nowStr,
    },
    quantity: i.quantity,
    unitName: i.unitName,
  }));

  const res = await sendOrderToLine(lineOrders, target);
  const result: { success: boolean; method?: string; error?: string } = {
    success: res.success,
    method:
      res.channel === "liff_picker"
        ? "share_target_picker"
        : res.channel === "liff_send"
          ? "liff_send"
          : "server_flex",
  };
  if (!res.success && res.message) {
    result.error = res.message;
  }
  return result;
}

export async function sendStockAlertToLine(
  alertItems: FlexStockAlertItem[],
  target: LineShareTarget = "group",
  storeName: string = "ร้าน MiniMark",
): Promise<{ success: boolean; method?: string; error?: string }> {
  const isAvailable = await initLiff();
  const flexMsg = createStockAlertFlexBubble(alertItems, { storeName });

  if (isAvailable && liffInstance?.isApiAvailable("shareTargetPicker")) {
    try {
      const res = await liffInstance.shareTargetPicker([flexMsg]);
      if (res) {
        return { success: true, method: "share_target_picker" };
      }
      return { success: false, error: "ผู้ใช้ยกเลิกการแชร์" };
    } catch (e: unknown) {
      console.warn("ShareTargetPicker failed, falling back to intent", e);
    }
  }

  // Fallback to text intent
  let text = `⚠️ แจ้งเตือนสต็อกสินค้าต้องสั่งซื้อ — ${storeName}\n`;
  text += `────────────────────\n`;
  alertItems.forEach((item, index) => {
    const statusText =
      item.status === "OUT_OF_STOCK" ? "สินค้าหมด (0)" : `เหลือ ${item.stock} ${item.unitName}`;
    text += `${index + 1}. ${item.name} ➔ ${statusText}\n`;
  });
  text += `────────────────────\nกรุณาเข้าสู่ระบบ MiniMark เพื่อตรวจสอบสต็อก`;

  const encoded = encodeURIComponent(text);
  const url = `https://line.me/R/msg/text/?${encoded}`;

  if (typeof window !== "undefined") {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return { success: true, method: "web_intent" };
}
