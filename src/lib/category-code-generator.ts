/**
 * Category Code Auto-Generation Utility
 * Generates concise, standardized, 3-5 character uppercase category codes (e.g. MLK, BEER, ALC, TOB, COKE)
 * with support for Thai convenience store vocabulary, English names, transliteration, and sequential fallbacks.
 */

export interface CategoryCodeItem {
  id?: string;
  code?: string;
  name?: string;
}

// Common retail / minimart Thai keyword mappings with primary and secondary codes
const THAI_CATEGORY_DICTIONARY: Array<{
  keywords: string[];
  primary: string;
  alternates: string[];
}> = [
  // User specific items from screenshot
  {
    keywords: ["นม", "นมสด", "นมเปรี้ยว", "นมถั่วเหลือง", "โยเกิร์ต", "dairy"],
    primary: "MLK",
    alternates: ["DAIRY", "YGT"],
  },
  {
    keywords: ["เหล้า", "สุรา", "วิสกี้", "วอดก้า", "บรั่นดี", "รัม", "สุราขาว", "แอลกอฮอล์"],
    primary: "ALC",
    alternates: ["LIQ", "SPRT"],
  },
  { keywords: ["เบียร์", "เบียร์สด", "beer"], primary: "BEER", alternates: ["BER", "ALE"] },
  {
    keywords: ["บุหรี่", "ยาสูบ", "ซิการ์", "ยาเส้น", "tobacco", "cigarette"],
    primary: "TOB",
    alternates: ["SMK", "CIG"],
  },
  {
    keywords: [
      "โค้ก",
      "เป๊ปซี่",
      "โคล่า",
      "น้ำอัดลม",
      "น้ำหวาน",
      "น้ำซ่า",
      "โซดา",
      "coke",
      "cola",
      "soda",
    ],
    primary: "COKE",
    alternates: ["SODA", "COLA"],
  },

  // Standard Store Categories
  {
    keywords: ["เครื่องดื่ม", "น้ำ", "น้ำดื่ม", "น้ำเปล่า", "น้ำแร่", "beverage", "drink"],
    primary: "BEV",
    alternates: ["DRK", "WAT"],
  },
  {
    keywords: ["ขนม", "ขนมขบเคี้ยว", "ของกินเล่น", "มันฝรั่ง", "สแน็ค", "snack"],
    primary: "SNK",
    alternates: ["SNAK", "TREAT"],
  },
  {
    keywords: ["อาหาร", "อาหารสำเร็จรูป", "อาหารแห้ง", "อาหารปรุงสำเร็จ", "food"],
    primary: "FOD",
    alternates: ["FOOD", "MEAL"],
  },
  {
    keywords: ["ของใช้ในครัวเรือน", "ของใช้ในบ้าน", "เครื่องครัว", "household"],
    primary: "HSH",
    alternates: ["HOME", "HH"],
  },
  {
    keywords: ["ของใช้ส่วนตัว", "ส่วนตัว", "สุขอนามัย", "personal"],
    primary: "PER",
    alternates: ["PERS", "CARE"],
  },
  {
    keywords: ["สินค้าเบ็ดเตล็ด", "เบ็ดเตล็ด", "ทั่วไป", "จิปาถะ", "general", "misc"],
    primary: "GEN",
    alternates: ["MISC", "ETC"],
  },

  // Additional Common Categories
  {
    keywords: ["กาแฟ", "เนสกาแฟ", "เมล็ดกาแฟ", "coffee"],
    primary: "COF",
    alternates: ["CAFE", "JAVA"],
  },
  {
    keywords: ["ชา", "ชาเขียว", "ชาไทย", "ชาดำ", "tea"],
    primary: "TEA",
    alternates: ["CHAI", "GTEA"],
  },
  {
    keywords: ["เบเกอรี่", "ขนมปัง", "เค้ก", "พาย", "โดนัท", "bakery", "bread"],
    primary: "BAK",
    alternates: ["BRED", "CAKE"],
  },
  {
    keywords: ["ยา", "ยาสามัญ", "เวชภัณฑ์", "ยาแก้ปวด", "พลาสเตอร์", "medicine", "pharmacy"],
    primary: "MED",
    alternates: ["PHAR", "HLTH"],
  },
  {
    keywords: ["เครื่องสำอาง", "ความงาม", "สกินแคร์", "ครีม", "เซรั่ม", "cosmetic", "beauty"],
    primary: "COS",
    alternates: ["BEA", "SKIN"],
  },
  {
    keywords: ["ห้องน้ำ", "สบู่", "แชมพู", "ยาสระผม", "ยาสีฟัน", "แปรงสีฟัน", "bath", "toiletries"],
    primary: "BATH",
    alternates: ["SOAP", "SHAM"],
  },
  {
    keywords: ["ซักผ้า", "ผงซักฟอก", "น้ำยาซักผ้า", "ปรับผ้านุ่ม", "ซักล้าง", "laundry"],
    primary: "LDY",
    alternates: ["DET", "CLEN"],
  },
  {
    keywords: [
      "เครื่องปรุง",
      "เครื่องปรุงรส",
      "ซอส",
      "น้ำปลา",
      "น้ำส้มสายชู",
      "น้ำมันพืช",
      "seasoning",
    ],
    primary: "SEAS",
    alternates: ["SAUC", "SPIC"],
  },
  {
    keywords: ["ข้าว", "ข้าวสาร", "ข้าวหอมมะลิ", "ข้าวกล้อง", "rice"],
    primary: "RICE",
    alternates: ["GRAIN", "RIC"],
  },
  {
    keywords: ["บะหมี่", "มาม่า", "ไวไว", "ยำยำ", "เส้น", "ก๋วยเตี๋ยว", "noodle"],
    primary: "NOD",
    alternates: ["RAMN", "NDL"],
  },
  {
    keywords: ["ปลากระป๋อง", "อาหารกระป๋อง", "canned"],
    primary: "CAN",
    alternates: ["TIN", "CFOD"],
  },
  {
    keywords: ["แช่แข็ง", "ไอศกรีม", "ไอติม", "frozen", "ice cream"],
    primary: "FRZ",
    alternates: ["ICE", "FROZ"],
  },
  { keywords: ["แช่เย็น", "ตู้แช่", "chilled"], primary: "CHIL", alternates: ["COLD", "CHL"] },
  { keywords: ["ผลไม้", "ผลไม้สด", "fruit"], primary: "FRU", alternates: ["FRUT", "APL"] },
  { keywords: ["ผัก", "ผักสด", "vegetable"], primary: "VEG", alternates: ["VEGI", "GRN"] },
  {
    keywords: ["เนื้อสัตว์", "หมู", "ไก่", "เนื้อวัว", "ปลา", "meat"],
    primary: "MEAT",
    alternates: ["POUL", "FISH"],
  },
  { keywords: ["ไข่", "ไข่ไก่", "ไข่เป็ด", "egg"], primary: "EGG", alternates: ["EGGS", "POUL"] },
  {
    keywords: ["สัตว์เลี้ยง", "อาหารหมา", "อาหารแมว", "อาหารสัตว์", "pet"],
    primary: "PET",
    alternates: ["DOG", "CAT"],
  },
  {
    keywords: [
      "อุปกรณ์ช่าง",
      "เครื่องมือ",
      "เครื่องมือช่าง",
      "ถ่าน",
      "ถ่านไฟฉาย",
      "tools",
      "hardware",
    ],
    primary: "TOOL",
    alternates: ["HARD", "BATT"],
  },
  {
    keywords: ["เครื่องเขียน", "ปากกา", "ดินสอ", "สมุด", "กระดาษ", "stationery", "office"],
    primary: "STN",
    alternates: ["STAT", "OFF"],
  },
  {
    keywords: ["อิเล็กทรอนิกส์", "อุปกรณ์มือถือ", "สายชาร์จ", "หูฟัง", "electronics"],
    primary: "ELEC",
    alternates: ["TECH", "MOB"],
  },
  {
    keywords: ["ของเล่น", "กิ๊ฟช็อป", "ของขวัญ", "toy", "gift"],
    primary: "TOY",
    alternates: ["GIFT", "PLAY"],
  },
  { keywords: ["ไวน์", "แชมเปญ", "wine"], primary: "WINE", alternates: ["WIN", "CHMP"] },
  { keywords: ["สมุนไพร", "กัญชา", "herb"], primary: "HERB", alternates: ["BOT", "NAT"] },
  { keywords: ["น้ำแข็ง", "น้ำแข็งหลอด", "ice"], primary: "ICE", alternates: ["ICED", "COOL"] },
  {
    keywords: ["ถุง", "ถุงพลาสติก", "บรรจุภัณฑ์", "กล่อง", "packaging"],
    primary: "PKG",
    alternates: ["BAG", "BOX"],
  },
  { keywords: ["ทิชชู่", "กระดาษทิชชู่", "tissue"], primary: "TISS", alternates: ["WIPE", "PAPR"] },
];

