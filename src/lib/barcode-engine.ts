/**
 * Barcode Calculation & Generation Engine (Phase 7)
 * Standards:
 * - GS1 EAN-13 with Modulo-10 Check Digit verification
 * - Code 128 (Alphanumeric high-density barcode)
 * - Internal Store Prefix (885 for Thailand, 20-29 for in-store custom items)
 */

export type BarcodeFormatType = "EAN_13" | "CODE_128" | "EAN_8" | "UPC_A" | "QR_CODE";

/**
 * Calculates GS1 standard Modulo-10 check digit for a 12-digit string
 * Formula:
 * 1. Multiply odd-position digits (1st, 3rd, 5th, ...) by 1
 * 2. Multiply even-position digits (2nd, 4th, 6th, ...) by 3
 * 3. Sum all products
 * 4. Check digit = (10 - (sum % 10)) % 10
 */
export function calculateEAN13CheckDigit(digits12: string): number {
  const clean = digits12.replace(/\D/g, "");
  if (clean.length < 12) {
    throw new Error("EAN-13 calculation requires at least 12 digits");
  }

  const base12 = clean.substring(0, 12);
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base12.charAt(i), 10);
    // 0-indexed: index 0 is 1st (odd position, weight 1), index 1 is 2nd (even position, weight 3)
    sum += i % 2 === 0 ? digit * 1 : digit * 3;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Verifies if an EAN-13 barcode has a valid checksum
 */
export function validateEAN13(barcode: string): { valid: boolean; reason?: string } {
  const clean = barcode.trim().replace(/\D/g, "");
  if (clean.length !== 13) {
    return { valid: false, reason: `ความยาวต้องมี 13 หลัก (ปัจจุบันมี ${clean.length} หลัก)` };
  }

  try {
    const expectedCheck = calculateEAN13CheckDigit(clean.substring(0, 12));
    const actualCheck = parseInt(clean.charAt(12), 10);
    if (expectedCheck !== actualCheck) {
      return {
        valid: false,
        reason: `Check Digit ไม่ถูกต้อง (ระบุมา ${actualCheck} แต่ที่คำนวณได้คือ ${expectedCheck})`,
      };
    }
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, reason: String(err) };
  }
}

/**
 * Generates a valid 13-digit EAN-13 barcode
 * @param prefix Prefix (e.g. "885" for Thailand or "20" for store internal)
 */
export function generateValidEAN13(prefix: string = "885"): string {
  const cleanPrefix = prefix.replace(/\D/g, "");
  // Fill random digits up to 12 digits total
  let base = cleanPrefix;
  while (base.length < 12) {
    base += Math.floor(Math.random() * 10).toString();
  }
  base = base.substring(0, 12);
  const checkDigit = calculateEAN13CheckDigit(base);
  return `${base}${checkDigit}`;
}

/**
 * Generates an internal store barcode for products without manufacturer barcode
 * @param type "EAN_13" | "CODE_128" | "QR_CODE"
 */
export function generateStoreBarcode(
  type: BarcodeFormatType = "EAN_13",
  skuPrefix: string = "ITM",
): { barcode: string; format: BarcodeFormatType } {
  if (type === "EAN_13") {
    // In-store prefix 20xxxx
    return {
      barcode: generateValidEAN13("20"),
      format: "EAN_13",
    };
  }

  if (type === "QR_CODE") {
    const timestamp = Date.now().toString().slice(-6);
    const rand = Math.floor(100 + Math.random() * 900);
    return {
      barcode: `QR-${skuPrefix}-${timestamp}-${rand}`,
      format: "QR_CODE",
    };
  }

  // CODE_128
  const timestamp = Date.now().toString().slice(-6);
  const rand = Math.floor(10 + Math.random() * 90);
  return {
    barcode: `${skuPrefix}-${timestamp}${rand}`,
    format: "CODE_128",
  };
}

/**
 * Detects format and checks validity
 */
export function inspectBarcode(code: string): {
  code: string;
  inferredFormat: BarcodeFormatType;
  isValid: boolean;
  notes: string;
} {
  const trimmed = code.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("QR-") || trimmed.includes("http://") || trimmed.includes("https://")) {
    return {
      code: trimmed,
      inferredFormat: "QR_CODE",
      isValid: trimmed.length > 0,
      notes: "QR Code รูปแบบ 2 มิติ (2D Matrix)",
    };
  }

  if (digitsOnly.length === 13 && trimmed === digitsOnly) {
    const check = validateEAN13(digitsOnly);
    return {
      code: digitsOnly,
      inferredFormat: "EAN_13",
      isValid: check.valid,
      notes: check.valid
        ? digitsOnly.startsWith("885")
          ? "EAN-13 มาตรฐานประเทศไทย (885) ถูกต้อง"
          : digitsOnly.startsWith("20")
            ? "EAN-13 บาร์โค้ดภายในร้าน (20) ถูกต้อง"
            : "EAN-13 มาตรฐานสากล GS1 ถูกต้อง"
        : check.reason || "Check digit ไม่ถูกต้อง",
    };
  }

  if (digitsOnly.length === 8 && trimmed === digitsOnly) {
    return {
      code: digitsOnly,
      inferredFormat: "EAN_8",
      isValid: true,
      notes: "EAN-8 รูปแบบกะทัดรัด (8 หลัก)",
    };
  }

  return {
    code: trimmed,
    inferredFormat: "CODE_128",
    isValid: trimmed.length > 0,
    notes: "Code 128 รองรับอักขระตัวเลขและตัวอักษร Alphanumeric",
  };
}
