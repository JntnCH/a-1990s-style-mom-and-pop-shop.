import { createServerFn } from "@tanstack/react-start";
import {
  createMiniAppPortalFlexBubble,
  DEFAULT_STORE_NAME,
  getSystemStoreName,
} from "./flex-templates";

export interface SendLineOrderPayload {
  toUserIdOrGroupId?: string | undefined;
  orderSummary: string;
  flexMessage?: unknown;
  channelAccessToken?: string | undefined;
  isBroadcast?: boolean;
}

export interface ServerLineFollower {
  userId: string;
  displayName: string;
  pictureUrl?: string | undefined;
  statusMessage?: string | undefined;
  followedAt: string;
  lastInteractionAt: string;
  role: "admin" | "staff" | "viewer";
}

export interface ServerSyncPayload {
  lastUpdated?: string | undefined;
  products?: unknown[] | undefined;
  categories?: unknown[] | undefined;
  zones?: unknown[] | undefined;
  units?: unknown[] | undefined;
  receives?: unknown[] | undefined;
  followers?: ServerLineFollower[] | undefined;
  movements?: unknown[] | undefined;
  purchaseOrders?: unknown[] | undefined;
}

// In-Memory Global Server Store (Single Source of Truth across all active clients)
const globalServerDatabase: {
  lastUpdated: string;
  products?: unknown[] | undefined;
  categories?: unknown[] | undefined;
  zones?: unknown[] | undefined;
  units?: unknown[] | undefined;
  receives?: unknown[] | undefined;
  followers: ServerLineFollower[];
  movements?: unknown[] | undefined;
  purchaseOrders?: unknown[] | undefined;
} = {
  lastUpdated: new Date().toISOString(),
  followers: [
    {
      userId: "C112233445566778899",
      displayName: "กลุ่มไลน์สั่งซื้อสินค้า (PO Store Group)",
      pictureUrl:
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=120&auto=format&fit=crop&q=80",
      statusMessage: "กลุ่มแชทไลน์สำหรับรับใบสั่งซื้อหน้าร้าน",
      followedAt: "2026-09-23 09:00 น.",
      lastInteractionAt: "2026-09-27 10:00 น.",
      role: "viewer",
    },
    {
      userId: "U77b8899aabbccdde1",
      displayName: "บริษัท ยูนิลีเวอร์ (Unilever Supplier)",
      pictureUrl:
        "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&auto=format&fit=crop&q=80",
      statusMessage: "ตัวแทนจำหน่ายสินค้าอุปโภคบริโภคหลัก",
      followedAt: "2026-09-22 11:20 น.",
      lastInteractionAt: "2026-09-26 14:10 น.",
      role: "staff",
    },
    {
      userId: "U55c66778899aabb11",
      displayName: "เจริญทรัพย์ค้าส่ง ยี่ปั๊ว (Wholesale)",
      pictureUrl:
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
      statusMessage: "ร้านค้าส่งยี่ปั๊ว ประจำอำเภอ ส่งของทุกวันอังคาร/ศุกร์",
      followedAt: "2026-09-21 14:00 น.",
      lastInteractionAt: "2026-09-26 09:30 น.",
      role: "staff",
    },
    {
      userId: "U44d5566778899aabb",
      displayName: "ตัวแทนจำหน่ายเครื่องดื่ม (Beverage Rep)",
      pictureUrl:
        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80",
      statusMessage: "ฝ่ายขาย บ.เครื่องดื่มและขนมขบเคี้ยว",
      followedAt: "2026-09-23 15:00 น.",
      lastInteractionAt: "2026-09-27 11:20 น.",
      role: "staff",
    },
    {
      userId: "C998877665544332211",
      displayName: "กลุ่มไลน์พนักงานจัดซื้อ (Purchasing Team)",
      pictureUrl:
        "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=120&auto=format&fit=crop&q=80",
      statusMessage: "ทีมสั่งของและตรวจรับสต็อกประจำร้าน",
      followedAt: "2026-09-24 10:00 น.",
      lastInteractionAt: "2026-09-27 12:00 น.",
      role: "viewer",
    },
    {
      userId: "U88f0192a83b27b9c1",
      displayName: "ผู้ดูแลร้าน (Admin Master)",
      pictureUrl:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      statusMessage: "ประจำหน้าร้าน โชห่วยยุค 90s",
      followedAt: "2026-09-20 08:30 น.",
      lastInteractionAt: "2026-09-25 10:15 น.",
      role: "admin",
    },
    {
      userId: "U99e1234c56d78a9b2",
      displayName: "พนักงานสต็อก (Staff Store)",
      pictureUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
      statusMessage: "รับสินค้าเข้าโกดัง",
      followedAt: "2026-09-21 09:00 น.",
      lastInteractionAt: "2026-09-24 16:40 น.",
      role: "staff",
    },
  ],
};