// Mapping of Thai consonants to English sounds
const THAI_CONSONANT_MAP: Record<string, string> = {
  ก: "K",
  ข: "K",
  ฃ: "K",
  ค: "K",
  ฅ: "K",
  ฆ: "K",
  ง: "NG",
  จ: "J",
  ฉ: "CH",
  ช: "CH",
  ซ: "S",
  ฌ: "CH",
  ญ: "Y",
  ย: "Y",
  ด: "D",
  ฎ: "D",
  ต: "T",
  ฏ: "T",
  ถ: "T",
  ฐ: "T",
  ท: "T",
  ฑ: "T",
  ฒ: "T",
  ธ: "T",
  น: "N",
  ณ: "N",
  บ: "B",
  ป: "P",
  ผ: "P",
  ฝ: "F",
  พ: "P",
  ฟ: "F",
  ภ: "P",
  ม: "M",
  ร: "R",
  ล: "L",
  ฬ: "L",
  ว: "W",
  ศ: "S",
  ษ: "S",
  ส: "S",
  ห: "H",
  ฮ: "H",
  อ: "O",
};

/**
 * Extract consonant initials from a Thai phrase to build a 3-4 letter acronym
 */
function extractThaiPhoneticCode(name: string): string {
  const letters: string[] = [];
  for (const char of name) {
    if (THAI_CONSONANT_MAP[char]) {
      letters.push(THAI_CONSONANT_MAP[char]);
      if (letters.length >= 4) break;
    }
  }
  const result = letters.join("");
  return result.length >= 2 ? result.slice(0, 4) : "";
}

