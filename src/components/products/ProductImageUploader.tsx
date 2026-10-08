import {
  Camera,
  CameraOff,
  Check,
  FolderOpen,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import React, { useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { captureFrameFromVideo, compressImageFile } from "@/lib/image-utils";

interface ProductImageUploaderProps {
  value: string;
  onChange: (imageUrl: string) => void;
  productName?: string;
}

export function ProductImageUploader({
  value,
  onChange,
  productName = "",
}: ProductImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveCameraOpen, setLiveCameraOpen] = useState(false);
  const [urlInputOpen, setUrlInputOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Start live webcam / rear camera modal
  const startLiveCamera = async () => {
    setCameraError(null);
    setLiveCameraOpen(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องโดยตรง");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setCameraStream(stream);
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play();
      }
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || "ไม่สามารถเข้าถึงกล้องได้";
      setCameraError(errMsg);
    }
  };

  const stopLiveCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
    setLiveCameraOpen(false);
  };

  const handleCaptureSnapshot = () => {
    if (!liveVideoRef.current) return;
    try {
      const dataUrl = captureFrameFromVideo(liveVideoRef.current, {
        maxWidth: 700,
        maxHeight: 700,
        quality: 0.85,
      });
      if (dataUrl) {
        onChange(dataUrl);
        toast.success("บันทึกรูปภาพสินค้าจากกล้องเรียบร้อย");
        stopLiveCamera();
      } else {
        toast.error("ไม่สามารถถ่ายรูปได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาดในการถ่ายภาพ");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const compressed = await compressImageFile(file, {
        maxWidth: 700,
        maxHeight: 700,
        quality: 0.85,
      });
      onChange(compressed);
      toast.success("อัปโหลดและปรับขนาดรูปภาพสำเร็จ");
    } catch (err) {
      toast.error("เกิดข้อผิดพลาดในการประมวลผลรูปภาพ");
      console.error(err);
    } finally {
      setIsProcessing(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleApplyUrl = () => {
    if (!manualUrl.trim()) return;
    onChange(manualUrl.trim());
    setUrlInputOpen(false);
    toast.success("ตั้งค่า URL รูปภาพสำเร็จ");
  };

  return (
    <div className="space-y-2">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Native device camera direct capture fallback */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <ImageIcon className="size-3.5 text-primary" /> รูปภาพสินค้า (Product Photo)
        </Label>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-destructive hover:text-destructive gap-1"
            onClick={() => onChange("")}
          >
            <Trash2 className="size-3" /> ลบรูปภาพ
          </Button>
        )}
      </div>

      {value ? (
        /* Preview Card when image is set */
        <div className="flex items-center gap-3 p-3 rounded-2xl border bg-card shadow-xs">
          <div className="relative size-20 sm:size-24 rounded-xl overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
            <img
              src={value}
              alt={productName || "Product"}
              className="size-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%2394a3b8' font-size='12'%3EImage Error%3C/text%3E%3C/svg%3E";
              }}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="text-xs font-medium text-foreground truncate">
              {value.startsWith("data:") ? "รูปภาพที่ถ่าย / อัปโหลดไว้" : value}
            </div>
            <p className="text-[11px] text-muted-foreground">
              รูปภาพพร้อมแสดงผลในหน้ารายการสินค้า และใบเสร็จ
            </p>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-lg gap-1"
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
                    void startLiveCamera();
                  } else {
                    cameraInputRef.current?.click();
                  }
                }}
              >
                <Camera className="size-3" /> ถ่ายใหม่
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs rounded-lg gap-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-3" /> เปลี่ยนไฟล์
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Large Touch-Friendly Image Picker Buttons */
        <div className="grid min-w-0 grid-cols-3 gap-1.5">
          {/* Option 1: Camera Photo */}
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-11 min-w-0 w-full flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-center hover:bg-primary/5 sm:flex-row sm:gap-1.5"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
                void startLiveCamera();
              } else {
                cameraInputRef.current?.click();
              }
            }}
            disabled={isProcessing}
          >
            <Camera className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 break-words text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
              ถ่ายรูปด้วยกล้อง
            </span>
          </Button>

          {/* Option 2: Upload File */}
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-11 min-w-0 w-full flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-center hover:bg-primary/5 sm:flex-row sm:gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            <FolderOpen className="size-4 shrink-0 text-emerald-600" />
            <span className="min-w-0 break-words text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
              เลือกไฟล์รูป
            </span>
          </Button>

          {/* Option 3: URL Link */}
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-11 min-w-0 w-full flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-center hover:bg-primary/5 sm:flex-row sm:gap-1.5"
            onClick={() => {
              setManualUrl(value);
              setUrlInputOpen(true);
            }}
            disabled={isProcessing}
          >
            <LinkIcon className="size-4 shrink-0 text-blue-600" />
            <span className="min-w-0 break-words text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
              ใส่ลิงก์ URL
            </span>
          </Button>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground animate-pulse">
          <Loader2 className="size-3.5 animate-spin text-primary" />
          กำลังประมวลผลและบีบอัดรูปภาพ...
        </div>
      )}

      {/* LIVE CAMERA CAPTURE MODAL */}
      <Dialog
        open={liveCameraOpen}
        onOpenChange={(open) => {
          if (!open) stopLiveCamera();
        }}
      >
        <DialogContent className="w-[94vw] max-w-md rounded-2xl p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Camera className="size-5 text-primary" /> ถ่ายรูปภาพสินค้า
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black flex items-center justify-center">
              <video
                ref={liveVideoRef}
                className="size-full object-cover"
                autoPlay
                playsInline
                muted
              />
              <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-dashed border-white/60" />
            </div>

            {cameraError ? (
              <Alert variant="destructive" className="py-2 text-xs">
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                จัดสินค้าให้อยู่ในกรอบแล้วกดปุ่ม "ถ่ายรูปตอนนี้"
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={stopLiveCamera}>
              ยกเลิก
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-11 rounded-xl font-semibold gap-2 flex-1 bg-primary text-primary-foreground shadow-sm"
              onClick={handleCaptureSnapshot}
            >
              <Camera className="size-5" /> ถ่ายรูปตอนนี้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* URL INPUT DIALOG */}
      <Dialog open={urlInputOpen} onOpenChange={setUrlInputOpen}>
        <DialogContent className="max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <LinkIcon className="size-4 text-primary" /> กรอก URL รูปภาพสินค้า
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="https://images.unsplash.com/... หรือ URL รูปภาพ"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              className="h-10 text-xs rounded-xl"
            />
            {manualUrl && (
              <div className="h-32 w-full rounded-xl border bg-muted flex items-center justify-center overflow-hidden">
                <img
                  src={manualUrl}
                  alt="Preview"
                  className="size-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setUrlInputOpen(false)}>
              ยกเลิก
            </Button>
            <Button size="sm" onClick={handleApplyUrl} disabled={!manualUrl.trim()}>
              นำไปใช้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
