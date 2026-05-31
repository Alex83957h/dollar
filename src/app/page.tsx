"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supebaseClient";

interface CurrencyData {
  id?: number;
  USD?: string;
  EUR?: string;
  GBP?: string;
  TRY?: string;
  IRR?: string;
  created_at?: string;
  error?: string;
}

export default function Home() {
  const [data, setData] = useState<CurrencyData>({});
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  // ---------- Helper: scale currencies ----------
  const scaleCurrency = (raw?: string, scale: number = 1, decimals: number = 0) => {
    if (!raw) return "نەدۆزرایەوە";
    const num = Number(raw.replace(/[^\d.]/g, ""));
    const scaled = scale ? num / scale : num;
    return decimals > 0
      ? scaled.toFixed(decimals)
      : Math.round(scaled).toLocaleString("en-US");
  };

  // ---------- Fetch latest row ----------
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: latestRow, error } = await supabase
        .from("Currency")
        .select("*")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!latestRow) {
        setData({ error: "داتایەک نەدۆزرایەوە" });
      } else {
        setData({
          ...latestRow,
          USD: scaleCurrency(latestRow.USD),
          EUR: scaleCurrency(latestRow.EUR, 1000),
          GBP: scaleCurrency(latestRow.GBP, 1000),
          TRY: scaleCurrency(latestRow.TRY, 1000),
          IRR: scaleCurrency(latestRow.IRR, 1, 3), // 3 decimals
        });
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setData({ error: "هەڵە لە داتاکردنەوە" });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // ---------- Real-time subscription ----------
    const subscription = supabase
      .channel("currency-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Currency",
        },
        (payload) => {
          const newRow = payload.new;
          setData({
            ...newRow,
            USD: scaleCurrency(newRow.USD, 10),
            EUR: scaleCurrency(newRow.EUR, 1000),
            GBP: scaleCurrency(newRow.GBP, 1000),
            TRY: scaleCurrency(newRow.TRY, 1000),
            IRR: scaleCurrency(newRow.IRR, 1, 3),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return (
    <div
      dir="rtl"
      className={`${
        darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
      } min-h-screen p-4 sm:p-8 font-sans flex flex-col items-center`}
    >
      <button
        onClick={() => setDarkMode(!darkMode)}
        className={`mb-4 px-4 py-2 rounded-lg font-semibold transition-colors ${
          darkMode
            ? "bg-gray-700 hover:bg-gray-600"
            : "bg-gray-300 hover:bg-gray-400"
        }`}
      >
        {darkMode ? "چالاککردنی ڕۆشنایی" : "چالاککردنی تاریکی"}
      </button>

      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center">
        نرخى دۆلار و دراوەکان بە دیناری عێراقی
      </h1>

      {loading ? (
        <p className="text-xl mt-4 animate-pulse text-center">
          هەڵبژاردنی داتاکان...
        </p>
      ) : data.error ? (
        <p className="text-red-500 text-xl mt-4 text-center">{data.error}</p>
      ) : (
        <div className="overflow-x-auto w-full max-w-xl">
          <table className="w-full border border-gray-400 dark:border-gray-700 rounded-lg text-lg">
            <thead>
              <tr className={darkMode ? "bg-gray-800" : "bg-gray-200"}>
                <th className="py-2 px-4 text-right">ناوی دراو</th>
                <th className="py-2 px-4 text-center">کۆد</th>
                <th className="py-2 px-4 text-left">نرخ</th>
              </tr>
            </thead>
            <tbody>
              {["USD", "EUR", "GBP", "TRY", "IRR"].map((cur) => (
                <tr
                  key={cur}
                  className={`border-t dark:border-gray-700 ${
                    darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                  }`}
                >
                  <td className="py-2 px-4 font-bold text-right">
                    {{
                      USD: "١٠٠ دۆلاری ئەمریکی لە هەولێر",
                      EUR: "١٠٠ یۆرۆی ئەوروپی",
                      GBP: "١٠٠ پاوەندی بەریتانی",
                      TRY: "١٠٠ لیرەی تورکی",
                      IRR: "١٠٠ تومەنی ئێرانی",
                    }[cur]}
                  </td>

                  <td className="py-2 px-4 text-center font-bold">{cur}</td>
                  <td className="py-2 px-4 text-left">
                    IQD  {data[cur as keyof CurrencyData] || "نەدۆزرایەوە"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-6 text-center text-sm opacity-70" dir="ltr">
            © 2026 – Developed by <span className="font-bold">Alex D. Mekhail</span>
          </p>
        </div>
      )}
    </div>
  );
}
