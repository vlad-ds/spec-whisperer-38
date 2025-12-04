import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, action',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get('AIRTABLE_API_KEY');
  const baseId = Deno.env.get('AIRTABLE_BASE_ID');
  const tableName = Deno.env.get('AIRTABLE_TABLE_NAME');

  if (!apiKey || !baseId || !tableName) {
    console.error('Airtable configuration missing');
    return new Response(
      JSON.stringify({ error: 'Airtable not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let action: string | null = null;
    let contractId: string | null = null;
    let requestBody: Record<string, unknown> | null = null;

    // Check if it's a FormData request (file upload)
    if (contentType.includes('multipart/form-data')) {
      action = req.headers.get('action') || 'upload';
    } else {
      // JSON body
      const body = await req.json();
      action = body.action;
      contractId = body.id;
      requestBody = body;
    }

    console.log(`Contract API called: action=${action}, id=${contractId}`);

    switch (action) {
      case 'get': {
        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${contractId}`;
        console.log(`Fetching from Airtable: ${airtableUrl}`);

        const response = await fetch(airtableUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Airtable error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch contract from Airtable' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const record = await response.json();
        console.log(`Fetched contract: ${record.id}`);

        // Transform Airtable record to expected format
        const result = {
          id: record.id,
          fields: record.fields,
          created_time: record.createdTime,
        };

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'mark-reviewed': {
        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${contractId}`;
        console.log(`Updating status in Airtable: ${airtableUrl}`);

        const response = await fetch(airtableUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              status: 'reviewed',
              reviewed_at: new Date().toISOString(),
            },
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Airtable error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to update contract status' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-field': {
        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const fieldName = requestBody?.field_name as string;
        const newValue = requestBody?.new_value;

        if (!fieldName) {
          return new Response(
            JSON.stringify({ error: 'Field name required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${contractId}`;
        console.log(`Updating field ${fieldName} in Airtable: ${airtableUrl}`);

        const response = await fetch(airtableUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              [fieldName]: newValue,
            },
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Airtable error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to update field' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'upload': {
        const complyflowApiKey = Deno.env.get('COMPLYFLOW_API_KEY');
        if (!complyflowApiKey) {
          console.error('COMPLYFLOW_API_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'ComplyFlow API not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get the form data from the original request
        const formData = await req.formData();
        const file = formData.get('file');
        
        if (!file) {
          return new Response(
            JSON.stringify({ error: 'No file provided' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Uploading to ComplyFlow API...');
        
        // Forward to ComplyFlow API
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        // Set a 120 second timeout for LLM processing
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        let uploadResponse: Response;
        try {
          uploadResponse = await fetch('https://complyflow-production.up.railway.app/contracts/upload', {
            method: 'POST',
            headers: {
              'x-api-key': complyflowApiKey,
            },
            body: uploadFormData,
            signal: controller.signal,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            console.error('ComplyFlow API request timed out after 120s');
            return new Response(
              JSON.stringify({ error: 'Upload timed out - the PDF processing is taking longer than expected. Please try again.' }),
              { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw fetchError;
        }
        clearTimeout(timeoutId);
        
        console.log('ComplyFlow API responded with status:', uploadResponse.status);

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('ComplyFlow API error:', uploadResponse.status, errorText);
          return new Response(
            JSON.stringify({ error: `Upload failed: ${errorText}` }),
            { status: uploadResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const uploadResult = await uploadResponse.json();
        console.log('Upload successful, contract_id:', uploadResult.contract_id);

        // Transform response to match expected ContractRecord format
        const result = {
          id: uploadResult.contract_id,
          fields: {
            filename: uploadResult.filename,
            ...uploadResult.extraction,
            ...uploadResult.computed_dates,
            status: uploadResult.status || 'under_review',
          },
          created_time: uploadResult.created_at,
        };

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Contract API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
