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
import { getLineServerConfigFn, sendLineMessagingApiFn } from "./line-server-fn";

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

let memoryLiffId: string | null = null;

// Retrieve LIFF ID from memory, URL params, localStorage, Vite env, or runtime config
export function getClientLiffId(): string | null {
  if (memoryLiffId && memoryLiffId.trim() && memoryLiffId.trim() !== "xxxxx-xxxxx") {
    return memoryLiffId.trim();
  }
  if (typeof window !== "undefined") {
    // 1. Check URL parameters (e.g. ?liffId=... or ?liff_id=...)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramId =
        urlParams.get("liffId") || urlParams.get("liff_id") || urlParams.get("liffID");
      if (paramId && paramId.trim() && paramId.trim() !== "xxxxx-xxxxx") {
        setClientLiffId(paramId.trim());
        return paramId.trim();
      }
    } catch {
      // ignore
    }

    // 2. Check window cached object
    const w = window as unknown as { __MINIMARK_LIFF_ID?: string };
    if (
      w.__MINIMARK_LIFF_ID &&
      w.__MINIMARK_LIFF_ID.trim() &&
      w.__MINIMARK_LIFF_ID.trim() !== "xxxxx-xxxxx"
    ) {
      memoryLiffId = w.__MINIMARK_LIFF_ID.trim();
      return memoryLiffId;
    }

    // 3. Check localStorage
    const local = localStorage.getItem("minimark_line_liff_id");
    if (local && local.trim() && local.trim() !== "xxxxx-xxxxx") {
      memoryLiffId = local.trim();
      return memoryLiffId;
    }
  }
  const id =
    import.meta.env["VITE_LINE_LIFF_ID"] ||
    import.meta.env["LINE_LIFF_ID"] ||
    import.meta.env["VITE_LIFF_ID"] ||
    import.meta.env["LIFF_ID"];
  if (id && typeof id === "string" && id.trim() !== "" && id.trim() !== "xxxxx-xxxxx") {
    memoryLiffId = id.trim();
    return memoryLiffId;
  }
  return null;
}

export function setClientLiffId(id: string): void {
  if (!id || !id.trim() || id.trim() === "xxxxx-xxxxx") {
    memoryLiffId = null;
    if (typeof window !== "undefined") {
      const w = window as unknown as { __MINIMARK_LIFF_ID?: string };
      delete w.__MINIMARK_LIFF_ID;
      localStorage.removeItem("minimark_line_liff_id");
    }
  } else {
    memoryLiffId = id.trim();
    if (typeof window !== "undefined") {
      const w = window as unknown as { __MINIMARK_LIFF_ID?: string };
      w.__MINIMARK_LIFF_ID = id.trim();
      localStorage.setItem("minimark_line_liff_id", id.trim());
    }
  }
  liffInstance = null;
  liffInitPromise = null;
}

let liffInstance: typeof import("@line/liff").default | null = null;
let isInitializingLiff = false;

/**
 * Initializes LINE LIFF SDK safely (Browser-only)
 */
export async function initLiff(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (liffInstance) return true;
  if (isInitializingLiff) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (liffInstance) return true;
  }

  let liffId = getClientLiffId();
  if (!liffId) {
    try {
      const cfg = await getLineServerConfigFn();
      if (cfg?.configuredLiffId) {
        setClientLiffId(cfg.configuredLiffId);
        liffId = cfg.configuredLiffId;
      }
    } catch {
      // ignore
    }
  }
  if (!liffId) {
    return false;
  }

  isInitializingLiff = true;
  try {
    const liffMod = await import("@line/liff");
    const liff = liffMod.default;

    if (!liff.id) {
      await liff.init({ liffId, withLoginOnExternalBrowser: false });
    }
    liffInstance = liff;
    return true;
  } catch (err) {
    console.warn("LIFF initialization note:", err);
    liffInstance = null;
    return false;
  } finally {
    isInitializingLiff = false;
  }
}

/**
 * Gets current LIFF and LINE environment diagnostics safely without eager SDK init.
 */
