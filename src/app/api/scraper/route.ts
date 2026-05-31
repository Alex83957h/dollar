import axios from "axios";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

// ---------- SUPABASE CLIENT ----------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------- UTILS ----------
const arabicToEnglish = (num: string) => {
  const map: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return num.split("").map(d => map[d] ?? d).join("");
};

const formatWithComma = (num: string | number) =>
  Number(num).toLocaleString("en-US");

// ---------- SCRAPER API ----------
export async function GET() {
  try {
    const headers = { "User-Agent": "Mozilla/5.0" };

    // -------------------- 1️⃣ USD --------------------
    const usdUrl = "https://xeiqd.com/"; // your USD page URL
    const usdResp = await axios.get(usdUrl, { headers });
    const $usd = cheerio.load(usdResp.data);

    const usdSpans = $usd("span").filter((i, el) =>
      $usd(el).text().trim().startsWith("د.ع")
    );

    const usdRaw = usdSpans.eq(15).text().trim() || "0";
    const usdClean = formatWithComma(arabicToEnglish(usdRaw.replace(/[^0-9٠-٩]/g, "")));

    // -------------------- 2️⃣ EUR / GBP / TRY / IRR --------------------
    const otherUrl = "https://xeiqd.com/"; // your other currencies URL
    const otherResp = await axios.get(otherUrl, { headers });
    const $other = cheerio.load(otherResp.data);

    const spans = $other("span").filter((i, el) =>
      $other(el).text().trim().startsWith("د.ع")
    );

    const eurRaw = spans.eq(6).text().trim() || "0";
    const gbpRaw = spans.eq(0).text().trim() || "0";
    const irrRaw = spans.eq(4).text().trim() || "0";
    const tryRaw = spans.eq(5).text().trim() || "0";

    const eurClean = arabicToEnglish(eurRaw.replace(/[^0-9٠-٩]/g, ""));
    const gbpClean = arabicToEnglish(gbpRaw.replace(/[^0-9٠-٩]/g, ""));
    const tryClean = arabicToEnglish(tryRaw.replace(/[^0-9٠-٩]/g, ""));

    // ---------- ✅ IRR FIX ----------
   const irrClean = arabicToEnglish(irrRaw.replace(/[^0-9٠-٩.]/g, ""));
let irrNum = Number(irrClean);

// Only divide if the value is clearly bigger than 1
if (irrNum > 1) {
  irrNum = (irrNum / 100);
}

// Format as string with 3 decimals
const irrFormatted = (irrNum*10).toFixed(3);

// Build result
const result = {
  USD: `${usdClean} IQD`,
  EUR: `${formatWithComma(Number(eurClean))} IQD`,
  GBP: `${formatWithComma(Number(gbpClean))} IQD`,
  TRY: `${formatWithComma(Number(tryClean))} IQD`,
  IRR: `${irrFormatted} IQD`,  // ✅ works for small and large IRR
  updated_at: new Date().toISOString(),
};


    // ---------- 4️⃣ Check last row ----------
    const { data: lastRow } = await supabase
      .from("Currency")
      .select("*")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    const keys = ["USD", "EUR", "GBP", "TRY", "IRR"] as const;
    let changed = !lastRow;

    if (!changed) {
      for (const key of keys) {
        if (lastRow[key] !== result[key]) {
          changed = true;
          break;
        }
      }
    }

    // ---------- 5️⃣ Insert if changed ----------
    if (changed) {
      const { error } = await supabase.from("Currency").insert([{
        USD: result.USD,
        EUR: result.EUR,
        GBP: result.GBP,
        TRY: result.TRY,
        IRR: result.IRR
      }]);

      if (error) console.error("❌ Supabase Insert Error:", error);
      else console.log("✅ Updated currency:", result);
    } else {
      console.log("⏩ No change — skipping insert.");
    }

    return Response.json(result);

  } catch (error) {
    console.error("❌ Scraper Error:", error);
    return Response.json({ error: "Failed to fetch values" }, { status: 500 });
  }
}
