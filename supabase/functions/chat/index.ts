import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, history } = await req.json();
    const COMPLYFLOW_API_KEY = Deno.env.get("COMPLYFLOW_API_KEY");
    
    if (!COMPLYFLOW_API_KEY) {
      throw new Error("COMPLYFLOW_API_KEY is not configured");
    }

    console.log("Processing Regwatch chat request:", query);

    const response = await fetch("https://complyflow-production.up.railway.app/regwatch/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": COMPLYFLOW_API_KEY,
      },
      body: JSON.stringify({
        query,
        history: history || [],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Regwatch API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `API error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("Regwatch response received with", data.sources?.length || 0, "sources");
    console.log("Rewritten query:", data.rewritten_query);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