export const DEFAULT_LINE_LIFF_ID = "2011710264-gaZ7oEcK";

export const getLineServerConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  const envLiff = (
    process.env["LINE_LIFF_ID"] ||
    process.env["VITE_LINE_LIFF_ID"] ||
    process.env["LIFF_ID"] ||
    process.env["LINE_LIFF"] ||
    process.env["LIFFID"] ||
    process.env["VITE_LIFF_ID"] ||
    ""
  ).trim();
  const validLiff = envLiff && envLiff !== "xxxxx-xxxxx" ? envLiff : DEFAULT_LINE_LIFF_ID;

  const hasAccessToken = Boolean(
    process.env["LINE_CHANNEL_ACCESS_TOKEN"] ||
    process.env["LINE_ACCESS_TOKEN"] ||
    process.env["LINE_TOKEN"] ||
    process.env["CHANNEL_ACCESS_TOKEN"] ||
    process.env["ACCESS_TOKEN"] ||
    process.env["LINE_BOT_TOKEN"] ||
    process.env["LINE_MESSAGING_TOKEN"],
  );

  return {
    hasChannelId: Boolean(process.env["LINE_CHANNEL_ID"] || process.env["CHANNEL_ID"]),
    hasChannelSecret: Boolean(
      process.env["LINE_CHANNEL_SECRET"] ||
      process.env["CHANNEL_SECRET"] ||
      process.env["LINE_SECRET"],
    ),
    hasAccessToken,
    hasServerLiffId: Boolean(validLiff),
    configuredLiffId: validLiff,
    hasLineToId: Boolean(
      process.env["LINE_TO_ID"] ||
      process.env["LINE_TARGET_ID"] ||
      process.env["LINE_USER_ID"] ||
      process.env["LINE_RECEIVER_ID"],
    ),
  };
});

/**
 * Sync Master Database with Central Server (ข้อมูลต้องตรงกันทุกคน)
 * If client provides updates, server integrates them. Server returns latest state.
 */
export const syncMasterDatabaseFn = createServerFn({ method: "POST" })
  .validator((payload: ServerSyncPayload) => payload)
  .handler(async ({ data }) => {
    if (data.products && Array.isArray(data.products) && data.products.length > 0) {
      globalServerDatabase.products = data.products;
    }
    if (data.categories && Array.isArray(data.categories)) {
      globalServerDatabase.categories = data.categories;
    }
    if (data.zones && Array.isArray(data.zones)) {
      globalServerDatabase.zones = data.zones;
    }
    if (data.units && Array.isArray(data.units)) {
      globalServerDatabase.units = data.units;
    }
    if (data.receives && Array.isArray(data.receives)) {
      globalServerDatabase.receives = data.receives;
    }
    if (data.followers && Array.isArray(data.followers)) {
      // Merge unique followers by userId
      data.followers.forEach((f) => {
        const existingIdx = globalServerDatabase.followers.findIndex(
          (ef) => ef.userId === f.userId,
        );
        if (existingIdx >= 0) {
          globalServerDatabase.followers[existingIdx] = {
            ...globalServerDatabase.followers[existingIdx],
            ...f,
          };
        } else {
          globalServerDatabase.followers.push(f);
        }
      });
    }
    if (data.movements && Array.isArray(data.movements)) {
      globalServerDatabase.movements = data.movements;
    }
    if (data.purchaseOrders && Array.isArray(data.purchaseOrders)) {
      globalServerDatabase.purchaseOrders = data.purchaseOrders;
    }

    globalServerDatabase.lastUpdated = new Date().toISOString();

    return {
      success: true,
      data: globalServerDatabase,
      lastUpdated: globalServerDatabase.lastUpdated,
    };
  });

