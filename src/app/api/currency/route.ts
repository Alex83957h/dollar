import { supabase } from "@/lib/supebaseClient";

export async function GET() {
  try {
    const { data: latestRow, error } = await supabase
      .from("Currency")
      .select("*")
      .order("id",{ ascending: false })
      .limit(1)
      .maybeSingle();

    if(error) throw error;
    if(!latestRow) return new Response(JSON.stringify({ error: "No data" }), { status: 404 });

    return new Response(JSON.stringify(latestRow), { status: 200 });
  } catch(err) {
    return new Response(JSON.stringify({ error: "Failed to fetch data" }), { status: 500 });
  }
}
