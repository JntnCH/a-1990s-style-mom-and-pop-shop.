import {
  AlertCircle,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  FileCode2,
  Layers,
  MessageCircle,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FlexMessageVisualizer } from "@/components/line/FlexMessageVisualizer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  createDailySummaryFlexBubble,
  createMiniAppPortalFlexBubble,
  createPurchaseOrderFlexBubble,
  createStockAlertFlexBubble,
} from "@/lib/flex-templates";
import { shareFlexViaLiffPicker } from "@/lib/line-service";

interface FlexSimulatorImporterProps {
  onSaved?: () => void;
}

const STORAGE_KEY = "minimark_custom_po_flex_json";

export function FlexSimulatorImporter({ onSaved }: FlexSimulatorImporterProps) {
  const defaultPOFlex = createPurchaseOrderFlexBubble([
    {
      name: "ปลาร้า แม่เหรียญ ฝาขาว 380 มล.",
      quantity: 1,
      unitName: "แพ็ค",
      costPrice: 180,
    },
    {
      name: "ครีมเภสัช 45 ก.",
      quantity: 15,
      unitName: "ขวด",
      costPrice: 25,
    },
  ]);

  const [rawJson, setRawJson] = useState<string>("");
  const [parsedFlex, setParsedFlex] = useState<unknown>(defaultPOFlex);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isCustomSaved, setIsCustomSaved] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.trim()) {
        try {
          const obj = JSON.parse(saved);
          setRawJson(JSON.stringify(obj, null, 2));
          setParsedFlex(obj);
          setIsCustomSaved(true);
        } catch {
          setRawJson(JSON.stringify(defaultPOFlex, null, 2));
        }
      } else {
        setRawJson(JSON.stringify(defaultPOFlex, null, 2));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJsonChange = (val: string) => {
    setRawJson(val);
    if (!val.trim()) {
      setParseError("กรุณาวาง JSON จาก LINE Flex Simulator");
      return;
    }

    try {
      let parsed = JSON.parse(val);
      // Auto-wrap bubble/carousel into flex message envelope if needed
      if (parsed.type === "bubble" || parsed.type === "carousel") {
        parsed = {
          type: "flex",
          altText: "📦 ใบสั่งซื้อสินค้า — ร้าน MiniMark",
          contents: parsed,
        };
      }
      setParsedFlex(parsed);
      setParseError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setParseError(`รูปแบบ JSON ไม่ถูกต้อง: ${msg}`);
    }
  };

  const handleFormatJson = () => {
    try {
      const obj = JSON.parse(rawJson);
      setRawJson(JSON.stringify(obj, null, 2));
      toast.success("จัดรูปแบบ JSON เรียบร้อย");
    } catch {
      toast.error("ไม่สามารถจัดรูปแบบได้เนื่องจาก JSON มีข้อผิดพลาด");
    }
  };

  const handleSaveActiveTemplate = () => {
    if (parseError || !parsedFlex) {
      toast.error("กรุณาแก้ไขข้อผิดพลาดของ JSON ก่อนบันทึก");
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedFlex, null, 2));
      setIsCustomSaved(true);
      toast.success("บันทึกแม่แบบ Flex Message กำหนดเองเรียบร้อยแล้ว!");
      window.dispatchEvent(new CustomEvent("minimark_store_change"));
      if (onSaved) onSaved();
    } catch (e) {
      toast.error(`เกิดข้อผิดพลาดในการบันทึก: ${String(e)}`);
    }
  };

  const handleResetToDefault = () => {
    if (confirm("ต้องการคืนค่าเป็นแม่แบบมาตรฐานของระบบใช่หรือไม่?")) {
      localStorage.removeItem(STORAGE_KEY);
      setIsCustomSaved(false);
      setRawJson(JSON.stringify(defaultPOFlex, null, 2));
      setParsedFlex(defaultPOFlex);
      setParseError(null);
      toast.success("คืนค่าแม่แบบมาตรฐานเรียบร้อยแล้ว");
      window.dispatchEvent(new CustomEvent("minimark_store_change"));
      if (onSaved) onSaved();
    }
  };

  const handleCopyJson = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(rawJson);
      setCopied(true);
      toast.success("คัดลอก JSON สำเร็จ");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLoadPreset = (presetName: string) => {
    let presetObj: unknown;
    switch (presetName) {
      case "PO":
        presetObj = defaultPOFlex;
        break;
      case "ALERT":
        presetObj = createStockAlertFlexBubble(
          [
            {
              name: "ปลาร้า แม่เหรียญ ฝาขาว",
              stock: 0,
              minStock: 5,
              unitName: "แพ็ค",
              status: "OUT_OF_STOCK",
            },
            {
              name: "ครีมเภสัช 45 ก.",
              stock: 2,
              minStock: 10,
              unitName: "ขวด",
              status: "LOW_STOCK",
            },
          ],
          { storeName: "ร้าน MiniMark" },
        );
        break;
      case "PORTAL":
        presetObj = createMiniAppPortalFlexBubble({
          storeName: "ร้าน MiniMark",
          liffId: "2011710264-gaZ7oEcK",
        });
        break;
      case "SUMMARY":
        presetObj = createDailySummaryFlexBubble(
          {
            totalProducts: 24,
            inStockCount: 18,
            lowStockCount: 4,
            outOfStockCount: 2,
            totalEstimatedCost: 4500,
            reorderCount: 6,
          },
          { storeName: "ร้าน MiniMark" },
        );
        break;
    }

    if (presetObj) {
      setRawJson(JSON.stringify(presetObj, null, 2));
      setParsedFlex(presetObj);
      setParseError(null);
      toast.success(`โหลดตัวอย่างแม่แบบ "${presetName}" เรียบร้อย`);
    }
  };

  const handleTestSendToLine = async () => {
    if (parseError || !parsedFlex) {
      toast.error("JSON มีข้อผิดพลาด ไม่สามารถส่งได้");
      return;
    }

    setIsTesting(true);
    try {
      const res = await shareFlexViaLiffPicker(
        parsedFlex,
        "ทดสอบส่ง Flex Message จากระบบ MiniMark",
      );
      if (res.success) {
        toast.success("ส่ง LINE Flex Message เข้าห้องแชทสำเร็จเรียบร้อย");
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(`ส่งไม่สำเร็จ: ${String(err)}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Instructions */}
      <div className="rounded-2xl border bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-[#06C755] text-white shadow-xs">
                <Sparkles className="size-4" />
              </span>
              <h3 className="font-bold text-base text-foreground">
                เครื่องมือนำเข้า & ปรับแต่ง Flex Message JSON จาก LINE Simulator
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              ออกแบบการ์ดตามใจคุณบน{" "}
              <a
                href="https://developers.line.biz/flex-simulator/"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-primary underline inline-flex items-center gap-0.5"
              >
                LINE Flex Message Simulator <ExternalLink className="size-3" />
              </a>{" "}
              แล้วคัดลอก JSON มาวางในกล่องด้านล่าง
              ระบบจะแสดงตัวอย่างสดและบันทึกเป็นแม่แบบใช้งานจริงทันที
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 text-xs rounded-xl gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
            >
              <a
                href="https://developers.line.biz/flex-simulator/"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="size-3.5" /> เปิด LINE Flex Simulator
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      {isCustomSaved ? (
        <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200 rounded-2xl">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <AlertTitle className="text-xs font-semibold">
            กำลังใช้งานแม่แบบกำหนดเอง (Custom Active Template)
          </AlertTitle>
          <AlertDescription className="text-xs">
            เมื่อกดส่งสั่งซื้อใน LINE ระบบจะใช้โครงสร้าง JSON ที่คุณออกแบบและบันทึกไว้นี้ในการส่ง
          </AlertDescription>
        </Alert>
      ) : null}

      {parseError ? (
        <Alert className="bg-destructive/10 border-destructive/30 text-destructive rounded-2xl">
          <AlertCircle className="size-4" />
          <AlertTitle className="text-xs font-semibold">ข้อผิดพลาดใน JSON</AlertTitle>
          <AlertDescription className="text-xs font-mono">{parseError}</AlertDescription>
        </Alert>
      ) : null}

      {/* Preset Quick Loader */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-muted/40 p-2.5 rounded-xl border border-border/60">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Layers className="size-4 text-primary" /> โหลดโครงสร้างตัวอย่าง:
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg px-2.5"
            onClick={() => handleLoadPreset("PO")}
          >
            📦 ใบสั่งซื้อ (PO)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg px-2.5"
            onClick={() => handleLoadPreset("ALERT")}
          >
            ⚠️ เตือนสต็อก
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg px-2.5"
            onClick={() => handleLoadPreset("PORTAL")}
          >
            🏪 ทางเข้า Mini App
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs rounded-lg px-2.5"
            onClick={() => handleLoadPreset("SUMMARY")}
          >
            📊 สรุปยอดสต็อก
          </Button>
        </div>
      </div>

      {/* Editor & Live Preview Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left Column: JSON Input Textarea */}
        <Card className="rounded-2xl border shadow-xs flex flex-col justify-between">
          <CardHeader className="p-4 pb-2 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="size-4 text-primary" />
                <CardTitle className="text-sm">กล่องวาง JSON (LINE Simulator)</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2 gap-1"
                  onClick={handleFormatJson}
                >
                  <RefreshCw className="size-3" /> จัดหน้า
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2 gap-1"
                  onClick={handleCopyJson}
                >
                  {copied ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  คัดลอก
                </Button>
              </div>
            </div>
            <CardDescription className="text-[11px]">
              วาง JSON แบบ <code>{"{ type: 'bubble', ... }"}</code> หรือแบบเต็ม{" "}
              <code>{"{ type: 'flex', contents: { ... } }"}</code>
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
            <Textarea
              value={rawJson}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder="วาง JSON ที่คัดลอกจาก LINE Flex Message Simulator ที่นี่..."
              className="font-mono text-xs h-[420px] rounded-xl bg-muted/20 resize-none border-border/80 focus-visible:ring-primary leading-relaxed"
              spellCheck={false}
            />

            <div className="flex items-center justify-between gap-2 pt-2 flex-wrap border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetToDefault}
                className="h-9 text-xs rounded-xl text-muted-foreground gap-1 hover:text-destructive"
              >
                <Trash2 className="size-3.5" /> คืนค่ามาตรฐาน
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTestSendToLine}
                  disabled={Boolean(parseError) || isTesting}
                  className="h-9 text-xs rounded-xl font-semibold text-[#06C755] border-[#06C755]/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 gap-1.5"
                >
                  <Send className="size-3.5" />
                  {isTesting ? "กำลังส่ง..." : "ทดสอบส่งเข้า LINE"}
                </Button>

                <Button
                  size="sm"
                  onClick={handleSaveActiveTemplate}
                  disabled={Boolean(parseError)}
                  className="h-9 text-xs rounded-xl font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <Save className="size-3.5" /> บันทึกเป็นแม่แบบใช้งาน
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Live Visual Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <MessageCircle className="size-4 text-[#06C755]" /> ตัวอย่างผลลัพธ์ในแอป LINE (Live
              Preview)
            </span>
            <Badge variant="outline" className="text-[10px]">
              อัปเดตแบบเรียลไทม์
            </Badge>
          </div>

          <FlexMessageVisualizer
            flexData={parsedFlex}
            title="ตัวอย่างการแสดงผล Flex Message"
            className="rounded-2xl"
          />
        </div>
      </div>
    </div>
  );
}
