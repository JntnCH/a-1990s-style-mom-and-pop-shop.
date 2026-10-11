/**
 * Role-Based Access Control (RBAC) & Staff Authentication Service (Phase 11)
 * MiniMark Grocery & Retail Store Management
 */

export type UserRole = "ADMIN" | "MANAGER" | "CASHIER" | "STOCK_STAFF";

export interface RolePermissions {
  canViewDashboard: boolean;
  canManageProducts: boolean;
  canViewCostPrice: boolean;
  canEditStock: boolean;
  canReceiveGoods: boolean;
  canIssueGoods: boolean;
  canCreatePO: boolean;
  canConfigurePrinters: boolean;
  canPrintReceipts: boolean;
  canPrintLabels: boolean;
  canManageUsers: boolean;
  canBackupRestore: boolean;
  canAccessSettings: boolean;
}

export const ROLE_DEFINITIONS: Record<
  UserRole,
  {
    name: string;
    description: string;
    badgeColor: string;
    icon: string;
    permissions: RolePermissions;
  }
> = {
  ADMIN: {
    name: "เจ้าของร้าน / ผู้ดูแลระบบ (Admin)",
    description: "มีสิทธิ์สูงสุดทุกฟังก์ชัน จัดการผู้ใช้ ตั้งค่าระบบ ดูต้นทุน กำไร และสำรองข้อมูล",
    badgeColor: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
    icon: "👑",
    permissions: {
      canViewDashboard: true,
      canManageProducts: true,
      canViewCostPrice: true,
      canEditStock: true,
      canReceiveGoods: true,
      canIssueGoods: true,
      canCreatePO: true,
      canConfigurePrinters: true,
      canPrintReceipts: true,
      canPrintLabels: true,
      canManageUsers: true,
      canBackupRestore: true,
      canAccessSettings: true,
    },
  },
  MANAGER: {
    name: "ผู้จัดการสาขา (Store Manager)",
    description:
      "ดูแลสต็อก อนุมัติสั่งซื้อ PO ดูยอดขายและรายงาน แต่ไม่สามารถลบระบบหรือแก้สิทธิ์ผู้ใช้",
    badgeColor: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
    icon: "💼",
    permissions: {
      canViewDashboard: true,
      canManageProducts: true,
      canViewCostPrice: true,
      canEditStock: true,
      canReceiveGoods: true,
      canIssueGoods: true,
      canCreatePO: true,
      canConfigurePrinters: true,
      canPrintReceipts: true,
      canPrintLabels: true,
      canManageUsers: false,
      canBackupRestore: false,
      canAccessSettings: true,
    },
  },
  CASHIER: {
    name: "พนักงานแคชเชียร์ (Cashier)",
    description: "เปิดบิลขายหน้าร้าน พิมพ์สลิปใบเสร็จ สแกนบาร์โค้ด ไม่เห็นราคาต้นทุนและกำไร",
    badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    icon: "🛒",
    permissions: {
      canViewDashboard: false,
      canManageProducts: false,
      canViewCostPrice: false,
      canEditStock: false,
      canReceiveGoods: false,
      canIssueGoods: false,
      canCreatePO: false,
      canConfigurePrinters: false,
      canPrintReceipts: true,
      canPrintLabels: false,
      canManageUsers: false,
      canBackupRestore: false,
      canAccessSettings: false,
    },
  },
  STOCK_STAFF: {
    name: "พนักงานคลัง & เติมสินค้า (Stock Staff)",
    description: "ตรวจรับสินค้า จ่ายของ ย้ายโซน พิมพ์ป้ายราคาชั้นวางและสติกเกอร์บาร์โค้ด",
    badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icon: "📦",
    permissions: {
      canViewDashboard: false,
      canManageProducts: false,
      canViewCostPrice: false,
      canEditStock: true,
      canReceiveGoods: true,
      canIssueGoods: true,
      canCreatePO: false,
      canConfigurePrinters: false,
      canPrintReceipts: false,
      canPrintLabels: true,
      canManageUsers: false,
      canBackupRestore: false,
      canAccessSettings: false,
    },
  },
};

export interface StaffUser {
  id: string;
  name: string;
  username: string;
  pin: string; // 4-digit PIN for quick override / switch
  role: UserRole;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
}

