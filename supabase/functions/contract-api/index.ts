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
    const url = new URL(req.url);
    let action: string | null = null;
    let contractId: string | null = null;
    let requestBody: Record<string, unknown> | null = null;

    // Check for GET request with query params (for PDF download)
    if (req.method === 'GET' || url.searchParams.has('action')) {
      action = url.searchParams.get('action');
      contractId = url.searchParams.get('id');
    }
    // Check if it's a FormData request (file upload)
    else if (contentType.includes('multipart/form-data')) {
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
      case 'get-schema': {
        // Fetch Airtable table schema to get valid select options
        const schemaUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
        console.log('Fetching Airtable schema...');

        const schemaResponse = await fetch(schemaUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!schemaResponse.ok) {
          const error = await schemaResponse.text();
          console.error('Airtable schema error:', schemaResponse.status, error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch schema' }),
            { status: schemaResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const schemaData = await schemaResponse.json();
        const table = schemaData.tables?.find((t: { name: string }) => t.name === tableName);
        
        if (!table) {
          return new Response(
            JSON.stringify({ error: 'Table not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Extract select field options
        const selectFields: Record<string, string[]> = {};
        for (const field of table.fields || []) {
          if (field.type === 'singleSelect' && field.options?.choices) {
            selectFields[field.name] = field.options.choices.map((c: { name: string }) => c.name);
          }
        }

        console.log('Schema fetched, select fields:', Object.keys(selectFields));

        return new Response(JSON.stringify({ selectFields }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-pdf-url': {
        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch from Airtable to check if pdf_url exists
        const airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${contractId}`;
        console.log(`Checking PDF availability from Airtable: ${airtableUrl}`);

        const airtableResponse = await fetch(airtableUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!airtableResponse.ok) {
          const error = await airtableResponse.text();
          console.error('Airtable error:', airtableResponse.status, error);
          return new Response(
            JSON.stringify({ error: 'Failed to check PDF availability' }),
            { status: airtableResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const record = await airtableResponse.json();
        const pdfPath = record.fields?.pdf_url;
        const filename = record.fields?.filename;
        
        // Return whether PDF exists (pdfPath being non-null indicates PDF is available)
        return new Response(JSON.stringify({ 
          pdfPath: pdfPath ? true : null, // Just indicate availability, not the actual path
          filename: filename || null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'download-pdf': {
        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const complyflowApiKey = Deno.env.get('COMPLYFLOW_API_KEY');
        if (!complyflowApiKey) {
          console.error('COMPLYFLOW_API_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'ComplyFlow API not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch PDF from ComplyFlow API
        const pdfUrl = `https://complyflow-production.up.railway.app/contracts/${contractId}/pdf`;
        console.log(`Fetching PDF from ComplyFlow API: ${pdfUrl}`);

        const pdfResponse = await fetch(pdfUrl, {
          headers: {
            'X-API-Key': complyflowApiKey,
          },
        });

        if (!pdfResponse.ok) {
          if (pdfResponse.status === 404) {
            return new Response(
              JSON.stringify({ error: 'PDF not found. This contract may have been uploaded before PDF storage was enabled.' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          const error = await pdfResponse.text();
          console.error('ComplyFlow PDF error:', pdfResponse.status, error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch PDF' }),
            { status: pdfResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get the PDF blob and headers
        const pdfBlob = await pdfResponse.blob();
        const contentDisposition = pdfResponse.headers.get('Content-Disposition') || 'inline; filename="contract.pdf"';
        
        console.log(`Serving PDF, size: ${pdfBlob.size} bytes`);

        // Return the PDF with proper headers
        return new Response(pdfBlob, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/pdf',
            'Content-Disposition': contentDisposition,
          },
        });
      }

      case 'get': {
        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const complyflowApiKey = Deno.env.get('COMPLYFLOW_API_KEY');
        if (!complyflowApiKey) {
          console.error('COMPLYFLOW_API_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'ComplyFlow API not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const getUrl = `https://complyflow-production.up.railway.app/contracts/${contractId}`;
        console.log(`Fetching contract via ComplyFlow API: ${getUrl}`);

        const response = await fetch(getUrl, {
          headers: {
            'X-API-Key': complyflowApiKey,
          },
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('ComplyFlow API error:', response.status, error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch contract' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const record = await response.json();
        console.log(`Fetched contract: ${record.id}`);

        // Transform to expected format
        const result = {
          id: record.id,
          fields: record.fields,
          created_time: record.created_time,
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

        const complyflowApiKey = Deno.env.get('COMPLYFLOW_API_KEY');
        if (!complyflowApiKey) {
          console.error('COMPLYFLOW_API_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'ComplyFlow API not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Use the reviewed value from request body, default to true
        const reviewed = requestBody?.reviewed !== undefined ? requestBody.reviewed : true;

        const reviewUrl = `https://complyflow-production.up.railway.app/contracts/${contractId}/review`;
        console.log(`Marking contract as reviewed=${reviewed} via ComplyFlow API: ${reviewUrl}`);

        const response = await fetch(reviewUrl, {
          method: 'PATCH',
          headers: {
            'X-API-Key': complyflowApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reviewed }),
        });

        console.log('Review response status:', response.status);

        if (!response.ok) {
          const error = await response.text();
          console.error('ComplyFlow API error:', response.status, error);
          return new Response(
            JSON.stringify({ error: 'Failed to mark contract as reviewed' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await response.json();
        console.log('Mark reviewed successful:', result);

        return new Response(JSON.stringify({ success: true, ...result }), {
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

        const complyflowApiKey = Deno.env.get('COMPLYFLOW_API_KEY');
        if (!complyflowApiKey) {
          console.error('COMPLYFLOW_API_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'ComplyFlow API not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const fieldName = requestBody?.field_name as string;
        const originalValue = requestBody?.original_value;
        const newValue = requestBody?.new_value;

        if (!fieldName) {
          return new Response(
            JSON.stringify({ error: 'Field name required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateUrl = `https://complyflow-production.up.railway.app/contracts/${contractId}/fields`;
        console.log(`Updating field ${fieldName} via ComplyFlow API: ${updateUrl}`);

        const response = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'X-API-Key': complyflowApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            field_name: fieldName,
            original_value: originalValue,
            new_value: newValue,
          }),
        });

        console.log('Update response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('ComplyFlow API update error:', response.status, errorText);
          return new Response(
            JSON.stringify({ error: `Failed to update field: ${errorText}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await response.json();
        console.log('Update successful:', result);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const complyflowApiKey = Deno.env.get('COMPLYFLOW_API_KEY');
        if (!complyflowApiKey) {
          console.error('COMPLYFLOW_API_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'ComplyFlow API not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Deleting contract ${contractId} via ComplyFlow API...`);
        const deleteUrl = `https://complyflow-production.up.railway.app/contracts/${contractId}`;
        console.log('Delete URL:', deleteUrl);

        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'X-API-Key': complyflowApiKey,
          },
        });

        console.log('Delete response status:', deleteResponse.status);

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          console.error('ComplyFlow API delete error:', deleteResponse.status, errorText);
          return new Response(
            JSON.stringify({ error: `Delete failed: ${errorText}` }),
            { status: deleteResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const deleteResult = await deleteResponse.json();
        console.log('Delete successful:', deleteResult);

        return new Response(JSON.stringify({ success: true, id: contractId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-citations': {
        if (!contractId) {
          return new Response(
            JSON.stringify({ error: 'Contract ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const complyflowApiKey = Deno.env.get('COMPLYFLOW_API_KEY');
        if (!complyflowApiKey) {
          console.error('COMPLYFLOW_API_KEY not configured');
          return new Response(
            JSON.stringify({ error: 'ComplyFlow API not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const citationsUrl = `https://complyflow-production.up.railway.app/contracts/${contractId}/citations`;
        console.log(`Fetching citations via ComplyFlow API: ${citationsUrl}`);

        const response = await fetch(citationsUrl, {
          headers: {
            'X-API-Key': complyflowApiKey,
          },
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('ComplyFlow API citations error:', response.status, error);
          // Return empty citations with 200 status - citations are optional
          return new Response(
            JSON.stringify({ citations: [] }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const citationsData = await response.json();
        console.log(`Fetched ${citationsData.citations?.length || 0} citations`);

        return new Response(JSON.stringify(citationsData), {
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
        const file = formData.get('file') as File;
        
        if (!file) {
          return new Response(
            JSON.stringify({ error: 'No file provided' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Uploading file to ComplyFlow API: ${file.name}`);

        // Send directly to ComplyFlow API for processing and storage
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