/**
 * Generate candidate codes from an English/Latin name
 */
function extractEnglishCode(name: string): string[] {
  const clean = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!clean) return [];

  if (clean.length <= 4) {
    return [clean];
  }

  const results: string[] = [];
  // First 3-4 letters
  results.push(clean.slice(0, 3));
  results.push(clean.slice(0, 4));

  // Consonants only
  const noVowels = clean.replace(/[AEIOU]/g, "");
  if (noVowels.length >= 3) {
    results.push(noVowels.slice(0, 3));
  }

  return [...new Set(results)];
}

/**
 * Generate a sequential fallback code like "CAT-07" or "C07"
 */
function generateSequentialCode(
  existingCodes: Set<string>,
  prefix = "CAT-",
  startNumber = 1,
): string {
  let num = startNumber;
  while (true) {
    const formatted = `${prefix}${String(num).padStart(2, "0")}`;
    if (!existingCodes.has(formatted.toUpperCase())) {
      return formatted;
    }
    num++;
  }
}

/**
 * Get multiple smart category code candidates for a given category name
 */
export function getCategoryCodeSuggestions(
  name: string,
  existingCategories: CategoryCodeItem[] = [],
  currentCategoryId?: string,
): string[] {
  const trimmed = (name || "").trim();
  const existingSet = new Set(
    existingCategories
      .filter((c) => c.id !== currentCategoryId && c.code && c.code !== "—" && c.code !== "-")
      .map((c) => (c.code || "").trim().toUpperCase()),
  );

  const candidates: string[] = [];

  if (trimmed) {
    const lower = trimmed.toLowerCase();

    // 1. Search Dictionary (Exact or substring)
    // Priority: Exact match keyword first, then substring match
    for (const entry of THAI_CATEGORY_DICTIONARY) {
      const exactMatch = entry.keywords.some((k) => lower === k);
      if (exactMatch) {
        candidates.push(entry.primary, ...entry.alternates);
        break;
      }
    }

    if (candidates.length === 0) {
      for (const entry of THAI_CATEGORY_DICTIONARY) {
        const containsMatch = entry.keywords.some((k) => lower.includes(k) || k.includes(lower));
        if (containsMatch) {
          candidates.push(entry.primary, ...entry.alternates);
          break;
        }
      }
    }

    // 2. English extraction if text has Latin letters
    if (/[a-zA-Z]/.test(trimmed)) {
      candidates.push(...extractEnglishCode(trimmed));
    }

    // 3. Thai phonetic extraction
    const phonetic = extractThaiPhoneticCode(trimmed);
    if (phonetic && phonetic.length >= 2) {
      candidates.push(phonetic);
    }
  }

  // 4. Sequential fallback candidate
  const nextSeq = generateSequentialCode(
    existingSet,
    "CAT-",
    Math.max(1, existingCategories.length + 1),
  );
  candidates.push(nextSeq);

  // Filter out duplicates and return unique normalized candidates
  const uniqueCandidates: string[] = [];
  for (const c of candidates) {
    const upper = c.trim().toUpperCase();
    if (upper && !uniqueCandidates.includes(upper)) {
      uniqueCandidates.push(upper);
    }
  }

  return uniqueCandidates.slice(0, 4);
}