export async function getLineStatus(): Promise<LineConfigStatus> {
  try {
    const liffId = getClientLiffId();
    if (!liffId) {
      return {
        hasLiffId: false,
        liffIdDisplay: "ไม่ได้ตั้งค่า (ดึงจาก GitHub Secrets)",
        isInClient: false,
        isLoggedIn: false,
      };
    }

    if (liffInstance) {
      const inClient =
        typeof liffInstance.isInClient === "function" ? liffInstance.isInClient() : false;
      const loggedIn =
        typeof liffInstance.isLoggedIn === "function" ? liffInstance.isLoggedIn() : false;
      let profileName: string | undefined;
      let profilePicture: string | undefined;

      if (loggedIn && typeof liffInstance.getProfile === "function") {
        try {
          const profile = await liffInstance.getProfile();
          profileName = profile?.displayName;
          profilePicture = profile?.pictureUrl;
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

    return {
      hasLiffId: true,
      liffIdDisplay: `${liffId.slice(0, 4)}...${liffId.slice(-4)}`,
      isInClient: false,
      isLoggedIn: false,
    };
  } catch (err) {
    return {
      hasLiffId: false,
      liffIdDisplay: "เกิดข้อผิดพลาด",
      isInClient: false,
      isLoggedIn: false,
      error: String(err),
    };
  }
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

export interface ThreeTierSendOptions {
  summary: string;
  flexMessage?: unknown;
  target?: LineShareTarget;
  toUserIdOrGroupId?: string;
  isBroadcast?: boolean;
  channelAccessToken?: string;
  disableIntentFallback?: boolean;
}

export interface LineShareResult {
  success: boolean;
  channel: "server_api" | "liff_picker" | "liff_send" | "line_intent";
  tier: 1 | 2 | 3;
  message: string;
  fallbackReason?: string | undefined;
}

/**
 * Directly trigger LINE LIFF shareTargetPicker with a Flex Message
 */
export async function shareFlexViaLiffPicker(
  flexMessage: unknown,
  altSummary: string = "รายการสั่งซื้อสินค้า MiniMark",
): Promise<{ success: boolean; message: string; needLiffId?: boolean }> {
  if (typeof window === "undefined") {
    return { success: false, message: "ทำงานบนเบราว์เซอร์เท่านั้น" };
  }

  let liffId = getClientLiffId();
  if (!liffId) {
    try {
      const cfg = await getLineServerConfigFn();
      if (cfg?.configuredLiffId) {
        setClientLiffId(cfg.configuredLiffId);
        liffId = cfg.configuredLiffId;
      }
    } catch {
      // ignore
    }
  }

  if (!liffId) {
    return {
      success: false,
      needLiffId: false,
      message:
        "ไม่พบคีย์ LINE_LIFF_ID ใน GitHub Secrets หรือ Server Environment (ระบบดึงคีย์อัตโนมัติ ไม่มีการให้กรอกคีย์บนหน้าเว็บ กรุณาตรวจสอบการตั้งค่าคีย์ใน GitHub Secrets)",
    };
  }

  const initialized = await initLiff();
  if (!initialized || !liffInstance) {
    return {
      success: false,
      message: `ไม่สามารถเริ่มต้น LINE LIFF SDK ได้ (${liffId}) กรุณาตรวจสอบ LIFF ID`,
    };
  }

  const inClient =
    typeof liffInstance.isInClient === "function" ? liffInstance.isInClient() : false;
  const isLoggedIn =
    typeof liffInstance.isLoggedIn === "function" ? liffInstance.isLoggedIn() : false;

  // If outside LINE and not logged in, prompt LINE login ONLY upon explicit user click
  if (!isLoggedIn && !inClient) {
    try {
      liffInstance.login({ redirectUri: window.location.href });
      return { success: false, message: "กำลังเปิดหน้าเข้าสู่ระบบ LINE..." };
    } catch {
      return {
        success: false,
        message: "กรุณาเปิดหน้านี้ผ่านแอป LINE เพื่อเลือกเพื่อนส่ง Flex Message",
      };
    }
  }

  try {
    let messagePayload: Record<string, unknown>;
    if (flexMessage && typeof flexMessage === "object") {
      const flexObj = flexMessage as Record<string, unknown>;
      if (flexObj["type"] === "flex" && flexObj["contents"]) {
        messagePayload = {
          type: "flex",
          altText: (flexObj["altText"] as string) || altSummary,
          contents: flexObj["contents"],
        };
      } else if (flexObj["type"] === "bubble" || flexObj["type"] === "carousel") {
        messagePayload = {
          type: "flex",
          altText: altSummary,
          contents: flexObj,
        };
      } else if (flexObj["contents"]) {
        messagePayload = {
          type: "flex",
          altText: (flexObj["altText"] as string) || altSummary,
          contents: flexObj["contents"],
        };
      } else {
        messagePayload = {
          type: "flex",
          altText: altSummary,
          contents: flexObj,
        };
      }
    } else {
      messagePayload = { type: "text", text: altSummary };
    }

    if (typeof liffInstance.shareTargetPicker === "function") {
      const res = await liffInstance.shareTargetPicker([messagePayload]);
      if (res) {
        return {
          success: true,
          message: "ส่ง LINE Flex Message ไปยังเพื่อน/กลุ่มที่เลือกสำเร็จแล้ว",
        };
      }
      return { success: false, message: "ยกเลิกการเลือกห้องแชทใน LINE" };
    }

    return {
      success: false,
      message: "ไม่พบฟังก์ชัน Share Target Picker ใน LINE LIFF SDK",
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (
      errMsg.toLowerCase().includes("permission") ||
      errMsg.toLowerCase().includes("not available") ||
      errMsg.toLowerCase().includes("api")
    ) {
      return {
        success: false,
        message:
          "ยังไม่ได้เปิดฟังก์ชัน Share Target Picker ใน LINE Developers Console (กรุณาปรับ Share Target Picker เป็น ON ในแท็บ LIFF)",
      };
    }
    return { success: false, message: `LINE Share Target Picker แจ้งเตือน: ${errMsg}` };
  }
}

/**
 * 3-Tier Fallback Dispatcher for LINE Messaging:
 * Tier 1: Server LINE Messaging API (Push/Broadcast via Bot)
 * Tier 2: LINE LIFF shareTargetPicker / in-client send
 * Tier 3: Web Share Intent (https://line.me/R/share)
 */
export async function sendWith3TierFallback(
  options: ThreeTierSendOptions,
): Promise<LineShareResult> {
  const { summary, flexMessage, target = "group", toUserIdOrGroupId, isBroadcast } = options;
  let tier1ErrorReason = "";

  const tokenToUse =
    options.channelAccessToken ||
    (typeof window !== "undefined"
      ? localStorage.getItem("minimark_line_channel_token") || undefined
      : undefined);

  // ─────────────────────────────────────────────────────────────
  // Tier 1: Server LINE Messaging API (Sends REAL Flex Message)
  // ─────────────────────────────────────────────────────────────
  try {
    const serverRes = await sendLineMessagingApiFn({
      data: {
        orderSummary: summary,
        flexMessage,
        toUserIdOrGroupId,
        isBroadcast,
        channelAccessToken: tokenToUse,
      },
    });

    if (serverRes.success) {
      return {
        success: true,
        channel: "server_api",
        tier: 1,
        message: "ส่ง Flex Message ผ่าน Server LINE Messaging API สำเร็จ (Tier 1)",
      };
    } else {
      tier1ErrorReason = serverRes.error || "Server LINE Messaging API ไม่พร้อมใช้งาน";
      console.warn(
        `[3-Tier Fallback] Tier 1 unavailable: ${tier1ErrorReason}. Cascading to Tier 2 (LIFF)...`,
      );
    }
  } catch (err: unknown) {
    tier1ErrorReason = err instanceof Error ? err.message : String(err);
    console.warn(
      `[3-Tier Fallback] Tier 1 error: ${tier1ErrorReason}. Cascading to Tier 2 (LIFF)...`,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Tier 2: LINE LIFF shareTargetPicker / In-client Send
  // ─────────────────────────────────────────────────────────────
  const liffId = getClientLiffId();
  if (liffId && typeof window !== "undefined") {
    try {
      const initialized = await initLiff();
      if (initialized && liffInstance) {
        const messagePayload = flexMessage || { type: "text", text: summary };

        // 2a. shareTargetPicker (sends REAL Flex Message inside LINE)
        if (liffInstance.isApiAvailable("shareTargetPicker") && liffInstance.isLoggedIn()) {
          try {
            const pickerRes = await liffInstance.shareTargetPicker([messagePayload]);
            if (pickerRes) {
              return {
                success: true,
                channel: "liff_picker",
                tier: 2,
                message: `ส่ง Flex Message เข้า LINE (${target === "group" ? "กลุ่ม" : "ส่วนตัว"}) ผ่าน LIFF Target Picker สำเร็จ (Tier 2)`,
                fallbackReason: tier1ErrorReason,
              };
            }
            return {
              success: false,
              channel: "liff_picker",
              tier: 2,
              message: "ผู้ใช้ยกเลิกการเลือกห้องแชทใน LINE",
              fallbackReason: tier1ErrorReason,
            };
          } catch (pickerErr) {
            console.warn(
              "[3-Tier Fallback] Tier 2 shareTargetPicker error, trying in-client send:",
              pickerErr,
            );
          }
        }

        // 2b. In-client direct chat send
        if (liffInstance.isInClient()) {
          try {
            await liffInstance.sendMessages([messagePayload]);
            return {
              success: true,
              channel: "liff_send",
              tier: 2,
              message: "ส่งข้อความ Flex Message เข้าแชท LINE ผ่าน LIFF สำเร็จ (Tier 2)",
              fallbackReason: tier1ErrorReason,
            };
          } catch (sendErr) {
            console.warn("[3-Tier Fallback] Tier 2 sendMessages error:", sendErr);
          }
        }
      }
    } catch (liffErr) {
      console.warn("[3-Tier Fallback] Tier 2 initialization error:", liffErr);
    }
  }

  // If intent fallback is explicitly disabled, report the exact error
  if (options.disableIntentFallback) {
    return {
      success: false,
      channel: "server_api",
      tier: 1,
      message:
        tier1ErrorReason ||
        "ไม่สามารถส่ง Flex Message ได้ กรุณาตรวจสอบ Channel Access Token หรือ User ID / Group ID",
      fallbackReason: tier1ErrorReason,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Tier 3: Web Share Intent (https://line.me/R/share) - Plain Text Fallback
  // ─────────────────────────────────────────────────────────────
  const lineIntentUrl = `https://line.me/R/share?text=${encodeURIComponent(summary)}`;
  if (typeof window !== "undefined") {
    const link = document.createElement("a");
    link.href = lineIntentUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return {
    success: true,
    channel: "line_intent",
    tier: 3,
    message: `เปิดหน้าแชร์ LINE ด้วยข้อความธรรมดา (Web Share Intent) สำเร็จ (Tier 3 Fallback)`,
    fallbackReason: tier1ErrorReason,
  };
}

/**
 * Dispatches the order to LINE utilizing the 3-Tier Fallback Architecture:
 * 1. Server Messaging API -> 2. LIFF Target Picker -> 3. Web Share Intent
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
  const plain = buildOrderPlainText(orders, storeName);

  return sendWith3TierFallback({
    summary: plain,
    flexMessage: flex,
    target,
  });
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
    method: res.channel === "liff_picker" ? "share_target_picker" : "web_intent",
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
): Promise<{ success: boolean; method?: string; error?: string; tier?: number }> {
  const flexMsg = createStockAlertFlexBubble(alertItems, { storeName });

  let text = `⚠️ แจ้งเตือนสต็อกสินค้าต้องสั่งซื้อ — ${storeName}\n`;
  text += `────────────────────\n`;
  alertItems.forEach((item, index) => {
    const statusText =
      item.status === "OUT_OF_STOCK" ? "สินค้าหมด (0)" : `เหลือ ${item.stock} ${item.unitName}`;
    text += `${index + 1}. ${item.name} ➔ ${statusText}\n`;
  });
  text += `────────────────────\nกรุณาเข้าสู่ระบบ MiniMark เพื่อตรวจสอบสต็อก`;

  const res = await sendWith3TierFallback({
    summary: text,
    flexMessage: flexMsg,
    target,
  });

  return {
    success: res.success,
    method: res.channel,
    tier: res.tier,
    error: res.success ? undefined : res.message,
  };
}
