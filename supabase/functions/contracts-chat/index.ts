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

    console.log("Processing Contracts chat request:", query);

    const response = await fetch("https://complyflow-production.up.railway.app/contracts/chat", {
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
      console.error("Contracts Chat API error:", response.status, errorText);
      
      // Provide user-friendly error messages
      let errorMessage = "Failed to process your request";
      if (response.status === 502 || response.status === 504) {
        errorMessage = "The contracts service is temporarily unavailable. Please try again in a moment.";
      } else if (response.status === 429) {
        errorMessage = "Too many requests. Please wait a moment before trying again.";
      }
      
      return new Response(JSON.stringify({ error: errorMessage, status: response.status }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    console.log("Contracts Chat response:", JSON.stringify(data, null, 2));

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Contracts Chat function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