/**
 * Generates the best unique category code for a given category name.
 * Guaranteed to return a non-empty, unique, standardized code.
 */
export function generateCategoryCode(
  name: string,
  existingCategories: CategoryCodeItem[] = [],
  currentCategoryId?: string,
): string {
  const existingSet = new Set(
    existingCategories
      .filter((c) => c.id !== currentCategoryId && c.code && c.code !== "—" && c.code !== "-")
      .map((c) => (c.code || "").trim().toUpperCase()),
  );

  const suggestions = getCategoryCodeSuggestions(name, existingCategories, currentCategoryId);

  // Pick first suggestion that is not already taken
  for (const cand of suggestions) {
    if (!existingSet.has(cand)) {
      return cand;
    }
  }

  // If all suggestions are taken, append a number to the primary candidate or use sequential
  const base = suggestions[0] || "CAT";
  let counter = 2;
  while (true) {
    const candidate = `${base}${counter}`;
    if (!existingSet.has(candidate)) {
      return candidate;
    }
    counter++;
    if (counter > 99) break;
  }

  return generateSequentialCode(existingSet, "CAT-", existingCategories.length + 1);
}

/**
 * Checks all categories in a list and auto-populates any missing or placeholder ('-' / '—') codes.
 * Returns the updated category list and count of fixed items.
 */
export function autoFillMissingCategoryCodes(categories: CategoryCodeItem[]): {
  updated: CategoryCodeItem[];
  fixedCount: number;
} {
  let fixedCount = 0;
  const currentList: CategoryCodeItem[] = [...categories];

  const result = currentList.map((cat, index) => {
    const code = (cat.code || "").trim();
    const isMissing = !code || code === "-" || code === "—";

    if (!isMissing) {
      return cat;
    }

    // Auto-generate code considering already processed items in the list
    const otherItems = currentList.filter((_, i) => i !== index);
    const generated = generateCategoryCode(cat.name || `หมวดหมู่ ${index + 1}`, otherItems, cat.id);
    fixedCount++;

    return {
      ...cat,
      code: generated,
    };
  });

  return {
    updated: result,
    fixedCount,
  };
}