const STORAGE_KEY_USERS = "minimark_rbac_users_v1";
const STORAGE_KEY_CURRENT_USER_ID = "minimark_rbac_current_user_v1";

const DEFAULT_ADMIN_USER: StaffUser = {
  id: "usr-admin",
  name: "คุณประสิทธิ์ (เจ้าของร้าน)",
  username: "admin",
  pin: "1234",
  role: "ADMIN",
  phone: "081-987-6543",
  isActive: true,
  lastLoginAt: "25/09/2026 14:30 น.",
};

export const DEFAULT_USERS: StaffUser[] = [
  DEFAULT_ADMIN_USER,
  {
    id: "usr-mgr",
    name: "คุณวิภา (ผู้จัดการสาขา)",
    username: "wipa",
    pin: "5678",
    role: "MANAGER",
    phone: "089-123-4567",
    isActive: true,
    lastLoginAt: "25/09/2026 10:15 น.",
  },
  {
    id: "usr-cashier",
    name: "น้องส้ม (แคชเชียร์ 1)",
    username: "som",
    pin: "1111",
    role: "CASHIER",
    phone: "086-555-4321",
    isActive: true,
    lastLoginAt: "25/09/2026 13:00 น.",
  },
  {
    id: "usr-stock",
    name: "ช่างเก่ง (พนักงานสต็อก)",
    username: "keng",
    pin: "2222",
    role: "STOCK_STAFF",
    phone: "084-222-9988",
    isActive: true,
    lastLoginAt: "25/09/2026 09:00 น.",
  },
];

export const AuthService = {
  getUsers(): StaffUser[] {
    if (typeof window === "undefined") return DEFAULT_USERS;
    try {
      const data = localStorage.getItem(STORAGE_KEY_USERS);
      if (!data) {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(DEFAULT_USERS));
        return DEFAULT_USERS;
      }
      return JSON.parse(data);
    } catch {
      return DEFAULT_USERS;
    }
  },

  getCurrentUser(): StaffUser {
    const users = this.getUsers();
    const fallbackUser = users[0] ?? DEFAULT_ADMIN_USER;
    if (typeof window === "undefined") return fallbackUser;
    try {
      const currentId = localStorage.getItem(STORAGE_KEY_CURRENT_USER_ID);
      const found = users.find((u) => u.id === currentId && u.isActive);
      if (found) return found;
      // Default to first admin user
      const admin = users.find((u) => u.role === "ADMIN" && u.isActive) ?? fallbackUser;
      localStorage.setItem(STORAGE_KEY_CURRENT_USER_ID, admin.id);
      return admin;
    } catch {
      return fallbackUser;
    }
  },

  setCurrentUser(userId: string): boolean {
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId && u.isActive);
    if (!user) return false;

    const now =
      new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH") + " น.";
    user.lastLoginAt = now;
    this.saveUser(user);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER_ID, userId);
      window.dispatchEvent(new Event("minimark_auth_change"));
    }
    return true;
  },

  saveUser(user: StaffUser): StaffUser {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      window.dispatchEvent(new Event("minimark_auth_change"));
    }
    return user;
  },

  deleteUser(id: string): boolean {
    const current = this.getCurrentUser();
    if (current.id === id) {
      return false; // Cannot delete self
    }
    const users = this.getUsers().filter((u) => u.id !== id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      window.dispatchEvent(new Event("minimark_auth_change"));
    }
    return true;
  },

  hasPermission(permission: keyof RolePermissions, user?: StaffUser): boolean {
    const targetUser = user || this.getCurrentUser();
    const roleDef = ROLE_DEFINITIONS[targetUser.role];
    if (!roleDef) return false;
    return roleDef.permissions[permission] ?? false;
  },

  /**
   * Verify whether a PIN belongs to an ADMIN or MANAGER (for permission override)
   */
  verifyAdminOverride(pin: string): { success: boolean; user?: StaffUser } {
    const users = this.getUsers();
    const matched = users.find(
      (u) => (u.role === "ADMIN" || u.role === "MANAGER") && u.pin === pin.trim() && u.isActive,
    );
    if (matched) {
      return { success: true, user: matched };
    }
    return { success: false };
  },
};
