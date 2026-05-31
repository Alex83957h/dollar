export const dynamic = "force-dynamic";

import axios from "axios";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

// ---------- SUPABASE ADMIN CLIENT ----------
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------- UTILS ----------
const arabicToEnglish = (num: string) => {
  const map: Record<string, string> = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
  };

  return num
    .split("")
    .map((d) => map[d] ?? d)
    .join("");
};

const formatWithComma = (
  num: string | number
) => {
  return Number(num).toLocaleString("en-US");
};

// ---------- API ----------
export async function GET() {
  try {
    const headers = {
      "User-Agent": "Mozilla/5.0",
    };

    // ---------- USD ----------
    const usdUrl =
      "https://xeiqd.com/";

    const usdResp = await axios.get(
      usdUrl,
      { headers }
    );

    const $usd = cheerio.load(
      usdResp.data
    );

    const usdSpans = $usd("span").filter(
      (i, el) =>
        $usd(el)
          .text()
          .trim()
          .startsWith("د.ع")
    );

    let usdValueRaw =
      usdSpans.eq(9).text().trim() || "0";

    let usdClean = arabicToEnglish(
      usdValueRaw
        .replace(/[^0-9٠-٩]/g, "")
        .trim()
    );

    usdClean =
      formatWithComma(usdClean);

    // ---------- OTHER CURRENCIES ----------
    const otherUrl =
      "https://amro.tech/exchangerate";

    const otherResp = await axios.get(
      otherUrl,
      { headers }
    );

    const $other = cheerio.load(
      otherResp.data
    );

    const tds = $other(
      'td[class="px-6 py-4 font-medium whitespace-nowrap"]'
    );

    const currencies = [
      "EUR",
      "GBP",
      "TRY",
      "IRR",
    ];

    const result: Record<
      string,
      string
    > = {
      USD: `${usdClean} IQD`,
    };

    currencies.forEach((cur, i) => {
      let val = tds
        .eq(i + 1)
        .text()
        .trim();

      val = arabicToEnglish(
        val.replace(/[د.ع]/g, "").trim()
      );

      let numericVal = Number(
        val.replace(/,/g, "")
      );

      if (cur === "IRR") {
        numericVal = numericVal / 100;
      }

      result[cur] = !isNaN(numericVal)
        ? `${formatWithComma(
            numericVal
          )} IQD`
        : "Not Available";
    });

    // ---------- UPDATED TIME ----------
    result["updated_at"] =
      new Date().toISOString();

    // ---------- CHECK LAST ROW ----------
    const { data: lastRow } =
      await supabase
        .from("Currency")
        .select("*")
        .order("id", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    let changed = false;

    if (!lastRow) {
      changed = true;
    } else {
      for (const key of [
        "USD",
        "EUR",
        "GBP",
        "TRY",
        "IRR",
      ]) {
        if (lastRow[key] !== result[key]) {
          changed = true;
          break;
        }
      }
    }

    // ---------- INSERT IF CHANGED ----------
    if (changed) {
      const { error } =
        await supabase
          .from("Currency")
          .insert([
            {
              USD: result["USD"],
              EUR: result["EUR"],
              GBP: result["GBP"],
              TRY: result["TRY"],
              IRR: result["IRR"],
            },
          ]);

      if (error) {
        console.error(
          "❌ Supabase Insert Error:",
          error
        );
      } else {
        console.log(
          "✅ Updated currency:",
          result
        );
      }
    } else {
      console.log(
        "⏩ No change — skipping insert."
      );
    }

    // ---------- RESPONSE ----------
    return Response.json(result, {
      status: 200,
      headers: {
        "Content-Type":
          "application/json",

        "Access-Control-Allow-Origin":
          "*",

        "Access-Control-Allow-Methods":
          "GET",

        "Access-Control-Allow-Headers":
          "Content-Type",
      },
    });

  } catch (error) {
    console.error(
      "❌ Scraper Error:",
      error
    );

    return Response.json(
      {
        error: "Failed to fetch values",
      },
      {
        status: 500,
        headers: {
          "Content-Type":
            "application/json",

          "Access-Control-Allow-Origin":
            "*",
        },
      }
    );
  }
}