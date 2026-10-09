import {
  Camera,
  CameraOff,
  Check,
  FlipHorizontal,
  FolderOpen,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  SwitchCamera,
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
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isShutterFlashing, setIsShutterFlashing] = useState(false);

  // Start live webcam / rear camera modal
  const startLiveCamera = async (targetFacingMode: "environment" | "user" = facingMode) => {
    setCameraError(null);
    setLiveCameraOpen(true);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
        setCameraStream(null);
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องโดยตรง");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacingMode },
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

  const toggleCameraFacing = async () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    await startLiveCamera(nextMode);
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
      // Shutter flash effect & haptic feedback
      setIsShutterFlashing(true);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(45);
      }
      setTimeout(() => setIsShutterFlashing(false), 200);

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
    <div className="space-y-3">
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
          <ImageIcon className="size-4 text-primary" /> รูปภาพสินค้า (Product Photo)
        </Label>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 rounded-lg"
            onClick={() => onChange("")}
          >
            <Trash2 className="size-3.5" /> ลบรูปภาพ
          </Button>
        )}
      </div>

      {value ? (
        /* Preview Card when image is set */
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-3.5 rounded-2xl border bg-card shadow-xs">
          <div className="relative size-24 sm:size-28 rounded-xl overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
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
          <div className="flex-1 min-w-0 space-y-2 w-full">
            <div className="text-xs font-medium text-foreground truncate">
              {value.startsWith("data:") ? "รูปภาพที่ถ่าย / บันทึกไว้แล้ว" : value}
            </div>
            <p className="text-[11px] text-muted-foreground">
              รูปภาพพร้อมแสดงในแคตตาล็อกสินค้า และการออกเอกสาร
            </p>
            {/* Enlarged touch-friendly action buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-10 px-4 text-xs font-bold rounded-xl gap-2 bg-primary text-primary-foreground shadow-xs active:scale-98"
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
                    void startLiveCamera();
                  } else {
                    cameraInputRef.current?.click();
                  }
                }}
              >
                <Camera className="size-4" /> ถ่ายใหม่
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 px-4 text-xs font-semibold rounded-xl gap-2 active:scale-98"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4 text-emerald-600" /> เปลี่ยนไฟล์
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Large Touch-Friendly Image Picker: Prominent Camera Primary Action */
        <div className="space-y-2">
          {/* Main Hero Photo Button (จุดที่ 1: ถ่ายรูปด้วยกล้อง - ขนาดใหญ่พิเศษ สัมผัสง่าย) */}
          <Button
            type="button"
            className="w-full h-14 sm:h-15 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm sm:text-base flex items-center justify-center gap-3 shadow-sm transition-transform active:scale-98"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
                void startLiveCamera();
              } else {
                cameraInputRef.current?.click();
              }
            }}
            disabled={isProcessing}
          >
            <div className="flex items-center justify-center size-9 rounded-xl bg-white/20 text-white shrink-0">
              <Camera className="size-5" />
            </div>
            <div className="text-left leading-tight">
              <div className="font-bold text-sm sm:text-base">ถ่ายรูปด้วยกล้อง</div>
              <div className="text-[11px] font-normal text-primary-foreground/80">
                เปิดกล้องมือถือถ่ายภาพสินค้าได้ทันที
              </div>
            </div>
          </Button>

          {/* Secondary Options: File Upload & URL */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl px-3 flex items-center justify-center gap-2 border-dashed hover:bg-accent/60 active:scale-98 text-xs font-semibold"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <FolderOpen className="size-4 text-emerald-600 shrink-0" />
              <span>เลือกไฟล์จากเครื่อง</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl px-3 flex items-center justify-center gap-2 border-dashed hover:bg-accent/60 active:scale-98 text-xs font-semibold"
              onClick={() => {
                setManualUrl(value);
                setUrlInputOpen(true);
              }}
              disabled={isProcessing}
            >
              <LinkIcon className="size-4 text-blue-600 shrink-0" />
              <span>ใส่ลิงก์รูป URL</span>
            </Button>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground animate-pulse">
          <Loader2 className="size-4 animate-spin text-primary" />
          กำลังประมวลผลและปรับขนาดรูปภาพ...
        </div>
      )}

      {/* LIVE CAMERA CAPTURE MODAL (จุดที่ 2: หน้าต่างกล้องถ่ายรูปพร้อมปุ่มชัตเตอร์ขนาดใหญ่) */}
      <Dialog
        open={liveCameraOpen}
        onOpenChange={(open) => {
          if (!open) stopLiveCamera();
        }}
      >
        <DialogContent className="w-[96vw] max-w-lg rounded-3xl p-4 sm:p-6 bg-background shadow-2xl border">
          <DialogHeader className="pb-1">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
                <Camera className="size-5 text-primary" /> ถ่ายรูปภาพสินค้า
              </DialogTitle>
              {/* Camera Switch Button in Header */}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 px-2.5 rounded-lg text-xs font-medium gap-1.5"
                onClick={toggleCameraFacing}
                title="สลับกล้องหน้า / กล้องหลัง"
              >
                <SwitchCamera className="size-3.5 text-primary" />
                <span>สลับกล้อง</span>
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Camera Viewfinder: Tap to capture supported */}
            <div
              className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black flex items-center justify-center cursor-pointer select-none group shadow-inner"
              onClick={handleCaptureSnapshot}
              title="แตะที่หน้าจอเพื่อถ่ายรูปได้ทันที"
            >
              <video
                ref={liveVideoRef}
                className="size-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {/* Viewfinder Target Framing Guidelines */}
              <div className="pointer-events-none absolute inset-4 sm:inset-6 rounded-2xl border-2 border-dashed border-white/70 shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all group-hover:border-primary" />

              {/* Tap to Snap Hint Overlay */}
              <div className="pointer-events-none absolute bottom-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-xs text-[11px] text-white/90 font-medium">
                แตะที่จอภาพ หรือ กดปุ่มด้านล่างเพื่อถ่าย
              </div>

              {/* Shutter Flash Animation Overlay */}
              {isShutterFlashing && (
                <div className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-200 animate-in fade-in" />
              )}
            </div>

            {cameraError ? (
              <Alert variant="destructive" className="py-2.5 text-xs rounded-xl">
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          {/* LARGE ERGONOMIC SHUTTER CONTROLS */}
          <div className="space-y-2 pt-2">
            {/* Main Shutter Button: Extra large, touch friendly (h-15 / h-16) */}
            <Button
              type="button"
              size="lg"
              className="w-full h-15 sm:h-16 rounded-2xl font-bold text-base sm:text-lg gap-3 bg-primary hover:bg-primary/95 text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-98 flex items-center justify-center"
              onClick={handleCaptureSnapshot}
            >
              <div className="size-9 rounded-full border-2 border-white/80 flex items-center justify-center bg-white/20">
                <Camera className="size-5 text-white" />
              </div>
              <span>ถ่ายรูปตอนนี้</span>
            </Button>

            {/* Bottom Secondary Controls: Camera Switch and Cancel */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl text-xs sm:text-sm font-semibold gap-2 active:scale-98"
                onClick={toggleCameraFacing}
              >
                <SwitchCamera className="size-4 text-muted-foreground" />
                สลับกล้อง ({facingMode === "environment" ? "หลัง" : "หน้า"})
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-xl text-xs sm:text-sm font-semibold hover:bg-muted text-muted-foreground active:scale-98"
                onClick={stopLiveCamera}
              >
                ยกเลิก
              </Button>
            </div>
          </div>
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
              className="h-11 text-xs rounded-xl"
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
            <Button variant="outline" size="sm" className="h-10 rounded-xl" onClick={() => setUrlInputOpen(false)}>
              ยกเลิก
            </Button>
            <Button size="sm" className="h-10 rounded-xl" onClick={handleApplyUrl} disabled={!manualUrl.trim()}>
              นำไปใช้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
