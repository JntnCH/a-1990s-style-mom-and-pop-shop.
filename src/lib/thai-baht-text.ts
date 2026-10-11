/**
 * Converts a number to Thai Baht Text format (e.g. 1,250.50 -> "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์")
 * Standard Thai accounting standard compliant (FlowAccount / RD standard)
 */
export function thaiBahtText(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "ศูนย์บาทถ้วน";
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const rounded = Math.round(absAmount * 100) / 100;
  if (rounded === 0) {
    return "ศูนย์บาทถ้วน";
  }

  const parts = rounded.toFixed(2).split(".");
  const integerPart = parts[0] || "0";
  const fractionPart = parts[1] || "00";

  const THAI_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const THAI_POSITIONS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  function convertChunk(numStr: string, isChunkAtMillion = false): string {
    let result = "";
    const len = numStr.length;
    const numVal = parseInt(numStr, 10);

    for (let i = 0; i < len; i++) {
      const digit = parseInt(numStr[i] || "0", 10);
      const pos = len - i - 1;

      if (digit !== 0) {
        if (pos === 1 && digit === 1) {
          result += "สิบ";
        } else if (pos === 1 && digit === 2) {
          result += "ยี่สิบ";
        } else if (pos === 0 && digit === 1) {
          // If ends with 1, use 'เอ็ด' only if the chunk has value > 1 (e.g. 11, 21, 101, 1001)
          if (numVal > 1 && (len > 1 || isChunkAtMillion)) {
            result += "เอ็ด";
          } else {
            result += "หนึ่ง";
          }
        } else {
          result += (THAI_DIGITS[digit] ?? "") + (THAI_POSITIONS[pos] ?? "");
        }
      }
    }
    return result;
  }

  function convertInteger(numStr: string): string {
    if (numStr === "0") return "ศูนย์";
    let result = "";
    let remaining = numStr;
    let millionGroup = 0;

    while (remaining.length > 0) {
      const chunkLen = Math.min(6, remaining.length);
      const chunk = remaining.slice(-chunkLen);
      remaining = remaining.slice(0, -chunkLen);

      const chunkText = convertChunk(chunk, millionGroup > 0);
      if (chunkText !== "") {
        let suffix = "";
        for (let m = 0; m < millionGroup; m++) {
          suffix += "ล้าน";
        }
        result = chunkText + suffix + result;
      }
      millionGroup++;
    }

    return result;
  }

  function convertSatang(satangStr: string): string {
    const satangNum = parseInt(satangStr, 10);
    if (satangNum === 0) return "";

    const tenDigit = parseInt(satangStr[0] || "0", 10);
    const unitDigit = parseInt(satangStr[1] || "0", 10);

    let res = "";
    if (tenDigit === 1) {
      res += "สิบ";
    } else if (tenDigit === 2) {
      res += "ยี่สิบ";
    } else if (tenDigit > 2) {
      res += THAI_DIGITS[tenDigit] + "สิบ";
    }

    if (unitDigit === 1) {
      if (tenDigit > 0) {
        res += "เอ็ด";
      } else {
        res += "หนึ่ง";
      }
    } else if (unitDigit > 1) {
      res += THAI_DIGITS[unitDigit];
    }

    return res + "สตางค์";
  }

  const bahtText = integerPart === "0" ? "" : convertInteger(integerPart) + "บาท";
  const satangText = convertSatang(fractionPart);

  let fullText = "";
  if (!satangText) {
    fullText = (bahtText || "ศูนย์บาท") + "ถ้วน";
  } else {
    fullText = (bahtText || "") + satangText;
  }

  return (isNegative ? "ลบ" : "") + fullText;
}
