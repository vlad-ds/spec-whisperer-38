import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, action',
};

const API_BASE_URL = 'https://api.complyflow.example.com';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('COMPLYFLOW_API_KEY');
  if (!apiKey) {
    console.error('COMPLYFLOW_API_KEY not configured');
    return new Response(
      JSON.stringify({ error: 'API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let action: string | null = null;
    let contractId: string | null = null;
    let requestBody: Record<string, unknown> | null = null;
    let formData: FormData | null = null;

    // Check if it's a FormData request (file upload)
    if (contentType.includes('multipart/form-data')) {
      action = req.headers.get('action') || 'upload';
      formData = await req.formData();
    } else {
      // JSON body
      const body = await req.json();
      action = body.action;
      contractId = body.id;
      requestBody = body;
    }

    console.log(`Contract API called: action=${action}, id=${contractId}`);

    let apiUrl: string;
    let method = 'GET';
    let body: BodyInit | undefined;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${apiKey}`,
    };

    switch (action) {
      case 'upload':
        apiUrl = `${API_BASE_URL}/contracts/upload`;
        method = 'POST';
        if (formData) {
          body = formData;
        }
        break;

      case 'get':
        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        apiUrl = `${API_BASE_URL}/contracts/${contractId}`;
        method = 'GET';
        break;

      case 'mark-reviewed':
        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        apiUrl = `${API_BASE_URL}/contracts/${contractId}/review`;
        method = 'PATCH';
        break;

      case 'update-field':
        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        apiUrl = `${API_BASE_URL}/contracts/${contractId}/fields`;
        method = 'PATCH';
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({
          field_name: requestBody?.field_name,
          original_value: requestBody?.original_value,
          new_value: requestBody?.new_value,
        });
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Forwarding to: ${apiUrl} with method: ${method}`);

    const response = await fetch(apiUrl, {
      method,
      headers,
      body,
    });

    const responseData = await response.text();
    console.log(`API response status: ${response.status}`);

    return new Response(responseData, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Contract API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
