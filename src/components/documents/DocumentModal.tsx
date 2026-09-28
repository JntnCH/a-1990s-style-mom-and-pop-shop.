import {
  Building2,
  Calendar,
  Check,
  CreditCard,
  Percent,
  Plus,
  Receipt,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type DocumentType,
  type DocumentStatus,
  type VatType,
  type PaymentMethod,
  type DocumentItem,
  type SalesDocument,
  type CustomerInfo,
  calculateDocumentTotals,
  salesDocService,
} from "@/lib/sales-document-service";
import { MasterStore } from "@/lib/store";

interface DocumentModalProps {
  initialType?: DocumentType;
  editingDoc?: SalesDocument | null;
  onClose: () => void;
  onSaved: (doc: SalesDocument) => void;
}

export function DocumentModal({
  initialType = "QUOTATION",
  editingDoc,
  onClose,
  onSaved,
}: DocumentModalProps) {
  const [products, setProducts] = useState(() =>
    MasterStore.getProducts().filter((p) => p.isActive),
  );

  useEffect(() => {
    const handleStoreChange = () => {
      setProducts(MasterStore.getProducts().filter((p) => p.isActive));
    };
    window.addEventListener("minimark_store_change", handleStoreChange);
    return () => window.removeEventListener("minimark_store_change", handleStoreChange);
  }, []);

  const [docType, setDocType] = useState<DocumentType>(editingDoc?.type || initialType);
  const [docStatus, setDocStatus] = useState<DocumentStatus>(editingDoc?.status || "PENDING");
  const [issueDate, setIssueDate] = useState<string>(
    editingDoc?.issueDate || new Date().toISOString().slice(0, 10),
  );
  const [creditDays, setCreditDays] = useState<number>(editingDoc?.creditDays || 30);
  const [dueDate, setDueDate] = useState<string>(
    editingDoc?.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );

  // Customer
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: editingDoc?.customer?.name || "",
    taxId: editingDoc?.customer?.taxId || "",
    branchType: editingDoc?.customer?.branchType || "HEAD_OFFICE",
    branchCode: editingDoc?.customer?.branchCode || "00000",
    address: editingDoc?.customer?.address || "",
    phone: editingDoc?.customer?.phone || "",
    email: editingDoc?.customer?.email || "",
    contactPerson: editingDoc?.customer?.contactPerson || "",
  });

  // Items
  const [items, setItems] = useState<DocumentItem[]>(
    editingDoc?.items || [
      {
        id: `item_${Date.now()}`,
        name: "",
        quantity: 1,
        unit: "ชิ้น",
        unitPrice: 0,
        discountAmount: 0,
        total: 0,
      },
    ],
  );

  // Tax & Totals
  const [vatType, setVatType] = useState<VatType>(editingDoc?.calculation?.vatType || "INCLUDED");
  const [vatRate] = useState<number>(7);
  const [withholdingTaxRate, setWithholdingTaxRate] = useState<number>(
    editingDoc?.calculation?.withholdingTaxRate || 0,
  );
  const [overallDiscount, setOverallDiscount] = useState<number>(0);

  // Notes
  const [notes, setNotes] = useState<string>(editingDoc?.notes || "");
  const [terms, setTerms] = useState<string>(
    editingDoc?.termsAndConditions ||
      "1. ราคานี้ยังไม่รวมค่าขนส่ง (หากมียอดไม่ถึงเกณฑ์)\n2. สินค้าตามใบกำกับภาษีนี้ยังเป็นกรรมสิทธิ์ของผู้ขายจนกว่าจะได้รับการชำระเงินครบถ้วน",
  );
  const [salesPerson, setSalesPerson] = useState<string>(
    editingDoc?.salesPerson || "พนักงานขายหน้าร้าน",
  );

  // Payment (if Tax Invoice or Paid)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    editingDoc?.paymentMethod || "BANK_TRANSFER",
  );

  // Auto calculate due date when credit days change
  useEffect(() => {
    if (issueDate) {
      const issue = new Date(issueDate);
      if (!isNaN(issue.getTime())) {
        const due = new Date(issue.getTime() + creditDays * 86400000);
        setDueDate(due.toISOString().slice(0, 10));
      }
    }
  }, [issueDate, creditDays]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: "",
        quantity: 1,
        unit: "ชิ้น",
        unitPrice: 0,
        discountAmount: 0,
        total: 0,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSelectProduct = (itemId: string, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          const qty = it.quantity || 1;
          const price = prod.sellingPrice || 0;
          const disc = it.discountAmount || 0;
          const total = Math.max(0, qty * price - disc);
          return {
            ...it,
            productId: prod.id,
            barcode: prod.barcode,
            name: prod.name,
            unit: prod.unitName || "ชิ้น",
            unitPrice: price,
            total,
          };
        }
        return it;
      }),
    );
  };

  const handleItemChange = (id: string, field: keyof DocumentItem, val: string | number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = { ...it, [field]: val };
          const qty = Math.max(0, Number(updated.quantity) || 0);
          const price = Math.max(0, Number(updated.unitPrice) || 0);
          const disc = Math.max(0, Number(updated.discountAmount) || 0);
          updated.total = Math.max(0, qty * price - disc);
          return updated;
        }
        return it;
      }),
    );
  };

  const calculation = calculateDocumentTotals(
    items.map((it) => ({
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountAmount: it.discountAmount,
    })),
    vatType,
    vatRate,
    withholdingTaxRate,
    overallDiscount,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customer.name.trim()) {
      alert("กรุณากรอกชื่อลูกค้าหรือผู้ซื้อ");
      return;
    }

    const validItems = items.filter((i) => i.name.trim().length > 0);
    if (validItems.length === 0) {
      alert("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    if (editingDoc) {
      const updated = salesDocService.updateDocument(editingDoc.id, {
        type: docType,
        status: docStatus,
        issueDate,
        dueDate,
        creditDays,
        customer,
        items: validItems,
        calculation,
        notes,
        termsAndConditions: terms,
        salesPerson,
        paymentMethod: docStatus === "PAID" ? paymentMethod : undefined,
      });
      if (updated) onSaved(updated);
    } else {
      const created = salesDocService.createDocument({
        type: docType,
        status: docStatus,
        issueDate,
        dueDate,
        creditDays,
        customer,
        items: validItems,
        calculation,
        notes,
        termsAndConditions: terms,
        salesPerson,
        paymentMethod: docStatus === "PAID" ? paymentMethod : undefined,
      });
      onSaved(created);
    }
  };

  const getTypeTitle = () => {
    switch (docType) {
      case "QUOTATION":
        return "ใบเสนอราคา (Quotation)";
      case "BILLING_INVOICE":
        return "ใบแจ้งหนี้ / ใบวางบิล (Billing Note / Invoice)";
      case "TAX_INVOICE_RECEIPT":
        return "ใบเสร็จรับเงิน / ใบกำกับภาษี (Receipt / Tax Invoice)";
      case "CREDIT_NOTE":
        return "ใบลดหนี้ (Credit Note)";
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex justify-center items-start p-2 sm:p-6">
      <div className="w-full max-w-4xl bg-background border border-border shadow-2xl rounded-2xl overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Receipt className="size-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {editingDoc ? `แก้ไขเอกสาร ${editingDoc.docNumber}` : `สร้าง${getTypeTitle()}`}
              </h2>
              <p className="text-xs text-muted-foreground">
                มาตรฐานเอกสารกรมสรรพากร & FlowAccount พร้อมคำนวณภาษี VAT 7%
              </p>
            </div>
          </div>
          <Button size="icon" variant="ghost" className="rounded-full size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Scrollable Form Content */}
        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto p-6 space-y-6 flex-1 text-xs sm:text-sm"
        >
          {/* Top Config Row: Document Type & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-muted/20 p-4 rounded-xl border border-border">
            <div className="space-y-1.5">
              <Label className="text-xs">ประเภทเอกสาร</Label>
              <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="QUOTATION">ใบเสนอราคา (QT)</SelectItem>
                  <SelectItem value="BILLING_INVOICE">ใบแจ้งหนี้ / ใบวางบิล (INV)</SelectItem>
                  <SelectItem value="TAX_INVOICE_RECEIPT">
                    ใบเสร็จรับเงิน / ใบกำกับภาษี (TAX)
                  </SelectItem>
                  <SelectItem value="CREDIT_NOTE">ใบลดหนี้ (CN)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">สถานะเอกสาร</Label>
              <Select value={docStatus} onValueChange={(v) => setDocStatus(v as DocumentStatus)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">ร่าง (Draft)</SelectItem>
                  <SelectItem value="PENDING">รอส่ง / รอชำระ (Pending)</SelectItem>
                  <SelectItem value="APPROVED">อนุมัติแล้ว (Approved)</SelectItem>
                  <SelectItem value="PAID">ชำระเงินแล้ว (Paid)</SelectItem>
                  <SelectItem value="CANCELLED">ยกเลิก (Cancelled)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">วันที่ออกเอกสาร</Label>
              <Input
                type="date"
                className="h-9"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">เครดิต (วัน) / ครบกำหนด</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  className="h-9 w-20"
                  min="0"
                  value={creditDays}
                  onChange={(e) => setCreditDays(Number(e.target.value) || 0)}
                  placeholder="30"
                />
                <Input
                  type="date"
                  className="h-9 flex-1"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Customer Profile Section */}
          <div className="border border-border rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <Building2 className="size-4 text-primary" /> ข้อมูลลูกค้า / ผู้ซื้อ
              </div>
              <Badge variant="outline" className="text-[10px]">
                {customer.branchType === "HEAD_OFFICE"
                  ? "สำนักงานใหญ่"
                  : `สาขา ${customer.branchCode}`}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">ชื่อบริษัท / ลูกค้า *</Label>
                <Input
                  required
                  placeholder="เช่น บริษัท สยาม ซินเนอร์จี้ จำกัด"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">เลขประจำตัวผู้เสียภาษี (13 หลัก)</Label>
                <Input
                  placeholder="เช่น 0105559088776"
                  maxLength={13}
                  value={customer.taxId}
                  onChange={(e) => setCustomer({ ...customer, taxId: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">ที่อยู่สำหรับออกเอกสาร</Label>
                <Input
                  placeholder="ที่อยู่ เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                  value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">สาขา</Label>
                <div className="flex gap-2">
                  <Select
                    value={customer.branchType}
                    onValueChange={(v) =>
                      setCustomer({
                        ...customer,
                        branchType: v as "HEAD_OFFICE" | "BRANCH",
                        branchCode: v === "HEAD_OFFICE" ? "00000" : customer.branchCode || "00001",
                      })
                    }
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HEAD_OFFICE">สำนักงานใหญ่</SelectItem>
                      <SelectItem value="BRANCH">สาขา</SelectItem>
                    </SelectContent>
                  </Select>
                  {customer.branchType === "BRANCH" && (
                    <Input
                      placeholder="รหัสสาขา 00001"
                      className="flex-1"
                      value={customer.branchCode}
                      onChange={(e) => setCustomer({ ...customer, branchCode: e.target.value })}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">เบอร์โทรศัพท์ / ผู้ติดต่อ</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="เบอร์โทร"
                    className="flex-1"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  />
                  <Input
                    placeholder="ชื่อผู้ติดต่อ"
                    className="flex-1"
                    value={customer.contactPerson}
                    onChange={(e) => setCustomer({ ...customer, contactPerson: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-bold text-foreground text-sm">
                รายการสินค้า / บริการ ({items.length} รายการ)
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1 h-8 text-xs font-semibold"
                onClick={handleAddItem}
              >
                <Plus className="size-3.5" /> เพิ่มรายการ
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 bg-muted/20 border border-border/80 rounded-xl grid grid-cols-12 gap-2 items-center"
                >
                  <div className="col-span-1 text-center font-bold text-muted-foreground text-xs">
                    {idx + 1}
                  </div>

                  {/* Product Selector / Name */}
                  <div className="col-span-11 sm:col-span-4 space-y-1">
                    <div className="flex gap-1.5">
                      <Input
                        required
                        placeholder="ชื่อสินค้า / รายการ *"
                        value={item.name}
                        onChange={(e) => handleItemChange(item.id, "name", e.target.value)}
                        className="h-8 text-xs font-medium"
                      />
                    </div>
                    {/* Quick Inventory Dropdown */}
                    <select
                      className="w-full text-[10px] bg-background border border-input rounded px-1.5 py-0.5 text-muted-foreground"
                      onChange={(e) => {
                        if (e.target.value) handleSelectProduct(item.id, e.target.value);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        ⚡ เลือกจากคลังสินค้า ({products.length} ชิ้น)...
                      </option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (สต็อก: {p.currentStock} {p.unitName} | ฿{p.sellingPrice})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-3 sm:col-span-2">
                    <Label className="text-[10px] sm:hidden">จำนวน</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      className="h-8 text-xs text-center"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(item.id, "quantity", Number(e.target.value))
                      }
                      placeholder="จำนวน"
                    />
                  </div>

                  {/* Unit */}
                  <div className="col-span-3 sm:col-span-1">
                    <Label className="text-[10px] sm:hidden">หน่วย</Label>
                    <Input
                      className="h-8 text-xs text-center"
                      value={item.unit}
                      onChange={(e) => handleItemChange(item.id, "unit", e.target.value)}
                      placeholder="หน่วย"
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="col-span-3 sm:col-span-2">
                    <Label className="text-[10px] sm:hidden">ราคา/หน่วย</Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      className="h-8 text-xs text-right font-mono"
                      value={item.unitPrice}
                      onChange={(e) =>
                        handleItemChange(item.id, "unitPrice", Number(e.target.value))
                      }
                      placeholder="ราคา"
                    />
                  </div>

                  {/* Line Total & Remove */}
                  <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2 text-right">
                    <div>
                      <span className="text-[10px] text-muted-foreground block sm:hidden">รวม</span>
                      <strong className="font-mono text-xs text-primary">
                        ฿{item.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tax, VAT & Summary Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 bg-muted/30 p-5 rounded-2xl border border-border">
            {/* Left: VAT & WHT Settings */}
            <div className="sm:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">การคิดภาษีมูลค่าเพิ่ม (VAT 7%)</Label>
                  <Select value={vatType} onValueChange={(v) => setVatType(v as VatType)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INCLUDED">รวมในราคา (VAT Included 7%)</SelectItem>
                      <SelectItem value="EXCLUDED">แยกนอกราคา (VAT Excluded +7%)</SelectItem>
                      <SelectItem value="EXEMPT">ไม่มีภาษี / ได้รับยกเว้น (VAT Exempt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    หักภาษี ณ ที่จ่าย (Withholding Tax)
                  </Label>
                  <Select
                    value={String(withholdingTaxRate)}
                    onValueChange={(v) => setWithholdingTaxRate(Number(v))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">ไม่หัก ณ ที่จ่าย (0%)</SelectItem>
                      <SelectItem value="1">หัก 1% (ค่าขนส่ง)</SelectItem>
                      <SelectItem value="2">หัก 2% (ค่าโฆษณา)</SelectItem>
                      <SelectItem value="3">หัก 3% (บริการ / จ้างทำของ)</SelectItem>
                      <SelectItem value="5">หัก 5% (ค่าเช่า)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Thai Baht text preview */}
              <div className="bg-background border border-border rounded-xl p-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-0.5">
                  จำนวนเงินตัวอักษร (Thai Baht Text)
                </span>
                <p className="font-bold text-primary text-xs sm:text-sm">
                  {calculation.thaiBahtText}
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs">หมายเหตุท้ายเอกสาร</Label>
                <Input
                  placeholder="เช่น ได้รับสินค้าถูกต้องเรียบร้อยแล้ว หรือ โอนผ่านธนาคารกสิกรไทย"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Right: Totals Box */}
            <div className="sm:col-span-5 bg-background border border-border rounded-xl p-4 text-xs space-y-2">
              <div className="flex justify-between text-muted-foreground">
                <span>ยอดรวมสินค้า (Subtotal):</span>
                <span className="font-mono font-medium text-foreground">
                  ฿{calculation.subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>ภาษีมูลค่าเพิ่ม (VAT {calculation.vatRate}%):</span>
                <span className="font-mono font-medium text-foreground">
                  ฿{calculation.vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between font-bold text-sm border-t border-border pt-2 text-foreground">
                <span>ยอดรวมทั้งสิ้น (Grand Total):</span>
                <span className="font-mono text-primary">
                  ฿{calculation.grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {calculation.withholdingTaxAmount > 0 && (
                <div className="flex justify-between text-rose-600 border-t border-dashed border-border pt-1.5">
                  <span>หัก ณ ที่จ่าย ({calculation.withholdingTaxRate}%):</span>
                  <span className="font-mono">
                    -฿
                    {calculation.withholdingTaxAmount.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}

              {calculation.withholdingTaxAmount > 0 && (
                <div className="flex justify-between font-extrabold text-sm bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                  <span>ยอดชำระสุทธิ:</span>
                  <span className="font-mono">
                    ฿
                    {calculation.netPaymentAmount.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl px-4">
              ยกเลิก
            </Button>
            <Button type="submit" className="rounded-xl px-6 gap-2 font-semibold shadow-md">
              <Check className="size-4" />
              {editingDoc ? "บันทึกการแก้ไข" : "บันทึกเอกสาร"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
