// supabase/functions/rates/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET: Fetch rates
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['exchange_rate_zar', 'exchange_rate_usd']);

      if (error) throw error;

      const rates: Record<string, string> = {};
      data?.forEach((item: any) => {
        rates[item.key] = item.value;
      });

      return new Response(
        JSON.stringify({ success: true, rates }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST: Update rates (admin only)
    if (req.method === 'POST') {
      const body = await req.json();
      const { zar_rate, usd_rate } = body;

      // Update ZAR rate
      if (zar_rate) {
        await supabase
          .from('settings')
          .update({ value: zar_rate.toString(), updated_at: new Date().toISOString() })
          .eq('key', 'exchange_rate_zar');
      }

      // Update USD rate
      if (usd_rate) {
        await supabase
          .from('settings')
          .update({ value: usd_rate.toString(), updated_at: new Date().toISOString() })
          .eq('key', 'exchange_rate_usd');
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});