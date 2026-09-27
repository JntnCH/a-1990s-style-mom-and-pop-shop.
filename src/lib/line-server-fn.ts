import { createServerFn } from "@tanstack/react-start";

export interface SendLineOrderPayload {
  toUserIdOrGroupId?: string | undefined;
  orderSummary: string;
  flexMessage?: unknown;
  /** @deprecated Kept for legacy callers; server intentionally ignores client tokens. */
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
      userId: "U88f0192a83b27b9c1",
      displayName: "ผู้ดูแลร้าน (Admin Master)",
      pictureUrl:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      statusMessage: "ประจำหน้าร้าน MiniMark",
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

export const getLineServerConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  return {
    hasChannelId: Boolean(process.env["LINE_CHANNEL_ID"]),
    hasChannelSecret: Boolean(process.env["LINE_CHANNEL_SECRET"]),
    hasAccessToken: Boolean(process.env["LINE_CHANNEL_ACCESS_TOKEN"]),
    hasServerLiffId: Boolean(process.env["LINE_LIFF_ID"]),
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

export const sendLineMessagingApiFn = createServerFn({ method: "POST" })
  .validator((data: SendLineOrderPayload) => data)
  .handler(async ({ data }) => {
    const token = process.env["LINE_CHANNEL_ACCESS_TOKEN"]?.trim();

    if (!token) {
      return {
        success: false,
        configured: false,
        error: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN บน Server",
      };
    }

    const isBroadcast = Boolean(data.isBroadcast);
    const configuredTargets = (process.env["LINE_TO_ID"] || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const requestedTarget = data.toUserIdOrGroupId?.trim();
    const targets = requestedTarget ? [requestedTarget] : configuredTargets;
    if (!isBroadcast && targets.length === 0) {
      return {
        success: false,
        configured: true,
        error: "ยังไม่ได้ตั้งค่า LINE_TO_ID บน Server หรือระบุ LINE recipient ID",
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
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const text = await res.text();
          return { success: false, configured: true, error: `LINE API ส่งไม่สำเร็จ: ${text}` };
        }
      }

      return { success: true, configured: true };
    } catch (err: unknown) {
      return { success: false, configured: true, error: String(err) };
    }
  });