/**
 * Get Server Follower History & User IDs
 */
export const getLineFollowersHistoryFn = createServerFn({ method: "GET" }).handler(async () => {
  return {
    success: true,
    followers: globalServerDatabase.followers,
    count: globalServerDatabase.followers.length,
  };
});

/**
 * Register / Update a Follower or User
 */
export const registerLineFollowerFn = createServerFn({ method: "POST" })
  .validator((user: ServerLineFollower) => user)
  .handler(async ({ data }) => {
    const existingIdx = globalServerDatabase.followers.findIndex((f) => f.userId === data.userId);
    if (existingIdx >= 0) {
      globalServerDatabase.followers[existingIdx] = {
        ...globalServerDatabase.followers[existingIdx],
        ...data,
        lastInteractionAt:
          new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH"),
      };
    } else {
      globalServerDatabase.followers.unshift({
        ...data,
        followedAt:
          data.followedAt ||
          new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH"),
        lastInteractionAt:
          new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH"),
      });
    }

    return {
      success: true,
      follower: data,
      allFollowers: globalServerDatabase.followers,
    };
  });

export interface LineApiRetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  timeoutMs?: number;
}

export interface LineApiCallResult {
  ok: boolean;
  status: number;
  bodyText: string;
  attempts: number;
}

/**
 * Wrapper function for LINE Messaging API with Exponential Backoff Auto-Retry
 * Handles HTTP 429 (Rate Limit), 5xx server errors, and network timeouts
 */
