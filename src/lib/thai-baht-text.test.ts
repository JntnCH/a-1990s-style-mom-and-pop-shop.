import { describe, it, expect } from "vitest";
import { thaiBahtText } from "./thai-baht-text";
import { calculateDocumentTotals } from "./sales-document-service";

describe("thaiBahtText (FlowAccount & Revenue Dept standard)", () => {
  it("converts round numbers properly with 'ถ้วน'", () => {
    expect(thaiBahtText(0)).toBe("ศูนย์บาทถ้วน");
    expect(thaiBahtText(1)).toBe("หนึ่งบาทถ้วน");
    expect(thaiBahtText(20)).toBe("ยี่สิบบาทถ้วน");
    expect(thaiBahtText(101)).toBe("หนึ่งร้อยเอ็ดบาทถ้วน");
    expect(thaiBahtText(1250)).toBe("หนึ่งพันสองร้อยห้าสิบบาทถ้วน");
    expect(thaiBahtText(1000000)).toBe("หนึ่งล้านบาทถ้วน");
  });

  it("converts decimals to Satang properly", () => {
    expect(thaiBahtText(1250.5)).toBe("หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์");
    expect(thaiBahtText(0.75)).toBe("เจ็ดสิบห้าสตางค์");
    expect(thaiBahtText(100.01)).toBe("หนึ่งร้อยบาทหนึ่งสตางค์");
    expect(thaiBahtText(100.21)).toBe("หนึ่งร้อยบาทยี่สิบเอ็ดสตางค์");
  });
});

describe("calculateDocumentTotals (VAT 7% & Withholding Tax)", () => {
  it("calculates VAT Included (7%) correctly", () => {
    const items = [{ quantity: 1, unitPrice: 107 }];
    const res = calculateDocumentTotals(items, "INCLUDED", 7, 0, 0);
    expect(res.grandTotal).toBe(107);
    expect(res.preVatAmount).toBe(100);
    expect(res.vatAmount).toBe(7);
  });

  it("calculates VAT Excluded (7%) correctly", () => {
    const items = [{ quantity: 2, unitPrice: 500 }];
    const res = calculateDocumentTotals(items, "EXCLUDED", 7, 0, 0);
    expect(res.subtotal).toBe(1000);
    expect(res.vatAmount).toBe(70);
    expect(res.grandTotal).toBe(1070);
  });

  it("calculates Withholding Tax (WHT 3%) correctly", () => {
    const items = [{ quantity: 1, unitPrice: 1000 }];
    const res = calculateDocumentTotals(items, "EXCLUDED", 7, 3, 0);
    expect(res.grandTotal).toBe(1070);
    expect(res.withholdingTaxAmount).toBe(30); // 3% of 1000 base
    expect(res.netPaymentAmount).toBe(1040);
  });
});
