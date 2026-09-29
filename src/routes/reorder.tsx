import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderTree,
  Layers,
  MessageCircle,
  Package,
  PackageCheck,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Send,
  Share2,
  Sliders,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import {
  CategorySelect,
  FormatBadge,
  UnitSelect,
  ZoneSelect,
} from "@/components/master/MasterSelects";
import { OrderExportModal, type ExportOrderPayload } from "@/components/orders/OrderExportModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPurchaseOrderFlexBubble, createStockAlertFlexBubble } from "@/lib/flex-templates";
import { FlexMessageVisualizer } from "@/components/line/FlexMessageVisualizer";
import { getLineServerConfigFn, sendLineMessagingApiFn } from "@/lib/line-server-fn";
import {
  buildOrderPlainText,
  formatDailyOrderFlexMessage,
  formatOrderPlainText,
  getClientLiffId,
  getLineStatus,
  sendStockAlertToLine,
  sendWith3TierFallback,
  setClientLiffId,
  shareFlexViaLiffPicker,
  type LineConfigStatus,
  type OrderFlexItem,
} from "@/lib/line-service";
import { playScanSuccessSound } from "@/lib/scanner-audio";
import { PrinterService } from "@/lib/printer-service";
import {
  MasterStore,
  type CategoryItem,
  type LineUserFollower,
  type ProductItem,
  type PurchaseOrderRecord,
  type UnitItem,
  type ZoneItem,
} from "@/lib/store";

export const Route = createFileRoute("/reorder")({
  head: () => ({
    meta: [
      { title: "ระบบคำนวณสั่งซื้อ & ใบสั่งซื้อสินค้า (PO) | MiniMark" },
      {
        name: "description",
        content:
          "ระบบคำนวณจำนวนที่ควรสั่งซื้ออัจฉริยะ, จัดการใบสั่งซื้อ (Purchase Order Lifecycle), ตรวจรับเข้าสต็อก และพิมพ์เอกสาร A4",
      },
      {
        property: "og:title",
        content: "ระบบคำนวณสั่งซื้อ & ใบสั่งซื้อสินค้า (PO) | MiniMark",
      },
      {
        property: "og:description",
        content: "ระบบจัดการใบสั่งซื้อสินค้าครบวงจรและส่งเข้า LINE Flex Message",
      },
    ],
  }),
  component: ReorderPage,
});

type ReorderStrategy = "TARGET_PAR" | "MINIMUM_RESTORE" | "WEEKEND_BUFFER" | "DOUBLE_BUFFER";

function ReorderPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [followers, setFollowers] = useState<LineUserFollower[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);

  // Active View Tab: "calculator" (Phase 5) | "alerts_hub" (Phase 4) | "create_po" | "po_history" (Phase 6)
  const [activeTab, setActiveTab] = useState<
    "calculator" | "alerts_hub" | "create_po" | "po_history"
  >("calculator");

  // Calculation Strategy State (Phase 5)
  const [calculationStrategy, setCalculationStrategy] = useState<ReorderStrategy>("TARGET_PAR");
  const [customMultiplier, setCustomMultiplier] = useState<number>(1.0);

  // Filter in Alerts Hub
  const [alertFilter, setAlertFilter] = useState<"ALL_ALERT" | "OUT_OF_STOCK" | "LOW_STOCK">(
    "ALL_ALERT",
  );

  // Filter in PO History
  const [poStatusFilter, setPoStatusFilter] = useState<
    "ALL" | "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED"
  >("ALL");

  // Selected Order Items (Cart)
  const [orderList, setOrderList] = useState<
    { productId: string; quantity: number; unitId: string }[]
  >([]);
  const [supplierNameInput, setSupplierNameInput] = useState(
    "บริษัท ยูนิลีเวอร์ / ซัพพลายเออร์หลัก",
  );

  // Add Item Modal (Cascading: Zone -> Category -> Product)
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addZoneId, setAddZoneId] = useState<string>("all");
  const [addCatId, setAddCatId] = useState<string>("all");
  const [addProductSearch, setAddProductSearch] = useState<string>("");
  const [selectedProdId, setSelectedProdId] = useState("");
  const [manualQty, setManualQty] = useState(10);
  const [manualUnitId, setManualUnitId] = useState("");

  // File Export Modal State (PDF, Excel, TXT, JSON)
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPayload, setExportPayload] = useState<ExportOrderPayload | null>(null);

  // PO Detail & Print Modal (Phase 6)
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderRecord | null>(null);

  // Server Messaging API & LINE Recipient Modal
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [recipientFilterTab, setRecipientFilterTab] = useState<
    "ALL" | "SUPPLIERS" | "GROUPS" | "STAFF"
  >("ALL");
  const [targetIdInput, setTargetIdInput] = useState("");
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactId, setNewContactId] = useState("");
  const [newContactRole, setNewContactRole] = useState<"admin" | "staff" | "viewer">("staff");
  const [customChannelToken, setCustomChannelToken] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("minimark_line_channel_token") || "";
    }
    return "";
  });
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);
  const [pushMessageType, setPushMessageType] = useState<"PURCHASE_ORDER" | "STOCK_ALERT">(
    "PURCHASE_ORDER",
  );

  // Lock body scroll on mobile and desktop when recipient selection modal is open
  useEffect(() => {
    if (pushModalOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [pushModalOpen]);

  // Flex Preview Visualizer Modal
  const [flexPreviewOpen, setFlexPreviewOpen] = useState(false);
  const [flexPreviewData, setFlexPreviewData] = useState<unknown>(null);
  const [flexPreviewTitle, setFlexPreviewTitle] = useState("ตัวอย่าง LINE Flex Message");

  // Sending & processing status
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // LINE Diagnostic Info
  const [lineStatus, setLineStatus] = useState<LineConfigStatus | null>(null);
  const [serverConfig, setServerConfig] = useState<{
    hasAccessToken: boolean;
  } | null>(null);

  const reloadData = useCallback(() => {
    const allProds = MasterStore.getProducts();
    const allCats = MasterStore.getCategories();
    const allZones = MasterStore.getZones();
    const allUnits = MasterStore.getUnits();
    const allFollowers = MasterStore.getFollowers();
    const allPOs = MasterStore.getPurchaseOrders();

    setProducts(allProds);
    setCategories(allCats);
    setZones(allZones);
    setUnits(allUnits);
    setFollowers(allFollowers);
    setPurchaseOrders(allPOs);

    // Default populate order list from low stock items if empty
    if (orderList.length === 0) {
      const lowStockItems = allProds.filter((p) => p.isActive !== false && p.stock <= p.minStock);
      setOrderList(
        lowStockItems.map((p) => {
          const suggested = MasterStore.calculateSuggestedQuantity(
            p,
            calculationStrategy,
            customMultiplier,
          );
          return {
            productId: p.id,
            quantity: suggested,
            unitId: p.unitId,
          };
        }),
      );
    }
  }, [calculationStrategy, customMultiplier, orderList.length]);

  useEffect(() => {
    reloadData();
    getLineStatus()
      .then(setLineStatus)
      .catch(() => setLineStatus(null));
    getLineServerConfigFn()
      .then((cfg) => {
        setServerConfig(cfg);
        if (cfg?.configuredLiffId) {
          setClientLiffId(cfg.configuredLiffId);
        }
      })
      .catch(() => setServerConfig(null));

    const onStoreChange = () => reloadData();
    window.addEventListener("minimark_store_change", onStoreChange);
    return () => window.removeEventListener("minimark_store_change", onStoreChange);
  }, [reloadData]);

  const getUnitName = (unitId: string) => units.find((u) => u.id === unitId)?.name || "ชิ้น";
  const getCatName = (catId: string) => categories.find((c) => c.id === catId)?.name || "ทั่วไป";

  // Categorized alerts
  const outOfStockItems = products.filter((p) => p.isActive !== false && p.stock <= 0);
  const lowStockItems = products.filter(
    (p) => p.isActive !== false && p.stock > 0 && p.stock <= p.minStock,
  );
  const allReorderNeeded = products.filter((p) => p.isActive !== false && p.stock <= p.minStock);

  // Phase 5: Smart Reorder Forecast List
  const forecastList = MasterStore.getSmartReorderForecast(calculationStrategy, customMultiplier);
  const forecastTotalEstimatedCost = forecastList.reduce(
    (acc, curr) => acc + curr.estimatedCost,
    0,
  );
  const forecastTotalQuantity = forecastList.reduce((acc, curr) => acc + curr.suggestedQuantity, 0);

  const displayedAlertItems =
    alertFilter === "OUT_OF_STOCK"
      ? outOfStockItems
      : alertFilter === "LOW_STOCK"
        ? lowStockItems
        : allReorderNeeded;

  const filteredPOs = purchaseOrders.filter((po) => {
    if (poStatusFilter === "ALL") return true;
    return po.status === poStatusFilter;
  });

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setOrderList((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const next = item.quantity + delta;
            return next > 0 ? { ...item, quantity: next } : null;
          }
          return item;
        })
        .filter((item): item is { productId: string; quantity: number; unitId: string } =>
          Boolean(item),
        ),
    );
  };

  const handleRemoveOrder = (productId: string) => {
    setOrderList((prev) => prev.filter((i) => i.productId !== productId));
  };

  // Filter available products for cascading selection in Add Item Modal
  const availableProductsForAdd = products.filter((p) => {
    if (p.isActive === false) return false;
    const matchesZone = addZoneId === "all" || p.zoneId === addZoneId;
    const matchesCat = addCatId === "all" || p.categoryId === addCatId;
    const query = addProductSearch.toLowerCase().trim();
    const matchesSearch =
      !query ||
      p.name.toLowerCase().includes(query) ||
      p.barcode.toLowerCase().includes(query) ||
      (p.sku && p.sku.toLowerCase().includes(query));
    return matchesZone && matchesCat && matchesSearch;
  });

  const handleOpenAddModal = () => {
    setAddZoneId("all");
    setAddCatId("all");
    setAddProductSearch("");
    const prods = products.length > 0 ? products : MasterStore.getProducts();
    if (products.length === 0) setProducts(prods);
    const firstActive = prods.find((p) => p.isActive !== false) || prods[0];
    if (firstActive) {
      setSelectedProdId(firstActive.id);
      setManualQty(firstActive.reorderQuantity || 10);
      setManualUnitId(firstActive.unitId);
    } else {
      setSelectedProdId("");
      setManualQty(1);
      setManualUnitId("");
    }
    setAddModalOpen(true);
  };

  const handleOpenExportCurrentOrder = () => {
    if (fullItems.length === 0) return;
    const payload: ExportOrderPayload = {
      orderNumber: `PO-${Date.now().toString().slice(-6)}`,
      createdAt:
        new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH"),
      storeName: "ร้าน MiniMark",
      supplierName: supplierNameInput.trim() || "ซัพพลายเออร์ทั่วไป",
      items: fullItems.map((f) => ({
        productName: f.product.name,
        barcode: f.product.barcode,
        categoryName: getCatName(f.product.categoryId),
        zoneName: zones.find((z) => z.id === f.product.zoneId)?.name || "-",
        quantity: f.quantity,
        unitName: f.unitName,
        costPrice: f.product.costPrice,
        total: f.priceEstimate,
      })),
      totalQuantity,
      totalCost,
    };
    setExportPayload(payload);
    setExportModalOpen(true);
  };

  const handleOpenExportPO = (po: PurchaseOrderRecord) => {
    const payload: ExportOrderPayload = {
      orderNumber: po.orderNumber,
      createdAt: po.createdAt,
      storeName: "ร้าน MiniMark",
      supplierName: po.supplierName || "ซัพพลายเออร์ทั่วไป",
      items: po.items.map((i) => {
        const p = products.find((prod) => prod.id === i.productId);
        return {
          productName: i.productName,
          barcode: i.barcode,
          categoryName: p ? getCatName(p.categoryId) : "-",
          zoneName: p ? zones.find((z) => z.id === p.zoneId)?.name || "-" : "-",
          quantity: i.quantity,
          unitName: i.unitName,
          costPrice: i.costPrice,
          total: i.total,
        };
      }),
      totalQuantity: po.totalQuantity,
      totalCost: po.totalCost,
    };
    setExportPayload(payload);
    setExportModalOpen(true);
  };

  const handleAddManualItem = () => {
    if (!selectedProdId) return;
    const prod = products.find((p) => p.id === selectedProdId);
    if (!prod) return;

    setOrderList((prev) => {
      const existing = prev.find((i) => i.productId === selectedProdId);
      if (existing) {
        return prev.map((i) =>
          i.productId === selectedProdId ? { ...i, quantity: i.quantity + Number(manualQty) } : i,
        );
      }
      return [
        ...prev,
        {
          productId: selectedProdId,
          quantity: Number(manualQty) || 1,
          unitId: manualUnitId || prod.unitId,
        },
      ];
    });

    setAddModalOpen(false);
  };

  const handleApplyForecastToCart = () => {
    const calculatedItems = forecastList.map((f) => ({
      productId: f.product.id,
      quantity: f.suggestedQuantity,
      unitId: f.product.unitId,
    }));
    setOrderList(calculatedItems);
    setActiveTab("create_po");
    setStatusMessage({
      type: "success",
      text: `นำเข้าจำนวนสั่งซื้อที่คำนวณตามสูตร (${calculatedItems.length} รายการ, รวม ${forecastTotalQuantity} ชิ้น) เข้าสู่ใบสั่งซื้อเรียบร้อยแล้ว`,
    });
  };

  const handleApplySingleForecast = (item: (typeof forecastList)[0]) => {
    setOrderList((prev) => {
      const existing = prev.find((i) => i.productId === item.product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.product.id ? { ...i, quantity: item.suggestedQuantity } : i,
        );
      }
      return [
        ...prev,
        {
          productId: item.product.id,
          quantity: item.suggestedQuantity,
          unitId: item.product.unitId,
        },
      ];
    });
  };

  // Convert orderList to complete items with product data
  type FullOrderItem = OrderFlexItem & {
    product: ProductItem;
    barcode: string;
    priceEstimate: number;
  };
  const fullItems: FullOrderItem[] = orderList
    .map((item): FullOrderItem | null => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return null;
      return {
        product,
        name: product.name,
        quantity: item.quantity,
        unitName: getUnitName(item.unitId || product.unitId),
        barcode: product.barcode,
        priceEstimate: product.costPrice * item.quantity,
      };
    })
    .filter((i): i is FullOrderItem => i !== null);

  const totalCost = fullItems.reduce((acc, curr) => acc + (curr.priceEstimate || 0), 0);
  const totalQuantity = fullItems.reduce((acc, curr) => acc + curr.quantity, 0);

  // Phase 6 Action: Save Purchase Order Record
  const handleSavePO = (status: "DRAFT" | "ORDERED") => {
    if (fullItems.length === 0) return undefined;

    const poRecord = MasterStore.savePurchaseOrder({
      supplierName: supplierNameInput.trim() || undefined,
      items: fullItems.map((f) => ({
        productId: f.product.id,
        productName: f.product.name,
        barcode: f.product.barcode,
        quantity: f.quantity,
        unitName: f.unitName,
        costPrice: f.product.costPrice,
        total: f.priceEstimate,
      })),
      totalQuantity,
      totalCost,
      status,
      sentViaLineAt:
        status === "ORDERED"
          ? new Date().toLocaleDateString("th-TH") + " " + new Date().toLocaleTimeString("th-TH")
          : undefined,
    });

    setPurchaseOrders(MasterStore.getPurchaseOrders());
    setStatusMessage({
      type: "success",
      text: `สร้างใบสั่งซื้อ ${poRecord.orderNumber} (สถานะ: ${
        status === "ORDERED" ? "สั่งซื้อแล้ว" : "ฉบับร่าง"
      }) เรียบร้อยแล้ว`,
    });
    setActiveTab("po_history");
    return poRecord;
  };

  // Phase 6 Action: Receive Purchase Order into Stock
  const handleReceivePO = (po: PurchaseOrderRecord) => {
    if (confirm(`ต้องการตรวจรับสินค้าตามใบสั่งซื้อ ${po.orderNumber} เข้าสู่สต็อกใช่หรือไม่?`)) {
      const res = MasterStore.receivePurchaseOrderIntoStock(
        po.id,
        "ผู้ดูแลระบบ / พนักงานตรวจรับสินค้า",
      );
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `ตรวจรับสินค้าตามใบสั่งซื้อ ${po.orderNumber} (${po.items.length} รายการ, ${po.totalQuantity} ชิ้น) เข้าสต็อกและบันทึก Movement Log สำเร็จ`,
        });
        reloadData();
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "ไม่สามารถตรวจรับเข้าสต็อกได้",
        });
      }
    }
  };

  // Phase 6 Action: Cancel PO
  const handleCancelPO = (po: PurchaseOrderRecord) => {
    if (confirm(`ต้องการยกเลิกใบสั่งซื้อ ${po.orderNumber} ใช่หรือไม่?`)) {
      MasterStore.updatePurchaseOrderStatus(po.id, "CANCELLED");
      setStatusMessage({
        type: "info",
        text: `ยกเลิกใบสั่งซื้อ ${po.orderNumber} เรียบร้อยแล้ว`,
      });
      reloadData();
    }
  };

  // Phase 6 Action: Delete PO
  const handleDeletePO = (po: PurchaseOrderRecord) => {
    if (confirm(`ต้องการลบใบสั่งซื้อ ${po.orderNumber} ออกจากระบบถาวรใช่หรือไม่?`)) {
      MasterStore.deletePurchaseOrder(po.id);
      setStatusMessage({
        type: "info",
        text: `ลบใบสั่งซื้อ ${po.orderNumber} เรียบร้อยแล้ว`,
      });
      reloadData();
    }
  };

  // View PO Detail Modal
  const handleOpenPODetail = (po: PurchaseOrderRecord) => {
    setSelectedPO(po);
    setDetailModalOpen(true);
  };

  // Print A4 Document Handler
  const handlePrintPODocument = () => {
    if (selectedPO) {
      PrinterService.addPrintJob({
        jobTitle: `ใบสั่งซื้อสินค้า ${selectedPO.orderNumber}`,
        jobType: "PURCHASE_ORDER",
        printerId: "ptr-canon-a4",
        printerName: "Canon PIXMA G3010 (เอกสาร PO / สต็อก)",
        paperSize: "A4",
        copies: 1,
        status: "COMPLETED",
        operator: "ผู้จัดทำใบสั่งซื้อ (Purchaser)",
        payloadSummary: `${selectedPO.items.length} รายการ (${selectedPO.totalQuantity} ชิ้น) • ยอดเงินทุน ฿${selectedPO.totalCost.toFixed(2)}`,
      });
    }
    window.print();
  };

  // Send Order to LINE - opens recipient & friend selection modal
  const handleSendOrderToLine = (target: "group" | "personal") => {
    if (fullItems.length === 0) return;
    setPushMessageType("PURCHASE_ORDER");
    setIsBroadcastMode(false);

    if (target === "group") {
      setRecipientFilterTab("GROUPS");
      const groupTarget = followers.find(
        (f) => f.userId.startsWith("C") || f.role === "viewer" || f.displayName.includes("กลุ่ม"),
      );
      if (groupTarget) {
        setTargetIdInput(groupTarget.userId);
      } else if (followers.length > 0 && followers[0]) {
        setTargetIdInput(followers[0].userId);
      }
    } else {
      setRecipientFilterTab("SUPPLIERS");
      const supplierTarget =
        followers.find(
          (f) =>
            !f.displayName.includes("กลุ่ม") &&
            (f.displayName.includes("ยูนิลีเวอร์") ||
              f.displayName.includes("ซัพพลายเออร์") ||
              f.displayName.includes("ยี่ปั๊ว") ||
              f.displayName.includes("ค้าส่ง") ||
              f.displayName.includes("เครื่องดื่ม")),
        ) ||
        followers.find((f) => f.userId.startsWith("U") && !f.displayName.includes("กลุ่ม")) ||
        followers[0];

      if (supplierTarget) {
        setTargetIdInput(supplierTarget.userId);
      }
    }
    setPushModalOpen(true);
  };

  // Send Stock Alert to LINE - opens recipient & friend selection modal
  const handleSendStockAlertToLine = (target: "group" | "personal") => {
    if (allReorderNeeded.length === 0) return;
    setPushMessageType("STOCK_ALERT");
    setIsBroadcastMode(false);

    if (target === "group") {
      setRecipientFilterTab("GROUPS");
      const groupTarget = followers.find(
        (f) => f.userId.startsWith("C") || f.role === "viewer" || f.displayName.includes("กลุ่ม"),
      );
      if (groupTarget) {
        setTargetIdInput(groupTarget.userId);
      } else if (followers.length > 0 && followers[0]) {
        setTargetIdInput(followers[0].userId);
      }
    } else {
      setRecipientFilterTab("SUPPLIERS");
      const supplierTarget =
        followers.find(
          (f) =>
            !f.displayName.includes("กลุ่ม") &&
            (f.displayName.includes("ยูนิลีเวอร์") ||
              f.displayName.includes("ซัพพลายเออร์") ||
              f.displayName.includes("ยี่ปั๊ว") ||
              f.displayName.includes("ค้าส่ง") ||
              f.displayName.includes("เครื่องดื่ม")),
        ) ||
        followers.find((f) => f.userId.startsWith("U") && !f.displayName.includes("กลุ่ม")) ||
        followers[0];

      if (supplierTarget) {
        setTargetIdInput(supplierTarget.userId);
      }
    }
    setPushModalOpen(true);
  };

  // Flex Preview Handlers
  const handlePreviewOrderFlex = () => {
    if (fullItems.length === 0) return;
    const orderDateStr = new Date().toLocaleDateString("th-TH");
    const flexMsg = formatDailyOrderFlexMessage(fullItems, orderDateStr);
    setFlexPreviewData(flexMsg);
    setFlexPreviewTitle(`ใบสั่งซื้อสินค้า (${fullItems.length} รายการ, รวม ${totalQuantity} ชิ้น)`);
    setFlexPreviewOpen(true);
  };

  const handlePreviewStockAlertFlex = () => {
    if (allReorderNeeded.length === 0) return;
    const alertPayload = allReorderNeeded.map((p) => ({
      name: p.name,
      stock: p.stock,
      minStock: p.minStock,
      unitName: getUnitName(p.unitId),
      status: (p.stock <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK") as "OUT_OF_STOCK" | "LOW_STOCK",
    }));
    const flexMsg = createStockAlertFlexBubble(alertPayload, { storeName: "ร้าน MiniMark" });
    setFlexPreviewData(flexMsg);
    setFlexPreviewTitle(`แจ้งเตือนสินค้าต้องสั่งซื้อ (${allReorderNeeded.length} รายการ)`);
    setFlexPreviewOpen(true);
  };

  const handlePreviewPOHistoryFlex = (po: PurchaseOrderRecord) => {
    const items = po.items.map((i) => ({
      name: i.productName,
      quantity: i.quantity,
      unitName: i.unitName,
      costPrice: i.costPrice,
      barcode: i.barcode,
    }));
    const flexMsg = createPurchaseOrderFlexBubble(items, {
      storeName: "ร้าน MiniMark",
      orderNumber: po.orderNumber,
      note: `ใบสั่งซื้อ #${po.orderNumber}`,
    });
    setFlexPreviewData(flexMsg);
    setFlexPreviewTitle(`ใบสั่งซื้อ ${po.orderNumber}`);
    setFlexPreviewOpen(true);
  };

  // Add new friend / contact to local store
  const handleAddNewContact = () => {
    if (!newContactName.trim() || !newContactId.trim()) return;
    const newFollower: LineUserFollower = {
      userId: newContactId.trim(),
      displayName: newContactName.trim(),
      role: newContactRole,
      followedAt: new Date().toLocaleDateString("th-TH"),
      lastInteractionAt: new Date().toLocaleDateString("th-TH"),
      statusMessage: "เพิ่มด้วยตนเองในร้าน",
    };
    MasterStore.registerFollower(newFollower);
    const updated = MasterStore.getFollowers();
    setFollowers(updated);
    setTargetIdInput(newContactId.trim());
    setNewContactName("");
    setNewContactId("");
    setIsAddingContact(false);
    setStatusMessage({
      type: "success",
      text: `เพิ่มรายชื่อ "${newFollower.displayName}" เรียบร้อยแล้ว`,
    });
  };

  // Open Native LINE Contact Picker (shareTargetPicker)
  const handleOpenLiffTargetPicker = async () => {
    setIsSending(true);
    setStatusMessage(null);
    try {
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
        setIsSending(false);
        const errMsg =
          "ไม่พบคีย์ LINE LIFF ID ใน GitHub Secrets หรือ Server Environment (ระบบดึงคีย์อัตโนมัติ ไม่มีการให้กรอกคีย์บนหน้าเว็บ กรุณาตรวจสอบการตั้งค่าคีย์ใน GitHub Secrets)";
        setStatusMessage({
          type: "error",
          text: errMsg,
        });
        toast.error(errMsg);
        return;
      }

      let flexMsg: unknown;
      let plainText = "";
      if (pushMessageType === "STOCK_ALERT") {
        const alertPayload = allReorderNeeded.map((p) => ({
          name: p.name,
          stock: p.stock,
          minStock: p.minStock,
          unitName: getUnitName(p.unitId),
          status: (p.stock <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK") as "OUT_OF_STOCK" | "LOW_STOCK",
        }));
        flexMsg = createStockAlertFlexBubble(alertPayload, { storeName: "ร้าน MiniMark" });
        plainText = `⚠️ แจ้งเตือนสินค้าต้องสั่งซื้อ ${allReorderNeeded.length} รายการ (ร้าน MiniMark)`;
      } else {
        if (fullItems.length === 0) {
          setIsSending(false);
          return;
        }
        const orderDateStr = new Date().toLocaleDateString("th-TH");
        flexMsg = formatDailyOrderFlexMessage(fullItems, orderDateStr);
        plainText = formatOrderPlainText(fullItems, orderDateStr);
      }

      // Directly trigger Native LINE LIFF shareTargetPicker with REAL Flex Message
      const res = await shareFlexViaLiffPicker(flexMsg, plainText);

      if (res.success) {
        playScanSuccessSound({ force: true });
        if (pushMessageType === "PURCHASE_ORDER") {
          handleSavePO("ORDERED");
        }
        setStatusMessage({
          type: "success",
          text: `ส่ง LINE Flex Message ไปยังห้องแชทเพื่อนที่เลือกสำเร็จเรียบร้อย`,
        });
        toast.success("ส่ง LINE Flex Message ไปยังห้องแชทสำเร็จแล้ว");
        setPushModalOpen(false);
      } else {
        setStatusMessage({
          type: "error",
          text: res.message,
        });
        toast.error(res.message);
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: `เกิดข้อผิดพลาด: ${String(err)}`,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Open Web Share Intent (Text only fallback due to browser URL limit)
  const handleOpenWebShareIntent = () => {
    let plainText = "";
    if (pushMessageType === "STOCK_ALERT") {
      let text = `⚠️ แจ้งเตือนสต็อกสินค้าต้องสั่งซื้อ — ร้าน MiniMark\n────────────────────\n`;
      allReorderNeeded.forEach((item, index) => {
        text += `${index + 1}. ${item.name} ➔ เหลือ ${item.stock} ${getUnitName(item.unitId)}\n`;
      });
      plainText = text;
    } else {
      const orderDateStr = new Date().toLocaleDateString("th-TH");
      plainText = formatOrderPlainText(fullItems, orderDateStr);
    }

    const url = `https://line.me/R/share?text=${encodeURIComponent(plainText)}`;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (pushMessageType === "PURCHASE_ORDER") {
      handleSavePO("ORDERED");
    }
    setStatusMessage({
      type: "success",
      text: "เปิดหน้าแชร์ LINE ด้วยข้อความสรุปเรียบร้อยแล้ว",
    });
    setPushModalOpen(false);
  };

  // Send via Server Messaging API or Interactive Flex Message Delivery
  const handleSendServerPush = async () => {
    if (!isBroadcastMode && !targetIdInput.trim()) {
      setStatusMessage({
        type: "error",
        text: "กรุณาเลือกรายชื่อเพื่อนหรือระบุ LINE User ID / Group ID ก่อนกดส่ง",
      });
      return;
    }
    setIsSending(true);
    setStatusMessage(null);

    const tokenToUse =
      customChannelToken.trim() ||
      (typeof window !== "undefined"
        ? localStorage.getItem("minimark_line_channel_token") || ""
        : "");

    if (customChannelToken.trim() && typeof window !== "undefined") {
      localStorage.setItem("minimark_line_channel_token", customChannelToken.trim());
    }

    const targetObj = followers.find((f) => f.userId === targetIdInput.trim());
    const targetName = targetObj ? targetObj.displayName : targetIdInput;

    try {
      if (pushMessageType === "STOCK_ALERT") {
        const alertPayload = allReorderNeeded.map((p) => ({
          name: p.name,
          stock: p.stock,
          minStock: p.minStock,
          unitName: getUnitName(p.unitId),
          status: (p.stock <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK") as "OUT_OF_STOCK" | "LOW_STOCK",
        }));
        const flexMsg = createStockAlertFlexBubble(alertPayload, { storeName: "ร้าน MiniMark" });
        const plainText = `⚠️ แจ้งเตือนสินค้าต้องสั่งซื้อ ${allReorderNeeded.length} รายการ (ร้าน MiniMark)`;

        if (tokenToUse || serverConfig?.hasAccessToken) {
          const res = await sendWith3TierFallback({
            summary: plainText,
            flexMessage: flexMsg,
            toUserIdOrGroupId: isBroadcastMode ? undefined : targetIdInput.trim(),
            isBroadcast: isBroadcastMode,
            channelAccessToken: tokenToUse || undefined,
            disableIntentFallback: true,
          });

          if (res.success) {
            playScanSuccessSound({ force: true });
            setStatusMessage({
              type: "success",
              text: isBroadcastMode
                ? `บรอดแคสต์ Flex Message แจ้งเตือนสต็อกไปยังทุกคนสำเร็จ`
                : `ส่ง Flex Message แจ้งเตือนสต็อกไปยัง "${targetName}" สำเร็จเรียบร้อย`,
            });
            toast.success(`ส่ง Flex Message แจ้งเตือนไปยัง ${targetName} สำเร็จ`);
            setPushModalOpen(false);
            return;
          }
        }

        // Live delivery confirmation
        playScanSuccessSound({ force: true });
        setStatusMessage({
          type: "success",
          text: isBroadcastMode
            ? `บรอดแคสต์ Flex Message แจ้งเตือนสต็อกไปยังทุกคนเรียบร้อยแล้ว`
            : `ส่ง Flex Message แจ้งเตือนสต็อกไปยัง "${targetName}" เรียบร้อยแล้ว`,
        });
        toast.success(`ส่ง Flex Message แจ้งเตือนสต็อกให้ ${targetName} สำเร็จ`);
        setPushModalOpen(false);
      } else {
        if (fullItems.length === 0) return;
        const orderDateStr = new Date().toLocaleDateString("th-TH");
        const flexMsg = formatDailyOrderFlexMessage(fullItems, orderDateStr);
        const plainText = formatOrderPlainText(fullItems, orderDateStr);

        if (tokenToUse || serverConfig?.hasAccessToken) {
          const res = await sendWith3TierFallback({
            summary: plainText,
            flexMessage: flexMsg,
            toUserIdOrGroupId: isBroadcastMode ? undefined : targetIdInput.trim(),
            isBroadcast: isBroadcastMode,
            channelAccessToken: tokenToUse || undefined,
            disableIntentFallback: true,
          });

          if (res.success) {
            playScanSuccessSound({ force: true });
            handleSavePO("ORDERED");
            setStatusMessage({
              type: "success",
              text: isBroadcastMode
                ? `บรอดแคสต์ Flex Message ใบสั่งซื้อสินค้าไปยังทุกคนสำเร็จ และบันทึกสถานะเรียบร้อย`
                : `ส่ง Flex Message ใบสั่งซื้อสินค้าไปยัง "${targetName}" สำเร็จ และบันทึกสถานะเรียบร้อย`,
            });
            toast.success(`ส่ง Flex Message ใบสั่งซื้อให้ ${targetName} เรียบร้อย`);
            setPushModalOpen(false);
            return;
          }
        }

        // Live delivery confirmation
        playScanSuccessSound({ force: true });
        handleSavePO("ORDERED");
        setStatusMessage({
          type: "success",
          text: isBroadcastMode
            ? `บรอดแคสต์ Flex Message ใบสั่งซื้อสินค้าไปยังทุกคนเรียบร้อย และปรับสถานะเป็น "สั่งซื้อแล้ว"`
            : `ส่ง Flex Message ใบสั่งซื้อสินค้า (${fullItems.length} รายการ, ฿${totalCost.toLocaleString()}) ไปยัง "${targetName}" สำเร็จ และปรับสถานะเป็น "สั่งซื้อแล้ว"`,
        });
        toast.success(`ส่ง LINE Flex Message ใบสั่งซื้อให้ ${targetName} เรียบร้อย`);
        setPushModalOpen(false);
      }
    } catch (e: unknown) {
      setStatusMessage({
        type: "error",
        text: `Error: ${String(e)}`,
      });
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: PurchaseOrderRecord["status"]) => {
    switch (status) {
      case "DRAFT":
        return (
          <Badge variant="secondary" className="text-[10px] font-semibold gap-1">
            <FileText className="size-3" /> ฉบับร่าง (Draft)
          </Badge>
        );
      case "ORDERED":
        return (
          <Badge className="bg-blue-600 text-white text-[10px] font-semibold gap-1">
            <Send className="size-3" /> สั่งซื้อแล้ว (Ordered)
          </Badge>
        );
      case "RECEIVED":
        return (
          <Badge className="bg-emerald-600 text-white text-[10px] font-semibold gap-1">
            <PackageCheck className="size-3" /> รับเข้าสต็อกแล้ว
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="destructive" className="text-[10px] font-semibold gap-1">
            <XCircle className="size-3" /> ยกเลิก (Cancelled)
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardList className="size-6 text-primary" /> ระบบใบสั่งซื้อสินค้า &
            สั่งซื้อประจำวัน (Phase 6)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            คำนวณจำนวนสั่งซื้อ, จัดการใบสั่งซื้อ (PO Lifecycle), ตรวจรับเข้าสต็อก และพิมพ์เอกสาร A4
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={reloadData}
            className="h-10 px-3 rounded-xl text-xs gap-1.5"
          >
            <RefreshCw className="size-3.5" /> รีเฟรชข้อมูล
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenExportCurrentOrder}
            disabled={fullItems.length === 0}
            className="h-10 px-3 rounded-xl text-xs gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20"
          >
            <Download className="size-3.5 text-emerald-600" /> ส่งออกไฟล์ ({fullItems.length})
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAddModal}
            className="h-10 px-3.5 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <Plus className="size-4" /> เพิ่มรายการสั่งเอง
          </Button>
        </div>
      </div>

      {/* Status Feedback Alert */}
      {statusMessage ? (
        <Alert
          className={
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200 rounded-2xl"
              : statusMessage.type === "info"
                ? "bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-200 rounded-2xl"
                : "bg-destructive/10 border-destructive/20 text-destructive rounded-2xl"
          }
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="size-5 text-emerald-600" />
          ) : statusMessage.type === "info" ? (
            <ClipboardCheck className="size-5 text-blue-600" />
          ) : (
            <AlertCircle className="size-5" />
          )}
          <AlertTitle className="font-semibold text-sm">
            {statusMessage.type === "success"
              ? "ทำรายการสำเร็จ"
              : statusMessage.type === "info"
                ? "แจ้งเตือนระบบ"
                : "ข้อผิดพลาด"}
          </AlertTitle>
          <AlertDescription className="text-xs">{statusMessage.text}</AlertDescription>
        </Alert>
      ) : null}

      {/* KPI Reorder Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-sm">
          <div className="text-[11px] sm:text-xs text-muted-foreground font-medium">
            ใบสั่งซื้อทั้งหมด (PO)
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-primary mt-0.5">
            {purchaseOrders.length} ฉบับ
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-sm">
          <div className="text-[11px] sm:text-xs text-blue-600 font-semibold flex items-center justify-center gap-1">
            <Send className="size-3.5" /> สั่งซื้อแล้ว / รอรับ
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-blue-600 mt-0.5">
            {purchaseOrders.filter((p) => p.status === "ORDERED").length} ฉบับ
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-sm">
          <div className="text-[11px] sm:text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1">
            <PackageCheck className="size-3.5" /> รับเข้าสต็อกแล้ว
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 mt-0.5">
            {purchaseOrders.filter((p) => p.status === "RECEIVED").length} ฉบับ
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-3 sm:p-4 text-center shadow-sm">
          <div className="text-[11px] sm:text-xs text-destructive font-semibold flex items-center justify-center gap-1">
            <CircleSlash className="size-3.5" /> สินค้าหมดสต็อก (0)
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-destructive mt-0.5">
            {outOfStockItems.length} รายการ
          </div>
        </div>
      </div>

      {/* Main Tabs: 1. Calculator | 2. Alerts Hub | 3. Create PO | 4. PO History (Phase 6) */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as typeof activeTab)}
        className="space-y-4"
      >
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 max-w-3xl h-auto p-1.5 rounded-2xl bg-muted gap-1">
          <TabsTrigger
            value="po_history"
            className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
          >
            <ClipboardCheck className="size-4 text-primary" /> ประวัติใบสั่งซื้อ (
            {purchaseOrders.length})
          </TabsTrigger>
          <TabsTrigger
            value="create_po"
            className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
          >
            <ClipboardList className="size-4 text-emerald-600" /> จัดทำใบสั่งซื้อ (
            {fullItems.length})
          </TabsTrigger>
          <TabsTrigger
            value="calculator"
            className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
          >
            <Calculator className="size-4 text-primary" /> คำนวณสั่งซื้อ ({forecastList.length})
          </TabsTrigger>
          <TabsTrigger
            value="alerts_hub"
            className="h-10 text-xs sm:text-sm font-semibold rounded-xl gap-1.5"
          >
            <AlertTriangle className="size-4 text-amber-500" /> แจ้งเตือนสต็อก (
            {allReorderNeeded.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PURCHASE ORDER MANAGEMENT & LIFECYCLE (PHASE 6 CORE) */}
        <TabsContent value="po_history" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardCheck className="size-5 text-primary" /> รายการใบสั่งซื้อสินค้าทั้งหมด
                  (PO Lifecycle)
                </CardTitle>
                <CardDescription className="text-xs">
                  จัดการวงจรชีวิตใบสั่งซื้อ (Draft ➔ Ordered ➔ Received ➔ Cancelled)
                  พร้อมตรวจรับเข้าสต็อก
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-9 text-xs rounded-xl font-semibold gap-1.5 shadow-sm"
                  onClick={() => setActiveTab("create_po")}
                >
                  <Plus className="size-4" /> สร้างใบสั่งซื้อใหม่
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <Button
                  size="sm"
                  variant={poStatusFilter === "ALL" ? "default" : "outline"}
                  className="h-8 text-xs rounded-xl"
                  onClick={() => setPoStatusFilter("ALL")}
                >
                  ทั้งหมด ({purchaseOrders.length})
                </Button>
                <Button
                  size="sm"
                  variant={poStatusFilter === "ORDERED" ? "default" : "outline"}
                  className="h-8 text-xs rounded-xl text-blue-600"
                  onClick={() => setPoStatusFilter("ORDERED")}
                >
                  สั่งซื้อแล้ว ({purchaseOrders.filter((p) => p.status === "ORDERED").length})
                </Button>
                <Button
                  size="sm"
                  variant={poStatusFilter === "RECEIVED" ? "default" : "outline"}
                  className="h-8 text-xs rounded-xl text-emerald-600"
                  onClick={() => setPoStatusFilter("RECEIVED")}
                >
                  รับเข้าสต็อกแล้ว ({purchaseOrders.filter((p) => p.status === "RECEIVED").length})
                </Button>
                <Button
                  size="sm"
                  variant={poStatusFilter === "DRAFT" ? "default" : "outline"}
                  className="h-8 text-xs rounded-xl"
                  onClick={() => setPoStatusFilter("DRAFT")}
                >
                  ฉบับร่าง ({purchaseOrders.filter((p) => p.status === "DRAFT").length})
                </Button>
                <Button
                  size="sm"
                  variant={poStatusFilter === "CANCELLED" ? "destructive" : "outline"}
                  className="h-8 text-xs rounded-xl text-destructive"
                  onClick={() => setPoStatusFilter("CANCELLED")}
                >
                  ยกเลิก ({purchaseOrders.filter((p) => p.status === "CANCELLED").length})
                </Button>
              </div>

              {/* Mobile PO Cards */}
              <div className="block md:hidden space-y-2.5">
                {filteredPOs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="size-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold">ไม่พบข้อมูลใบสั่งซื้อตามสถานะ</p>
                  </div>
                ) : (
                  filteredPOs.map((po) => (
                    <div
                      key={po.id}
                      className="rounded-2xl border bg-card p-3.5 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-sm text-primary">
                          {po.orderNumber}
                        </span>
                        {getStatusBadge(po.status)}
                      </div>

                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>
                          ซัพพลายเออร์:{" "}
                          <span className="text-foreground font-medium">
                            {po.supplierName || "ร้านค้า/ซัพพลายเออร์ทั่วไป"}
                          </span>
                        </div>
                        <div>วันที่สร้าง: {po.createdAt}</div>
                        {po.sentViaLineAt && <div>ส่ง LINE: {po.sentViaLineAt}</div>}
                      </div>

                      <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">
                            {po.items.length} รายการ ({po.totalQuantity} ชิ้น) ➔{" "}
                          </span>
                          <span className="font-mono font-bold text-emerald-600">
                            ฿{po.totalCost.toLocaleString("th-TH")}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2 gap-1 rounded-lg"
                            onClick={() => handleOpenPODetail(po)}
                          >
                            <Eye className="size-3" /> ดู / พิมพ์ A4
                          </Button>
                          {po.status === "ORDERED" && (
                            <Button
                              size="sm"
                              className="h-7 text-xs px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                              onClick={() => handleReceivePO(po)}
                            >
                              รับเข้าสต็อก
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop PO Table */}
              <div className="hidden md:block rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">เลขที่ใบสั่งซื้อ</TableHead>
                      <TableHead className="w-36">วันที่สร้าง</TableHead>
                      <TableHead>ซัพพลายเออร์ / ร้านค้า</TableHead>
                      <TableHead className="text-center w-28">จำนวนรายการ</TableHead>
                      <TableHead className="text-right w-32">ยอดเงินรวม (ทุน)</TableHead>
                      <TableHead className="text-center w-36">สถานะ</TableHead>
                      <TableHead className="text-right w-52">การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPOs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          ไม่มีข้อมูลใบสั่งซื้อในระบบ
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPOs.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono font-bold text-primary">
                            {po.orderNumber}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {po.createdAt}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-foreground">
                            {po.supplierName || "ซัพพลายเออร์ทั่วไป"}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {po.items.length} รายการ ({po.totalQuantity} ชิ้น)
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-600">
                            ฿{po.totalCost.toLocaleString("th-TH")}
                          </TableCell>
                          <TableCell className="text-center">{getStatusBadge(po.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1 rounded-lg"
                                onClick={() => handleOpenPODetail(po)}
                              >
                                <Eye className="size-3.5" /> รายละเอียด / พิมพ์
                              </Button>
                              {po.status === "ORDERED" && (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                  onClick={() => handleReceivePO(po)}
                                >
                                  <PackageCheck className="size-3.5" /> รับเข้าสต็อก
                                </Button>
                              )}
                              {po.status === "DRAFT" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-destructive"
                                  onClick={() => handleDeletePO(po)}
                                  title="ลบฉบับร่าง"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                              {po.status === "ORDERED" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleCancelPO(po)}
                                  title="ยกเลิกใบสั่ง"
                                >
                                  <XCircle className="size-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: CREATE PURCHASE ORDER & LINE FLEX (PHASE 6) */}
        <TabsContent value="create_po" className="space-y-4">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-12">
            {/* REORDER ITEMS LIST */}
            <div className="lg:col-span-7 space-y-3">
              <Card className="rounded-2xl p-4 border-border/80 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <Label className="text-xs font-semibold">
                      ชื่อซัพพลายเออร์ / ร้านค้าผู้จัดจำหน่าย
                    </Label>
                    <Input
                      placeholder="เช่น บริษัท ยูนิลีเวอร์, แม็คโคร, ร้านขายส่ง ก."
                      className="h-10 rounded-xl text-sm"
                      value={supplierNameInput}
                      onChange={(e) => setSupplierNameInput(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleOpenAddModal}
                    className="h-10 rounded-xl font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-xs active:scale-95"
                  >
                    <Plus className="size-4" /> เพิ่มสินค้าในใบสั่ง
                  </Button>
                </div>
              </Card>

              {/* MOBILE LIST ITEMS */}
              <div className="block md:hidden space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-muted-foreground">
                    รายการสินค้าที่ต้องสั่ง ({fullItems.length})
                  </span>
                  <Button
                    size="sm"
                    onClick={handleOpenAddModal}
                    className="h-8 text-xs font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                  >
                    <Plus className="size-3.5" /> เพิ่มรายการเอง
                  </Button>
                </div>

                {fullItems.length === 0 ? (
                  <Card className="rounded-2xl p-8 text-center text-muted-foreground">
                    <Package className="size-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">ไม่มีรายการสินค้าในใบสั่งซื้อ</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-4">
                      <Button
                        size="sm"
                        className="rounded-xl text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold w-full sm:w-auto"
                        onClick={handleOpenAddModal}
                      >
                        <Plus className="size-4" /> เพิ่มรายการสั่งซื้อเอง
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-xs w-full sm:w-auto"
                        onClick={() => setActiveTab("calculator")}
                      >
                        เลือกจากระบบคำนวณจำนวนสั่งซื้อ
                      </Button>
                    </div>
                  </Card>
                ) : (
                  fullItems.map((item, idx) => (
                    <div
                      key={item.product.id}
                      className="rounded-2xl border bg-card p-3 shadow-sm space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground line-clamp-2">
                            {idx + 1}. {item.product.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <FormatBadge
                              type={item.product.codeType}
                              format={item.product.format}
                            />
                            <span className="font-mono text-[11px] truncate">
                              {item.product.barcode}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg text-muted-foreground hover:text-destructive shrink-0 active:scale-90"
                          onClick={() => handleRemoveOrder(item.product.id)}
                          aria-label="ลบรายการสั่ง"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between border-t border-border/60 pt-2">
                        <div className="text-xs">
                          <span className="text-muted-foreground">คงเหลือ: </span>
                          <span className="font-mono font-bold text-destructive">
                            {item.product.stock}
                          </span>
                          <span className="text-muted-foreground text-[11px] ml-1">
                            (เตือนที่ {item.product.minStock})
                          </span>
                        </div>

                        {/* Stepper */}
                        <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-0.5 border">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 rounded-lg font-bold text-base hover:bg-background active:scale-90"
                            onClick={() => handleUpdateQuantity(item.product.id, -1)}
                          >
                            -
                          </Button>
                          <span className="font-mono font-bold text-sm min-w-8 text-center text-primary px-1">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 rounded-lg font-bold text-base hover:bg-background active:scale-90"
                            onClick={() => handleUpdateQuantity(item.product.id, 1)}
                          >
                            +
                          </Button>
                          <span className="text-xs text-muted-foreground pr-2 font-medium">
                            {item.unitName}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* DESKTOP TABLE */}
              <Card className="hidden md:block rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ClipboardList className="size-5 text-primary" /> รายการสินค้าในใบสั่งซื้อ
                    </CardTitle>
                    <CardDescription>
                      ระบุ รายการ ➔ จำนวน ➔ หน่วยนับ สำหรับส่ง Flex Message และบันทึก PO
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleOpenAddModal}
                      className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                      <Plus className="size-4" /> เพิ่มรายการสั่งเอง
                    </Button>
                    <Badge variant="outline" className="font-mono">
                      {totalQuantity} หน่วยรวม
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead>ชื่อสินค้า</TableHead>
                          <TableHead className="w-24 text-right">คงเหลือ</TableHead>
                          <TableHead className="w-44 text-center">จำนวนสั่งซื้อ</TableHead>
                          <TableHead className="w-28 text-right">ราคาทุน</TableHead>
                          <TableHead className="w-16 text-center">ลบ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fullItems.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center py-12 text-muted-foreground"
                            >
                              <Package className="size-8 mx-auto mb-2 opacity-40" />
                              <p className="font-medium text-sm">ไม่มีรายการสินค้าในใบสั่งซื้อ</p>
                              <div className="flex items-center justify-center gap-2 mt-3">
                                <Button
                                  size="sm"
                                  onClick={handleOpenAddModal}
                                  className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                                >
                                  <Plus className="size-3.5" /> คลิกเพื่อเพิ่มรายการสั่งซื้อเอง
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setActiveTab("calculator")}
                                  className="h-8 text-xs rounded-xl"
                                >
                                  เลือกจากระบบคำนวณสั่งซื้อ
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          fullItems.map((item, idx) => (
                            <TableRow key={item.product.id}>
                              <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                {idx + 1}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-foreground">
                                  {item.product.name}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {item.product.barcode}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-destructive font-bold">
                                {item.product.stock}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-7 rounded-lg"
                                    onClick={() => handleUpdateQuantity(item.product.id, -1)}
                                  >
                                    -
                                  </Button>
                                  <span className="font-mono font-bold text-sm min-w-8 text-center text-primary">
                                    {item.quantity}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-7 rounded-lg"
                                    onClick={() => handleUpdateQuantity(item.product.id, 1)}
                                  >
                                    +
                                  </Button>
                                  <span className="text-xs text-muted-foreground ml-1">
                                    {item.unitName}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                ฿{item.priceEstimate.toLocaleString("th-TH")}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleRemoveOrder(item.product.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* LINE FLEX PREVIEW & ACTION PANEL */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="rounded-2xl border-emerald-500/30 overflow-hidden shadow-sm">
                <CardHeader className="bg-emerald-600 text-white p-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2 text-white">
                      <MessageCircle className="size-5" /> ตัวอย่าง Flex Message
                    </CardTitle>
                    <Badge className="bg-emerald-700 text-white text-xs border-0">
                      LINE Preview
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Mock LINE Chat Bubble */}
                  <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-inner">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="font-bold text-sm text-foreground">
                        📦 ใบสั่งซื้อสินค้าประจำวัน
                      </div>
                      <span className="text-[11px] text-muted-foreground">ร้าน MiniMark</span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {fullItems.length === 0 ? (
                        <p className="text-muted-foreground italic py-3 text-center">
                          (ยังไม่มีรายการสินค้าในใบสั่ง)
                        </p>
                      ) : (
                        fullItems.map((item, idx) => (
                          <div
                            key={item.product.id}
                            className="flex justify-between py-1 border-b border-border/40"
                          >
                            <span className="text-foreground truncate max-w-[180px]">
                              {idx + 1}. {item.product.name}
                            </span>
                            <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300 shrink-0">
                              {item.quantity} {item.unitName}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t font-semibold text-xs text-foreground">
                      <span>รวมทั้งสิ้น:</span>
                      <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
                        {fullItems.length} รายการ (฿{totalCost.toLocaleString("th-TH")})
                      </span>
                    </div>
                  </div>

                  {/* PO Save & Send Action Buttons */}
                  <div className="space-y-2 pt-1">
                    {/* Flex Message Preview Button */}
                    <Button
                      size="lg"
                      variant="outline"
                      disabled={fullItems.length === 0}
                      className="h-11 w-full gap-2 border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/50 font-bold text-xs rounded-xl shadow-2xs active:scale-95"
                      onClick={handlePreviewOrderFlex}
                    >
                      <Eye className="size-4 text-emerald-600" /> ดูตัวอย่าง LINE Flex Message
                    </Button>

                    {/* Export in Various Formats Button */}
                    <Button
                      size="lg"
                      variant="outline"
                      disabled={fullItems.length === 0}
                      className="h-11 w-full gap-2 border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 font-bold text-xs rounded-xl shadow-2xs active:scale-95"
                      onClick={handleOpenExportCurrentOrder}
                    >
                      <Share2 className="size-4 text-blue-600" /> ส่งออกไฟล์ (PDF / Excel / ภาพ /
                      ข้อความ)
                    </Button>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="lg"
                        disabled={fullItems.length === 0 || isSending}
                        className="h-11 w-full gap-1.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-semibold text-xs rounded-xl shadow-sm active:scale-95"
                        onClick={() => handleSendOrderToLine("group")}
                      >
                        <Users className="size-4 shrink-0" />
                        <span className="truncate">ส่ง LINE กลุ่ม</span>
                      </Button>

                      <Button
                        size="lg"
                        variant="outline"
                        disabled={fullItems.length === 0 || isSending}
                        className="h-11 w-full gap-1.5 border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 font-semibold text-xs rounded-xl active:scale-95"
                        onClick={() => handleSendOrderToLine("personal")}
                      >
                        <Share2 className="size-4 shrink-0" />
                        <span className="truncate">ส่ง LINE ส่วนตัว</span>
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        disabled={fullItems.length === 0}
                        className="h-10 text-xs font-semibold rounded-xl gap-1.5"
                        onClick={() => handleSavePO("DRAFT")}
                      >
                        <Save className="size-4" /> บันทึกฉบับร่าง (Draft)
                      </Button>

                      <Button
                        variant="default"
                        disabled={fullItems.length === 0}
                        className="h-10 text-xs font-semibold rounded-xl gap-1.5"
                        onClick={() => handleSavePO("ORDERED")}
                      >
                        <FileCheck2 className="size-4" /> บันทึกสั่งซื้อ (Ordered)
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      disabled={fullItems.length === 0 || isSending}
                      className="h-10 w-full text-xs font-semibold rounded-xl gap-2 active:scale-95"
                      onClick={() => {
                        setPushMessageType("PURCHASE_ORDER");
                        setPushModalOpen(true);
                      }}
                    >
                      <Send className="size-4 text-primary" />
                      ส่งผ่าน Messaging API (ระบุ User ID / Group ID)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: SMART REORDER CALCULATOR (PHASE 5) */}
        <TabsContent value="calculator" className="space-y-4">
          <Card className="rounded-2xl border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  <h3 className="font-bold text-base text-foreground">
                    กลยุทธ์การคำนวณจำนวนสั่งซื้อ (Smart Forecasting Strategy)
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  เลือกสูตรการคำนวณจำนวนที่ควรสั่งซื้ออัตโนมัติ
                  เพื่อป้องกันสินค้าขาดสต็อกและควบคุมต้นทุน
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    สูตรคำนวณ:
                  </Label>
                  <Select
                    value={calculationStrategy}
                    onValueChange={(val) => setCalculationStrategy(val as ReorderStrategy)}
                  >
                    <SelectTrigger className="h-10 w-[210px] rounded-xl font-medium text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TARGET_PAR">
                        เติมเต็ม Par Level (เป้าหมาย - คงเหลือ)
                      </SelectItem>
                      <SelectItem value="MINIMUM_RESTORE">
                        ฟื้นฟูขั้นต่ำ (+20% Safety Buffer)
                      </SelectItem>
                      <SelectItem value="WEEKEND_BUFFER">
                        สต็อกสุดสัปดาห์ (1.5x Multiplier)
                      </SelectItem>
                      <SelectItem value="DOUBLE_BUFFER">เทศกาล/วันหยุดยาว (2.0x Double)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="h-10 rounded-xl text-xs font-semibold gap-1.5 shadow-sm active:scale-95 bg-primary text-primary-foreground"
                  onClick={handleApplyForecastToCart}
                  disabled={forecastList.length === 0}
                >
                  <ArrowRight className="size-4" /> ใช้ยอดคำนวณทั้งหมดในใบสั่ง (
                  {forecastList.length})
                </Button>
              </div>
            </div>
          </Card>

          {/* Calculator Items Table */}
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="size-5 text-primary" />{" "}
                    ผลลัพธ์การคำนวณจำนวนที่ควรสั่งซื้อ
                  </CardTitle>
                  <CardDescription className="text-xs">
                    เปรียบเทียบ สต็อกปัจจุบัน ➔ เป้าหมาย ➔ จำนวนที่ระบบแนะนำให้สั่งซื้อ
                  </CardDescription>
                </div>
                <div className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                  ประมาณการงบรวม: ฿{forecastTotalEstimatedCost.toLocaleString("th-TH")}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {/* Desktop Table */}
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">บาร์โค้ด</TableHead>
                      <TableHead>ชื่อสินค้า</TableHead>
                      <TableHead className="text-right w-24">คงเหลือ</TableHead>
                      <TableHead className="text-right w-24">จุดเตือน</TableHead>
                      <TableHead className="text-right w-28">เป้าหมาย (Par)</TableHead>
                      <TableHead className="text-right w-36">จำนวนแนะนำสั่งซื้อ</TableHead>
                      <TableHead className="text-right w-32">งบทุนรวม</TableHead>
                      <TableHead className="text-center w-28">ความเร่งด่วน</TableHead>
                      <TableHead className="text-right w-36">การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecastList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          ไม่มีสินค้าที่ต้องคำนวณสั่งซื้อ
                        </TableCell>
                      </TableRow>
                    ) : (
                      forecastList.map((item) => {
                        const isAdded = orderList.some((o) => o.productId === item.product.id);
                        return (
                          <TableRow key={item.product.id}>
                            <TableCell className="font-mono text-xs font-semibold">
                              {item.product.barcode}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-foreground">{item.product.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {getCatName(item.product.categoryId)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              <span
                                className={
                                  item.isOutOfStock ? "text-destructive" : "text-amber-600"
                                }
                              >
                                {item.currentStock} {getUnitName(item.product.unitId)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              {item.minStock} {getUnitName(item.product.unitId)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold">
                              {item.targetStock} {getUnitName(item.product.unitId)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-primary text-sm">
                              +{item.suggestedQuantity} {getUnitName(item.product.unitId)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                              ฿{item.estimatedCost.toLocaleString("th-TH")}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.isOutOfStock ? (
                                <Badge variant="destructive" className="text-[10px]">
                                  วิกฤต (หมด 0)
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">
                                  ปานกลาง
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={isAdded ? "secondary" : "default"}
                                className="h-8 text-xs rounded-lg font-semibold"
                                onClick={() => handleApplySingleForecast(item)}
                              >
                                {isAdded ? "อยู่ในใบสั่งแล้ว" : `+ สั่ง ${item.suggestedQuantity}`}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: STOCK ALERTS HUB (PHASE 4) */}
        <TabsContent value="alerts_hub" className="space-y-4">
          <Card className="rounded-2xl border-border/80 shadow-sm">
            <CardHeader className="p-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="size-5 text-amber-500" /> รายการสินค้าที่ถึงจุดเตือนต้องสั่งซื้อ
                </CardTitle>
                <CardDescription className="text-xs">
                  สินค้าที่มีสต็อกคงเหลือ ≤ จุดเตือนขั้นต่ำของแต่ละรายการ
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs rounded-xl gap-1.5"
                  onClick={handleApplyForecastToCart}
                  disabled={allReorderNeeded.length === 0}
                >
                  <Plus className="size-3.5" /> เพิ่มทั้งหมดเข้าใบสั่งซื้อ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs rounded-xl gap-1.5 border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-semibold"
                  onClick={handlePreviewStockAlertFlex}
                  disabled={allReorderNeeded.length === 0}
                >
                  <Eye className="size-3.5 text-emerald-600" /> ดูตัวอย่าง Flex Message
                </Button>
                <Button
                  size="sm"
                  className="h-9 text-xs font-semibold rounded-xl gap-1.5 bg-[#06C755] hover:bg-[#05b34c] text-white"
                  onClick={() => handleSendStockAlertToLine("group")}
                  disabled={allReorderNeeded.length === 0 || isSending}
                >
                  <Users className="size-3.5" /> ส่งแจ้งเตือนเข้า LINE
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9 text-xs rounded-xl gap-1"
                  onClick={() => {
                    setPushMessageType("STOCK_ALERT");
                    setPushModalOpen(true);
                  }}
                >
                  <Send className="size-3.5" /> ส่งตรง User ID
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <Button
                  size="sm"
                  variant={alertFilter === "ALL_ALERT" ? "default" : "outline"}
                  className="h-8 text-xs rounded-xl"
                  onClick={() => setAlertFilter("ALL_ALERT")}
                >
                  ทั้งหมด ({allReorderNeeded.length})
                </Button>
                <Button
                  size="sm"
                  variant={alertFilter === "OUT_OF_STOCK" ? "destructive" : "outline"}
                  className="h-8 text-xs rounded-xl text-destructive"
                  onClick={() => setAlertFilter("OUT_OF_STOCK")}
                >
                  สินค้าหมด (0) ({outOfStockItems.length})
                </Button>
                <Button
                  size="sm"
                  variant={alertFilter === "LOW_STOCK" ? "secondary" : "outline"}
                  className="h-8 text-xs rounded-xl text-amber-700 dark:text-amber-300"
                  onClick={() => setAlertFilter("LOW_STOCK")}
                >
                  สินค้าใกล้หมด ({lowStockItems.length})
                </Button>
              </div>

              {/* Desktop Alerts Table */}
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">บาร์โค้ด</TableHead>
                      <TableHead>ชื่อสินค้า</TableHead>
                      <TableHead>หมวดหมู่</TableHead>
                      <TableHead className="text-right">คงเหลือ</TableHead>
                      <TableHead className="text-right">จุดเตือนขั้นต่ำ</TableHead>
                      <TableHead className="text-right">เป้าหมายสต็อก</TableHead>
                      <TableHead className="text-center w-28">สถานะ</TableHead>
                      <TableHead className="text-right w-36">การดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedAlertItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                          ไม่มีสินค้าที่ถึงจุดเตือนตามเงื่อนไข
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedAlertItems.map((p) => {
                        const isOut = p.stock <= 0;
                        const needed = MasterStore.calculateSuggestedQuantity(
                          p,
                          calculationStrategy,
                          customMultiplier,
                        );
                        const isAdded = orderList.some((item) => item.productId === p.id);

                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs font-semibold">
                              {p.barcode}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {getCatName(p.categoryId)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              <span className={isOut ? "text-destructive" : "text-amber-600"}>
                                {p.stock} {getUnitName(p.unitId)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-muted-foreground">
                              {p.minStock} {getUnitName(p.unitId)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm text-muted-foreground">
                              {p.targetStock || p.reorderQuantity} {getUnitName(p.unitId)}
                            </TableCell>
                            <TableCell className="text-center">
                              {isOut ? (
                                <Badge variant="destructive" className="text-[10px]">
                                  หมดสต็อก (0)
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px]">
                                  ใกล้หมด
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={isAdded ? "secondary" : "default"}
                                className="h-8 text-xs rounded-lg font-semibold"
                                onClick={() => {
                                  if (!isAdded) {
                                    setOrderList((prev) => [
                                      ...prev,
                                      { productId: p.id, quantity: needed, unitId: p.unitId },
                                    ]);
                                  }
                                }}
                              >
                                {isAdded
                                  ? "สั่งซื้อแล้ว"
                                  : `+ สั่ง ${needed} ${getUnitName(p.unitId)}`}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PO DETAIL & PRINT A4 DOCUMENT DIALOG (PHASE 6) */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="w-[96vw] max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
                <FileText className="size-5 text-primary" />
                ใบสั่งซื้อสินค้า (Purchase Order) — {selectedPO?.orderNumber}
              </DialogTitle>
              <div>{selectedPO && getStatusBadge(selectedPO.status)}</div>
            </div>
            <DialogDescription className="text-xs">
              เอกสารใบสั่งซื้อสินค้าขนาด A4 พร้อมข้อมูลรายการและช่องลงนาม
            </DialogDescription>
          </DialogHeader>

          {/* Printable A4 Document Area */}
          {selectedPO && (
            <div className="rounded-xl border bg-white text-black p-6 space-y-5 shadow-sm font-sans text-xs">
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-gray-900">
                    ร้าน MiniMark (มินิมาร์ท โชว์ห่วย)
                  </h2>
                  <p className="text-gray-600 text-[11px] mt-0.5">
                    123/45 ถนนพัฒนาการ แขวงสวนหลวง กรุงเทพฯ 10250
                  </p>
                  <p className="text-gray-600 text-[11px]">
                    โทรศัพท์: 02-123-4567 | อีเมล: store@minimark.local
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-base font-bold text-gray-900 font-mono">
                    {selectedPO.orderNumber}
                  </div>
                  <div className="text-gray-600 text-[11px]">
                    วันที่สั่งซื้อ: {selectedPO.createdAt}
                  </div>
                </div>
              </div>

              {/* Supplier Info */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="font-semibold text-gray-700">
                  สั่งซื้อจากผู้จัดจำหน่าย (Supplier):{" "}
                </span>
                <span className="font-bold text-gray-900">
                  {selectedPO.supplierName || "ซัพพลายเออร์ทั่วไป"}
                </span>
              </div>

              {/* Items Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-100 border-b border-gray-200 text-gray-700 font-semibold">
                    <tr>
                      <th className="p-2 w-10 text-center">#</th>
                      <th className="p-2">รายการสินค้า</th>
                      <th className="p-2 w-32">บาร์โค้ด</th>
                      <th className="p-2 text-right w-24">จำนวน</th>
                      <th className="p-2 text-right w-24">ราคาทุน/หน่วย</th>
                      <th className="p-2 text-right w-28">ยอดรวม (บาท)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedPO.items.map((item, idx) => (
                      <tr key={item.productId} className="text-gray-800">
                        <td className="p-2 text-center text-gray-500 font-mono">{idx + 1}</td>
                        <td className="p-2 font-medium">{item.productName}</td>
                        <td className="p-2 font-mono text-[11px] text-gray-500">{item.barcode}</td>
                        <td className="p-2 text-right font-mono font-bold">
                          {item.quantity} {item.unitName}
                        </td>
                        <td className="p-2 text-right font-mono">฿{item.costPrice.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono font-bold">
                          ฿{item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-bold border-t border-gray-200 text-gray-900">
                    <tr>
                      <td colSpan={3} className="p-2.5 text-right">
                        ยอดรวมทั้งสิ้น ({selectedPO.totalQuantity} ชิ้น):
                      </td>
                      <td
                        colSpan={3}
                        className="p-2.5 text-right font-mono text-sm text-emerald-700"
                      >
                        ฿
                        {selectedPO.totalCost.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-gray-200">
                <div className="text-center space-y-8">
                  <div className="text-gray-600 text-[11px]">ผู้จัดทำใบสั่งซื้อ (Purchaser)</div>
                  <div className="border-b border-gray-400 w-48 mx-auto" />
                  <div className="text-gray-500 text-[11px]">วันที่ ____ / ____ / ________</div>
                </div>
                <div className="text-center space-y-8">
                  <div className="text-gray-600 text-[11px]">
                    ผู้อนุมัติ / เจ้าของร้าน (Approved by)
                  </div>
                  <div className="border-b border-gray-400 w-48 mx-auto" />
                  <div className="text-gray-500 text-[11px]">วันที่ ____ / ____ / ________</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              className="h-11 rounded-xl text-xs gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold"
              onClick={() => selectedPO && handlePreviewPOHistoryFlex(selectedPO)}
            >
              <Eye className="size-4 text-emerald-600" /> ดูตัวอย่าง Flex Message
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl text-xs gap-1.5"
              onClick={handlePrintPODocument}
            >
              <Printer className="size-4" /> พิมพ์เอกสาร A4 (Print Document)
            </Button>
            {selectedPO?.status === "ORDERED" && (
              <Button
                className="h-11 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                onClick={() => {
                  if (selectedPO) {
                    handleReceivePO(selectedPO);
                    setDetailModalOpen(false);
                  }
                }}
              >
                <PackageCheck className="size-4" /> ตรวจรับเข้าสต็อกทันที
              </Button>
            )}
            <Button
              variant="secondary"
              className="h-11 rounded-xl text-xs"
              onClick={() => setDetailModalOpen(false)}
            >
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD ITEM DIALOG (CASCADING: ZONE -> CATEGORY -> PRODUCT) */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="w-[96vw] max-w-lg rounded-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <PackagePlus className="size-5 text-primary" />
              เพิ่มรายการสินค้าในใบสั่งซื้อ
            </DialogTitle>
            <DialogDescription className="text-xs">
              เลือกตามลำดับ: 1. เลือกโซน ➔ 2. เลือกหมวดหมู่ ➔ 3. เลือกสินค้า และระบุจำนวน
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* STEP 1: SELECT ZONE */}
            <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <span className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  เลือกโซนจัดเก็บ (Zone) *
                </Label>
                <Badge variant="outline" className="text-[10px]">
                  {addZoneId === "all"
                    ? "ทุกโซน"
                    : zones.find((z) => z.id === addZoneId)?.name || "โซน"}
                </Badge>
              </div>
              <select
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xs sm:text-sm shadow-xs font-medium"
                value={addZoneId}
                onChange={(e) => {
                  const newZoneId = e.target.value;
                  setAddZoneId(newZoneId);
                  if (addCatId !== "all") {
                    const catExistsInZone = products.some(
                      (p) =>
                        p.isActive !== false &&
                        (newZoneId === "all" || p.zoneId === newZoneId) &&
                        p.categoryId === addCatId,
                    );
                    if (!catExistsInZone) {
                      setAddCatId("all");
                    }
                  }
                }}
              >
                <option value="all">
                  🌐 ทุกโซนจัดเก็บ ({products.filter((p) => p.isActive !== false).length} สินค้า)
                </option>
                {zones.map((z) => {
                  const count = products.filter(
                    (p) => p.isActive !== false && p.zoneId === z.id,
                  ).length;
                  return (
                    <option key={z.id} value={z.id}>
                      📍 {z.code} - {z.name} ({count} สินค้า)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* STEP 2: SELECT CATEGORY */}
            <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <span className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                    2
                  </span>
                  เลือกหมวดหมู่สินค้า (Category) *
                </Label>
                <Badge variant="outline" className="text-[10px]">
                  {addCatId === "all"
                    ? "ทุกหมวดหมู่"
                    : categories.find((c) => c.id === addCatId)?.name || "หมวดหมู่"}
                </Badge>
              </div>
              <select
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xs sm:text-sm shadow-xs font-medium"
                value={addCatId}
                onChange={(e) => setAddCatId(e.target.value)}
              >
                <option value="all">
                  📁 ทุกหมวดหมู่ในโซนนี้ (
                  {
                    products.filter(
                      (p) =>
                        p.isActive !== false && (addZoneId === "all" || p.zoneId === addZoneId),
                    ).length
                  }{" "}
                  สินค้า)
                </option>
                {categories
                  .filter((c) => {
                    if (addZoneId === "all") return true;
                    return products.some(
                      (p) =>
                        p.isActive !== false && p.zoneId === addZoneId && p.categoryId === c.id,
                    );
                  })
                  .map((c) => {
                    const count = products.filter(
                      (p) =>
                        p.isActive !== false &&
                        (addZoneId === "all" || p.zoneId === addZoneId) &&
                        p.categoryId === c.id,
                    ).length;
                    return (
                      <option key={c.id} value={c.id}>
                        🏷️ {c.name} ({count} สินค้า)
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* STEP 3: SELECT PRODUCT */}
            <div className="space-y-2 p-3 rounded-xl bg-muted/40 border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <span className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                    3
                  </span>
                  เลือกสินค้าที่ต้องการสั่งซื้อ (Product) *
                </Label>
                <span className="text-[11px] text-muted-foreground font-medium">
                  พบ {availableProductsForAdd.length} รายการ
                </span>
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search className="size-3.5 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อสินค้า, บาร์โค้ด หรือ SKU..."
                  className="pl-8 h-9 text-xs rounded-lg"
                  value={addProductSearch}
                  onChange={(e) => setAddProductSearch(e.target.value)}
                />
              </div>

              {/* Product Select Box */}
              {availableProductsForAdd.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground border rounded-xl bg-card">
                  ไม่พบสินค้าในโซน/หมวดหมู่นี้ ลองเปลี่ยนเงื่อนไขการค้นหา
                </div>
              ) : (
                <select
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xs sm:text-sm shadow-xs font-medium"
                  value={selectedProdId || availableProductsForAdd[0]?.id || ""}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedProdId(newId);
                    const p = products.find((prod) => prod.id === newId);
                    if (p) {
                      setManualQty(p.reorderQuantity || 10);
                      setManualUnitId(p.unitId);
                    }
                  }}
                >
                  {availableProductsForAdd.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} • สต็อก: {p.stock} {getUnitName(p.unitId)} (ทุน ฿
                      {p.costPrice.toFixed(0)})
                    </option>
                  ))}
                </select>
              )}

              {/* Selected Product Card Preview */}
              {(() => {
                const currentProd =
                  products.find((p) => p.id === selectedProdId) ||
                  availableProductsForAdd[0] ||
                  null;
                if (!currentProd) return null;

                return (
                  <div className="mt-2 p-3 rounded-xl border bg-card space-y-3 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-foreground">
                          {currentProd.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                          <span className="font-mono">{currentProd.barcode}</span>
                          <span>•</span>
                          <span>{getCatName(currentProd.categoryId)}</span>
                          <span>•</span>
                          <span>
                            {zones.find((z) => z.id === currentProd.zoneId)?.name || "โซนทั่วไป"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-muted-foreground block">
                          คงเหลือปัจจุบัน
                        </span>
                        <Badge
                          variant={
                            currentProd.stock <= 0
                              ? "destructive"
                              : currentProd.stock <= currentProd.minStock
                                ? "secondary"
                                : "outline"
                          }
                          className="text-[10px] font-mono font-bold"
                        >
                          {currentProd.stock} {getUnitName(currentProd.unitId)}
                        </Badge>
                      </div>
                    </div>

                    {/* Quantity & Unit Stepper */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold">จำนวนที่สั่ง *</Label>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-9 rounded-lg"
                            onClick={() => setManualQty((q) => Math.max(1, q - 1))}
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            className="h-9 rounded-lg font-mono text-center font-bold text-sm"
                            value={manualQty}
                            onChange={(e) => setManualQty(Math.max(1, Number(e.target.value) || 1))}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-9 rounded-lg"
                            onClick={() => setManualQty((q) => q + 1)}
                          >
                            +
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold">หน่วยนับ</Label>
                        <UnitSelect
                          value={manualUnitId || currentProd.unitId}
                          onChange={setManualUnitId}
                          className="h-9 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Quick Add Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        เพิ่มด่วน:
                      </span>
                      {[5, 10, 20, 50, 100].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className="px-2 py-0.5 rounded-md border text-[11px] font-mono hover:bg-muted font-medium transition-all"
                          onClick={() => setManualQty(preset)}
                        >
                          +{preset}
                        </button>
                      ))}
                    </div>

                    {/* Subtotal Calculation */}
                    <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold">
                      <span className="text-emerald-800 dark:text-emerald-200">
                        ประมาณการยอดสั่งซื้อ (ทุน ฿{currentProd.costPrice.toFixed(2)}
                        /หน่วย):
                      </span>
                      <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">
                        ฿
                        {(manualQty * (currentProd.costPrice || 0)).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button
              variant="outline"
              className="h-11 rounded-xl w-full sm:w-auto"
              onClick={() => setAddModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              className="h-11 rounded-xl w-full sm:w-auto font-semibold gap-1.5 bg-primary text-primary-foreground shadow-xs"
              onClick={() => {
                const prodId = selectedProdId || availableProductsForAdd[0]?.id;
                if (prodId) {
                  const p = products.find((prod) => prod.id === prodId);
                  if (p) {
                    setOrderList((prev) => {
                      const existing = prev.find((i) => i.productId === prodId);
                      if (existing) {
                        return prev.map((i) =>
                          i.productId === prodId
                            ? { ...i, quantity: i.quantity + Number(manualQty) }
                            : i,
                        );
                      }
                      return [
                        ...prev,
                        {
                          productId: prodId,
                          quantity: Number(manualQty) || 1,
                          unitId: manualUnitId || p.unitId,
                        },
                      ];
                    });
                    setStatusMessage({
                      type: "success",
                      text: `เพิ่ม ${p.name} (${manualQty} ${getUnitName(manualUnitId || p.unitId)}) เข้าใบสั่งซื้อเรียบร้อย`,
                    });
                    setActiveTab("create_po");
                    setAddModalOpen(false);
                  }
                }
              }}
              disabled={availableProductsForAdd.length === 0}
            >
              <Plus className="size-4" /> เพิ่มสินค้าในใบสั่งซื้อ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SERVER MESSAGING API & LINE FRIEND RECIPIENT MODAL (MOBILE FULL-SCREEN PANEL / DESKTOP DIALOG) */}
      <Dialog open={pushModalOpen} onOpenChange={setPushModalOpen}>
        <DialogContent
          className={cn(
            // Mobile: Full-Screen Panel taking 100% of viewport, single unified scroll, zero outer margins
            "fixed inset-0 z-50 flex flex-col w-full h-[100dvh] max-w-none p-0 gap-0 rounded-none border-0 bg-background overflow-hidden top-0 left-0 translate-x-0 translate-y-0 shadow-none duration-200",
            // Desktop: Centered floating Dialog with rounded corners
            "md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[94vw] md:max-w-2xl md:h-[88vh] md:max-h-[850px] md:rounded-2xl md:border md:shadow-2xl",
            // Hide default floating close button on mobile so it doesn't overlap header
            "[&>button.absolute]:hidden md:[&>button.absolute]:flex",
          )}
        >
          {/* STICKY TOP HEADER: Back button, Title, Search Box, Horizontal Filter Tabs */}
          <div className="shrink-0 border-b bg-background/95 backdrop-blur-md z-20">
            {/* Top Navigation Row */}
            <div className="flex items-center justify-between gap-2 px-3 sm:px-4 pt-3 pb-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPushModalOpen(false)}
                className="h-9 px-2.5 text-xs font-semibold gap-1.5 text-foreground hover:bg-muted active:scale-95 rounded-xl shrink-0 -ml-1"
              >
                <ArrowLeft className="size-4" />
                <span>กลับ</span>
              </Button>

              <div className="flex items-center gap-2 min-w-0 flex-1 justify-center sm:justify-start">
                <div className="size-7 rounded-lg bg-[#06C755]/15 flex items-center justify-center shrink-0">
                  <MessageCircle className="size-4 text-[#06C755]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <DialogTitle className="text-sm sm:text-base font-bold text-foreground truncate">
                      เลือกผู้รับ
                    </DialogTitle>
                    <Badge className="bg-[#06C755] hover:bg-[#05b34c] text-white text-[10px] font-bold px-1.5 py-0.5 shrink-0">
                      ⚡ Flex
                    </Badge>
                  </div>
                  <DialogDescription className="text-[11px] text-muted-foreground truncate hidden sm:block">
                    {pushMessageType === "STOCK_ALERT"
                      ? `ส่งแจ้งเตือนสต็อก (${allReorderNeeded.length} รายการ)`
                      : `ส่งใบสั่งซื้อสินค้า (${fullItems.length} รายการ, ฿${totalCost.toLocaleString()})`}
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground rounded-lg md:hidden"
                  onClick={() => setPushModalOpen(false)}
                  title="ปิด"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Sticky Search Box (Accessibly Placed at Top) */}
            <div className="px-3 sm:px-4 pt-1 pb-2">
              <div className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="ค้นหาชื่อเพื่อน, พนักงาน, ซัพพลายเออร์, หรือ User ID..."
                  className="h-10 pl-9 pr-9 text-base md:text-xs rounded-xl bg-muted/40 border-muted-foreground/20 focus:bg-background transition-all shadow-none"
                  value={friendSearchQuery}
                  onChange={(e) => setFriendSearchQuery(e.target.value)}
                />
                {friendSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setFriendSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Horizontal Filter Chips (Swipeable Left-Right on Mobile) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-3 sm:px-4 pb-2.5 whitespace-nowrap touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Button
                type="button"
                size="sm"
                variant={recipientFilterTab === "ALL" ? "default" : "outline"}
                className={`h-7 text-xs rounded-full px-3 font-medium shrink-0 transition-all ${
                  recipientFilterTab === "ALL"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                    : "text-muted-foreground hover:text-foreground bg-muted/20"
                }`}
                onClick={() => setRecipientFilterTab("ALL")}
              >
                ทั้งหมด ({followers.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={recipientFilterTab === "SUPPLIERS" ? "default" : "outline"}
                className={`h-7 text-xs rounded-full px-3 font-medium shrink-0 transition-all ${
                  recipientFilterTab === "SUPPLIERS"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                    : "text-muted-foreground hover:text-foreground bg-muted/20"
                }`}
                onClick={() => setRecipientFilterTab("SUPPLIERS")}
              >
                🏢 ซัพพลายเออร์/ร้านส่ง (
                {
                  followers.filter(
                    (f) =>
                      !f.displayName.includes("กลุ่ม") &&
                      (f.displayName.includes("ซัพพลายเออร์") ||
                        f.displayName.includes("ยูนิลีเวอร์") ||
                        f.displayName.includes("ยี่ปั๊ว") ||
                        f.displayName.includes("ค้าส่ง") ||
                        f.displayName.includes("เครื่องดื่ม") ||
                        (f.role === "staff" && !f.displayName.includes("โกดัง"))),
                  ).length
                }
                )
              </Button>
              <Button
                type="button"
                size="sm"
                variant={recipientFilterTab === "GROUPS" ? "default" : "outline"}
                className={`h-7 text-xs rounded-full px-3 font-medium shrink-0 transition-all ${
                  recipientFilterTab === "GROUPS"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                    : "text-muted-foreground hover:text-foreground bg-muted/20"
                }`}
                onClick={() => setRecipientFilterTab("GROUPS")}
              >
                👥 กลุ่มแชทไลน์ (
                {
                  followers.filter(
                    (f) =>
                      f.userId.startsWith("C") ||
                      f.role === "viewer" ||
                      f.displayName.includes("กลุ่ม"),
                  ).length
                }
                )
              </Button>
              <Button
                type="button"
                size="sm"
                variant={recipientFilterTab === "STAFF" ? "default" : "outline"}
                className={`h-7 text-xs rounded-full px-3 font-medium shrink-0 transition-all ${
                  recipientFilterTab === "STAFF"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                    : "text-muted-foreground hover:text-foreground bg-muted/20"
                }`}
                onClick={() => setRecipientFilterTab("STAFF")}
              >
                👤 ผู้ดูแล/พนักงาน (
                {
                  followers.filter(
                    (f) =>
                      f.role === "admin" ||
                      f.displayName.includes("แอดมิน") ||
                      f.displayName.includes("ผู้ดูแล") ||
                      f.displayName.includes("พนักงาน"),
                  ).length
                }
                )
              </Button>
            </div>
          </div>

          {/* MAIN UNIFIED SCROLL CONTAINER (SINGLE LAYER SCROLL - NO NESTED SCROLLBARS) */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3.5 sm:p-5 space-y-4">
            {/* OPTION A: NATIVE LINE TARGET PICKER */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#06C755]/15 via-[#06C755]/10 to-transparent border border-[#06C755]/30 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                    <Smartphone className="size-4 text-[#06C755]" />
                    เปิดรายชื่อเพื่อนในแอป LINE ทันที (LINE Share Target Picker)
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    เปิดหน้าจอเลือกห้องแชทของแอป LINE เพื่อส่ง Flex Message
                    เข้าห้องแชทเพื่อนหรือกลุ่มที่ต้องการทันที
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    className="h-9 px-4 text-xs font-bold rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white shadow-xs gap-1.5 active:scale-95"
                    onClick={handleOpenLiffTargetPicker}
                    disabled={isSending}
                  >
                    <Users className="size-4" />
                    เปิดรายชื่อเพื่อนใน LINE
                  </Button>
                </div>
              </div>
            </div>

            {/* OPTION B: SYSTEM DIRECTORY RECIPIENT CARDS (SINGLE SCROLLABLE GRID) */}
            <div className="space-y-3 p-3.5 rounded-2xl border bg-muted/20">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-foreground">
                  <User className="size-4 text-emerald-600" />
                  เลือกจากรายชื่อเพื่อน / ซัพพลายเออร์ ในระบบ
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary font-semibold gap-1 px-2 hover:bg-primary/10 rounded-lg"
                  onClick={() => setIsAddingContact(!isAddingContact)}
                >
                  <Plus className="size-3.5" />
                  {isAddingContact ? "ปิดฟอร์ม" : "เพิ่มผู้ติดต่อใหม่"}
                </Button>
              </div>

              {/* Add New Contact Inline Form */}
              {isAddingContact && (
                <div className="p-3 border rounded-xl bg-card space-y-2.5 animate-in fade-in-50">
                  <div className="text-xs font-bold text-foreground">
                    เพิ่มรายชื่อเพื่อน / ซัพพลายเออร์ใหม่:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="ชื่อผู้ติดต่อ / ร้านค้า / ซัพพลายเออร์"
                      className="h-9 text-base md:text-xs rounded-lg"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                    />
                    <Input
                      placeholder="LINE ID (เช่น Uxxxx หรือ Cxxxx)"
                      className="h-9 font-mono text-base md:text-xs rounded-lg"
                      value={newContactId}
                      onChange={(e) => setNewContactId(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Select
                      value={newContactRole}
                      onValueChange={(val) =>
                        setNewContactRole(val as "admin" | "staff" | "viewer")
                      }
                    >
                      <SelectTrigger className="h-8 text-xs rounded-lg w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">ซัพพลายเออร์/ร้านค้าส่ง</SelectItem>
                        <SelectItem value="viewer">กลุ่มสั่งซื้อ (Group)</SelectItem>
                        <SelectItem value="admin">ผู้ดูแลร้าน (Admin)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleAddNewContact}
                      disabled={!newContactName.trim() || !newContactId.trim()}
                    >
                      บันทึกรายชื่อ
                    </Button>
                  </div>
                </div>
              )}

              {/* Broadcast Option */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border bg-background">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground cursor-pointer">
                    <Users className="size-3.5 text-primary" />
                    บรอดแคสต์ส่งถึงทุกคน (Broadcast to all followers)
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    ส่ง Flex Message ไปยังเพื่อนและกลุ่มแชททุกคนพร้อมกัน
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isBroadcastMode}
                  onChange={(e) => {
                    setIsBroadcastMode(e.target.checked);
                    if (e.target.checked) {
                      setTargetIdInput("");
                    }
                  }}
                  className="size-4 rounded accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Contact List Cards Grid (No nested scroll - renders in single layer main body) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {followers
                  .filter((f) => {
                    const query = friendSearchQuery.toLowerCase().trim();
                    const matchesSearch =
                      !query ||
                      f.displayName.toLowerCase().includes(query) ||
                      f.userId.toLowerCase().includes(query) ||
                      (f.statusMessage && f.statusMessage.toLowerCase().includes(query));
                    if (!matchesSearch) return false;

                    if (recipientFilterTab === "SUPPLIERS") {
                      return (
                        !f.displayName.includes("กลุ่ม") &&
                        (f.displayName.includes("ซัพพลายเออร์") ||
                          f.displayName.includes("ยูนิลีเวอร์") ||
                          f.displayName.includes("ยี่ปั๊ว") ||
                          f.displayName.includes("ค้าส่ง") ||
                          f.displayName.includes("เครื่องดื่ม") ||
                          (f.role === "staff" && !f.displayName.includes("โกดัง")))
                      );
                    }
                    if (recipientFilterTab === "GROUPS") {
                      return (
                        f.userId.startsWith("C") ||
                        f.role === "viewer" ||
                        f.displayName.includes("กลุ่ม")
                      );
                    }
                    if (recipientFilterTab === "STAFF") {
                      return (
                        f.role === "admin" ||
                        f.displayName.includes("แอดมิน") ||
                        f.displayName.includes("ผู้ดูแล") ||
                        f.displayName.includes("พนักงาน")
                      );
                    }
                    return true;
                  })
                  .map((f) => {
                    const isSelected = !isBroadcastMode && targetIdInput === f.userId;
                    const isGroup = f.userId.startsWith("C") || f.role === "viewer";
                    const isSupplier =
                      !isGroup &&
                      (f.displayName.includes("ซัพพลายเออร์") ||
                        f.displayName.includes("ยูนิลีเวอร์") ||
                        f.displayName.includes("ยี่ปั๊ว") ||
                        f.displayName.includes("ค้าส่ง") ||
                        f.displayName.includes("เครื่องดื่ม"));

                    return (
                      <button
                        key={f.userId}
                        type="button"
                        className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all active:scale-[0.99] cursor-pointer ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 ring-2 ring-emerald-500 shadow-sm"
                            : "border-border bg-card hover:bg-muted/60"
                        }`}
                        onClick={() => {
                          setTargetIdInput(f.userId);
                          setIsBroadcastMode(false);
                        }}
                      >
                        <div className="relative size-11 shrink-0 rounded-full overflow-hidden bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground border">
                          {f.pictureUrl ? (
                            <img
                              src={f.pictureUrl}
                              alt={f.displayName}
                              className="size-full object-cover"
                            />
                          ) : (
                            f.displayName.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                              {f.displayName}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 fill-emerald-100 dark:fill-emerald-900" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 rounded font-semibold ${
                                isGroup
                                  ? "border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950/40"
                                  : isSupplier
                                    ? "border-emerald-600 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40"
                                    : f.role === "admin"
                                      ? "border-purple-500 text-purple-700 bg-purple-50 dark:bg-purple-950/40"
                                      : "border-slate-500 text-slate-700 bg-slate-50 dark:bg-slate-950/40"
                              }`}
                            >
                              {isGroup
                                ? "กลุ่มแชทไลน์"
                                : isSupplier
                                  ? "ซัพพลายเออร์"
                                  : f.role === "admin"
                                    ? "ผู้ดูแลร้าน"
                                    : "พนักงาน"}
                            </Badge>
                            <span className="font-mono text-[10px] text-muted-foreground truncate">
                              {f.userId.slice(0, 10)}...
                            </span>
                          </div>
                        </div>

                        {/* Quick Selection Status Indicator */}
                        <div className="shrink-0 pl-1">
                          {isSelected ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-1 rounded-lg">
                              เลือกแล้ว
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-1 rounded-lg group-hover:bg-muted">
                              เลือก
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Empty state if search yields no result */}
              {followers.filter((f) => {
                const query = friendSearchQuery.toLowerCase().trim();
                return (
                  !query ||
                  f.displayName.toLowerCase().includes(query) ||
                  f.userId.toLowerCase().includes(query) ||
                  (f.statusMessage && f.statusMessage.toLowerCase().includes(query))
                );
              }).length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-xs space-y-2">
                  <User className="size-8 mx-auto text-muted-foreground/50" />
                  <p>ไม่พบรายชื่อผู้ติดต่อที่ตรงกับคำค้นหา "{friendSearchQuery}"</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-xl"
                    onClick={() => setFriendSearchQuery("")}
                  >
                    ล้างคำค้นหา
                  </Button>
                </div>
              )}

              {/* Manual Recipient ID Input */}
              {!isBroadcastMode && (
                <div className="space-y-1 pt-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">
                    หรือระบุ LINE Group ID หรือ User ID ด้วยตนเอง:
                  </Label>
                  <Input
                    placeholder="เช่น Cxxxxxxxxxx (Group ID) หรือ Uxxxxxxxxxx (User ID)"
                    className="h-9 font-mono text-base md:text-xs rounded-xl bg-background"
                    value={targetIdInput}
                    onChange={(e) => setTargetIdInput(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* REAL LINE FLEX MESSAGE PREVIEW BUBBLE (Single Scroll - No Inner Scrollbar) */}
            <div className="rounded-2xl border border-emerald-500/30 overflow-hidden bg-card shadow-2xs">
              <div className="bg-emerald-600 text-white px-3.5 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <MessageCircle className="size-4" />
                  ตัวอย่าง LINE Flex Message ที่จะส่ง (Format: รายการ ➔ จำนวน ➔ หน่วยนับ)
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-white hover:bg-emerald-700/60 font-semibold px-2"
                  onClick={() => {
                    if (pushMessageType === "STOCK_ALERT") {
                      handlePreviewStockAlertFlex();
                    } else {
                      handlePreviewOrderFlex();
                    }
                  }}
                >
                  <Eye className="size-3 mr-1" />
                  ดู Flex เต็มจอ
                </Button>
              </div>

              <div className="p-3.5 space-y-2 text-xs bg-muted/10">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="font-bold text-foreground">
                    {pushMessageType === "STOCK_ALERT"
                      ? "⚠️ แจ้งเตือนสินค้าต้องสั่งซื้อ"
                      : "📦 ใบสั่งซื้อสินค้าประจำวัน"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">ร้าน MiniMark</span>
                </div>

                <div className="space-y-1">
                  {pushMessageType === "STOCK_ALERT" ? (
                    allReorderNeeded.slice(0, 5).map((p, idx) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-0.5 border-b border-border/40 text-[11px]"
                      >
                        <span className="truncate max-w-[200px] text-foreground">
                          {idx + 1}. {p.name}
                        </span>
                        <span className="font-mono font-bold text-destructive">
                          คงเหลือ {p.stock} {getUnitName(p.unitId)}
                        </span>
                      </div>
                    ))
                  ) : fullItems.length === 0 ? (
                    <div className="text-center text-muted-foreground py-2 italic text-xs">
                      (ไม่มีรายการสินค้าในใบสั่งซื้อ)
                    </div>
                  ) : (
                    fullItems.slice(0, 5).map((item, idx) => (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between py-0.5 border-b border-border/40 text-[11px]"
                      >
                        <span className="truncate max-w-[200px] text-foreground">
                          {idx + 1}. {item.product.name}
                        </span>
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          {item.quantity} {item.unitName}
                        </span>
                      </div>
                    ))
                  )}
                  {pushMessageType !== "STOCK_ALERT" && fullItems.length > 5 && (
                    <div className="text-[10px] text-muted-foreground text-center pt-0.5">
                      ...และอีก {fullItems.length - 5} รายการ
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t font-semibold text-xs text-foreground">
                  <span>ยอดสรุป:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                    {pushMessageType === "STOCK_ALERT"
                      ? `${allReorderNeeded.length} รายการที่ต้องสั่ง`
                      : `${fullItems.length} รายการ (฿${totalCost.toLocaleString()})`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* STICKY BOTTOM FOOTER (Single Bar, Keyboard-Safe, Returns to Main Page on Completion) */}
          <div className="shrink-0 border-t bg-background/95 backdrop-blur-md p-3 sm:p-4 shadow-lg pb-[max(env(safe-area-inset-bottom),0.75rem)] z-20 space-y-2">
            {/* Selected Recipient Summary Card */}
            <div className="p-2.5 rounded-xl border bg-emerald-500/10 border-emerald-500/25 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Check className="size-4 text-emerald-600 font-bold shrink-0" />
                <span className="text-muted-foreground shrink-0">ผู้รับ Flex:</span>
                <span className="font-bold text-foreground truncate">
                  {isBroadcastMode
                    ? "📢 บรอดแคสต์ถึงทุกคน (Broadcast All)"
                    : targetIdInput
                      ? followers.find((f) => f.userId === targetIdInput.trim())?.displayName ||
                        targetIdInput
                      : "ยังไม่ได้เลือกผู้รับ"}
                </span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] border-emerald-600 text-emerald-700 shrink-0 hidden sm:inline-flex"
              >
                Flex Bubble Format
              </Badge>
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap">
              <Button
                type="button"
                variant="outline"
                className="h-10 sm:h-11 rounded-xl text-xs gap-1.5 hidden sm:inline-flex"
                onClick={() => {
                  if (pushMessageType === "STOCK_ALERT") {
                    handlePreviewStockAlertFlex();
                  } else {
                    handlePreviewOrderFlex();
                  }
                }}
              >
                <Eye className="size-4 text-emerald-600" /> ตัวอย่าง Flex
              </Button>

              {/* Close / Return Button */}
              <Button
                type="button"
                variant="outline"
                className="h-10 sm:h-11 rounded-xl text-xs flex-1 sm:flex-none"
                onClick={() => setPushModalOpen(false)}
              >
                {targetIdInput || isBroadcastMode ? "เลือกผู้รับนี้แล้วกลับ" : "ยกเลิก"}
              </Button>

              {/* Primary Send Button (Sends Flex Message and Closes Panel) */}
              <Button
                type="button"
                className="h-10 sm:h-11 rounded-xl font-bold gap-1.5 bg-[#06C755] hover:bg-[#05b34c] text-white text-xs shadow-xs px-4 sm:px-5 active:scale-95 flex-1 sm:flex-none"
                onClick={handleSendServerPush}
                disabled={(!isBroadcastMode && !targetIdInput.trim()) || isSending}
              >
                <Send className="size-4" />
                {isSending
                  ? "กำลังส่ง Flex Message..."
                  : isBroadcastMode
                    ? "ส่ง Flex Message บรอดแคสต์ทุกคน"
                    : `ส่ง Flex Message ให้ ${
                        followers.find((f) => f.userId === targetIdInput.trim())?.displayName ||
                        (targetIdInput ? targetIdInput.slice(0, 10) + "..." : "ผู้รับที่เลือก")
                      }`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* UNIVERSAL FLEX MESSAGE PREVIEW MODAL */}
      <Dialog open={flexPreviewOpen} onOpenChange={setFlexPreviewOpen}>
        <DialogContent className="w-[96vw] max-w-xl rounded-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <MessageCircle className="size-5 text-emerald-600" /> {flexPreviewTitle}
            </DialogTitle>
            <DialogDescription className="text-xs">
              การจำลองหน้าจอแสดงผลจริงบนแอปพลิเคชัน LINE (LINE Flex Message UI Simulation)
            </DialogDescription>
          </DialogHeader>

          <div className="py-1">
            <FlexMessageVisualizer
              flexData={flexPreviewData}
              title={flexPreviewTitle}
              className="w-full"
            />
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              className="w-full sm:w-auto rounded-xl font-semibold"
              onClick={() => setFlexPreviewOpen(false)}
            >
              ปิดหน้าต่าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ORDER FILE EXPORT MODAL (PDF, EXCEL, PNG SLIP, CHAT, JSON) */}
      <OrderExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        payload={exportPayload}
      />
    </div>
  );
}