export async function callLineMessagingApiWithRetry(
  endpoint: string,
  token: string,
  body: unknown,
  options: LineApiRetryOptions = {},
): Promise<LineApiCallResult> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 10000;

  let lastStatus = 0;
  let lastBodyText = "";
  let lastErrorMessage = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);
      lastStatus = response.status;
      lastBodyText = await response.text();

      // HTTP 2xx: Success
      if (response.ok) {
        return { ok: true, status: response.status, bodyText: lastBodyText, attempts: attempt };
      }

      // Check if retryable: 429 Too Many Requests or 5xx Server Error
      const isRetryable =
        response.status === 429 || (response.status >= 500 && response.status <= 504);

      if (!isRetryable || attempt >= maxRetries) {
        return { ok: false, status: response.status, bodyText: lastBodyText, attempts: attempt };
      }

      // Exponential backoff with jitter and Retry-After support
      let delayMs = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
      const retryAfterHeader = response.headers.get("retry-after");
      if (retryAfterHeader) {
        const parsedSec = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsedSec) && parsedSec > 0) {
          delayMs = Math.min(parsedSec * 1000, 15000);
        }
      }

      console.warn(
        `[LINE Messaging API] Request failed with HTTP ${response.status} (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(delayMs)}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);
      lastErrorMessage = err instanceof Error ? err.message : String(err);

      console.warn(
        `[LINE Messaging API Network/Timeout] Error on attempt ${attempt}/${maxRetries}: ${lastErrorMessage}`,
      );

      if (attempt >= maxRetries) {
        return {
          ok: false,
          status: 0,
          bodyText: `Network/Timeout error: ${lastErrorMessage}`,
          attempts: attempt,
        };
      }

      const delayMs = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    ok: false,
    status: lastStatus,
    bodyText: lastBodyText || lastErrorMessage || "Unknown error",
    attempts: maxRetries,
  };
}

export const sendLineMessagingApiFn = createServerFn({ method: "POST" })
  .validator((data: SendLineOrderPayload) => data)
  .handler(async ({ data }) => {
    const token = (
      process.env["LINE_CHANNEL_ACCESS_TOKEN"] ||
      process.env["LINE_ACCESS_TOKEN"] ||
      process.env["LINE_TOKEN"] ||
      process.env["CHANNEL_ACCESS_TOKEN"] ||
      process.env["ACCESS_TOKEN"] ||
      process.env["LINE_BOT_TOKEN"] ||
      process.env["LINE_MESSAGING_TOKEN"] ||
      data.channelAccessToken
    )?.trim();

    if (!token) {
      return {
        success: false,
        configured: false,
        error:
          "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน GitHub Secrets หรือ Server Environment กรุณาตรวจสอบการตั้งค่าคีย์ใน GitHub Secrets",
      };
    }

    const isBroadcast = Boolean(data.isBroadcast);
    const configuredTargets = (
      process.env["LINE_TO_ID"] ||
      process.env["LINE_TARGET_ID"] ||
      process.env["LINE_USER_ID"] ||
      process.env["LINE_RECEIVER_ID"] ||
      ""
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const requestedTarget = data.toUserIdOrGroupId?.trim();
    const targets = requestedTarget ? [requestedTarget] : configuredTargets;
    if (!isBroadcast && targets.length === 0) {
      return {
        success: false,
        configured: true,
        error:
          "ยังไม่ได้ระบุผู้รับปลายทาง (LINE_TO_ID ใน GitHub Secrets หรือเลือกผู้รับจากรายชื่อ)",
      };
    }

    // Prepare message payload
    let messageObj: unknown;
    if (data.flexMessage && typeof data.flexMessage === "object") {
      const flexData = data.flexMessage as Record<string, unknown>;
      if (flexData["type"] === "flex") {
        messageObj = flexData;
      } else if (flexData["type"] === "bubble" || flexData["type"] === "carousel") {
        messageObj = {
          type: "flex",
          altText: data.orderSummary || "LINE Flex Message",
          contents: flexData,
        };
      } else if (flexData["contents"]) {
        messageObj = {
          type: "flex",
          altText: (flexData["altText"] as string) || data.orderSummary || "LINE Flex Message",
          contents: flexData["contents"],
        };
      } else {
        messageObj = {
          type: "text",
          text: data.orderSummary,
        };
      }
    } else {
      messageObj = {
        type: "text",
        text: data.orderSummary,
      };
    }

    try {
      const endpoint = isBroadcast
        ? "https://api.line.me/v2/bot/message/broadcast"
        : "https://api.line.me/v2/bot/message/push";
      const recipients = isBroadcast ? [undefined] : targets;

      for (const recipient of recipients) {
        const requestBody = isBroadcast
          ? { messages: [messageObj] }
          : { to: recipient, messages: [messageObj] };

        const result = await callLineMessagingApiWithRetry(endpoint, token, requestBody);

        if (!result.ok) {
          return {
            success: false,
            configured: true,
            error: `LINE API ส่งไม่สำเร็จ (Status: ${result.status}, พยายาม ${result.attempts} ครั้ง): ${result.bodyText}`,
          };
        }
      }

      return { success: true, configured: true };
    } catch (err: unknown) {
      return { success: false, configured: true, error: String(err) };
    }
  });

export interface SendMiniAppPortalPayload {
  toUserId?: string | undefined;
  storeName?: string | undefined;
  liffId?: string | undefined;
  isBroadcast?: boolean | undefined;
}

/**
 * Server Function: Send Mini App Entrance Portal Card via LINE Messaging API
 * Allows LINE Messaging API (LINE OA Chat) to be the direct 1-tap gateway into MiniMark LINE Mini App
 */
export const sendMiniAppPortalCardFn = createServerFn({ method: "POST" })
  .validator((data: SendMiniAppPortalPayload) => data)
  .handler(async ({ data }) => {
    const token = (
      process.env["LINE_CHANNEL_ACCESS_TOKEN"] ||
      process.env["LINE_ACCESS_TOKEN"] ||
      process.env["LINE_TOKEN"] ||
      process.env["CHANNEL_ACCESS_TOKEN"] ||
      process.env["ACCESS_TOKEN"] ||
      process.env["LINE_BOT_TOKEN"] ||
      process.env["LINE_MESSAGING_TOKEN"]
    )?.trim();

    const envLiff = (
      process.env["LINE_LIFF_ID"] ||
      process.env["VITE_LINE_LIFF_ID"] ||
      process.env["LIFF_ID"] ||
      process.env["LINE_LIFF"] ||
      process.env["LIFFID"] ||
      data.liffId ||
      ""
    ).trim();

    const liffId = envLiff && envLiff !== "xxxxx-xxxxx" ? envLiff : "2007000000-xxxxxx";
    const storeName = getSystemStoreName(data.storeName);

    const portalBubble = createMiniAppPortalFlexBubble({
      storeName,
      liffId,
    });

    const portalMessage = {
      type: "flex",
      altText: `🏪 ทางเข้าใช้งาน LINE Mini App — ${storeName}`,
      contents: portalBubble,
      quickReply: {
        items: [
          {
            type: "action",
            action: {
              type: "uri",
              label: "🛒 สั่งซื้อสินค้า",
              uri: `https://liff.line.me/${liffId}/reorder`,
            },
          },
          {
            type: "action",
            action: {
              type: "uri",
              label: "📦 สต็อกสินค้า",
              uri: `https://liff.line.me/${liffId}/stock`,
            },
          },
          {
            type: "action",
            action: {
              type: "uri",
              label: "📷 สแกนบาร์โค้ด",
              uri: `https://liff.line.me/${liffId}/scan`,
            },
          },
          {
            type: "action",
            action: {
              type: "uri",
              label: "📊 แดชบอร์ด",
              uri: `https://liff.line.me/${liffId}`,
            },
          },
        ],
      },
    };

    if (!token) {
      return {
        success: false,
        configured: false,
        flexPayload: portalMessage,
        error:
          "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน GitHub Secrets หรือ Server Environment",
      };
    }

    const isBroadcast = Boolean(data.isBroadcast);
    const configuredTargets = (
      process.env["LINE_TO_ID"] ||
      process.env["LINE_TARGET_ID"] ||
      process.env["LINE_USER_ID"] ||
      process.env["LINE_RECEIVER_ID"] ||
      ""
    )
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const requestedTarget = data.toUserId?.trim();
    const targets = requestedTarget ? [requestedTarget] : configuredTargets;

    if (!isBroadcast && targets.length === 0) {
      return {
        success: false,
        configured: true,
        flexPayload: portalMessage,
        error: "ยังไม่ได้ระบุผู้รับปลายทาง (ระบุ LINE User ID หรือตั้งค่า LINE_TO_ID ใน Secrets)",
      };
    }

    try {
      const endpoint = isBroadcast
        ? "https://api.line.me/v2/bot/message/broadcast"
        : "https://api.line.me/v2/bot/message/push";
      const recipients = isBroadcast ? [undefined] : targets;

      for (const recipient of recipients) {
        const requestBody = isBroadcast
          ? { messages: [portalMessage] }
          : { to: recipient, messages: [portalMessage] };

        const result = await callLineMessagingApiWithRetry(endpoint, token, requestBody);

        if (!result.ok) {
          return {
            success: false,
            configured: true,
            flexPayload: portalMessage,
            error: `LINE Messaging API ส่งไม่สำเร็จ: ${result.bodyText}`,
          };
        }
      }

      return { success: true, configured: true, flexPayload: portalMessage };
    } catch (err: unknown) {
      return {
        success: false,
        configured: true,
        flexPayload: portalMessage,
        error: String(err),
      };
    }
  });
