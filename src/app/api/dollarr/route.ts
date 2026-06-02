// 1. Extend the Vercel function execution limit to 30 seconds
export const maxDuration = 30;
export const dynamic = "force-dynamic";

import axios from "axios";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const arabicToEnglish = (num: string) => {
  const map: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return num.split("").map((d) => map[d] ?? d).join("");
};

const formatWithComma = (num: string | number) => {
  const n = Number(num);
  if (isNaN(n)) return "0";
  return n.toLocaleString("en-US");
};

export async function GET() {
  // 2. Initialize result in the outer scope so it is always accessible
  let result: Record<string, string> = {}; 

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    const axiosConfig = { headers, timeout: 10000 };

    // Fetch USD
    const usdResp = await axios.get("https://xeiqd.com/", axiosConfig);
    const $usd = cheerio.load(usdResp.data);
    const usdSpans = $usd("span").filter((i, el) => $usd(el).text().trim().startsWith("د.ع"));
    let usdValueRaw = usdSpans.eq(9).text().trim() || "0";
    let usdClean = formatWithComma(arabicToEnglish(usdValueRaw.replace(/[^0-9٠-٩]/g, "").trim()));

    // Fetch Other Currencies
    const otherResp = await axios.get("https://amro.tech/exchangerate", axiosConfig);
    const $other = cheerio.load(otherResp.data);
    const tds = $other('td[class="px-6 py-4 font-medium whitespace-nowrap"]');

    const currencies = ["EUR", "GBP", "TRY", "IRR"];
    
    // Assign values to the initialized result object
    result["USD"] = `${usdClean} IQD`;

    currencies.forEach((cur, i) => {
      let val = tds.eq(i + 1).text().trim();
      val = arabicToEnglish(val.replace(/[د.ع]/g, "").trim());
      let numericVal = Number(val.replace(/,/g, ""));
      if (cur === "IRR") numericVal = numericVal / 100;
      
      result[cur] = !isNaN(numericVal) ? `${formatWithComma(numericVal)} IQD` : "Not Available";
    });

    result["updated_at"] = new Date().toISOString();

    // Supabase logic...
    // (Your existing Supabase insert logic here)

    return Response.json(result, {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error("❌ Scraper Error:", error);
    return Response.json({ error: "Failed to fetch values", details: String(error) }, { 
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
}