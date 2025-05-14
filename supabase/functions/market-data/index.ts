import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    const url = new URL(req.url);
    const symbols = url.searchParams.get('symbols');
    const fromDate = url.searchParams.get('from_date');
    const toDate = url.searchParams.get('to_date');
    const timeframe = url.searchParams.get('timeframe');

    if (!symbols || !fromDate || !toDate || !timeframe) {
      throw new Error('Missing required parameters');
    }

    console.log('Fetching market data:', { symbols, fromDate, toDate, timeframe });

    const apiUrl = `https://test.neuix.host/api/market-data/get?from_date=${fromDate}&to_date=${toDate}&timeframe=${timeframe}&symbols=${symbols}`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`External API error: ${response.status}`);
    }

    // Get the raw text response
    const text = await response.text();

    // Return the raw text response with the correct content type
    return new Response(text, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain', // Changed to text/plain to preserve newlines
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    );
  }
});