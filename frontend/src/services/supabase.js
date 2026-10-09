import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://paodzwjogoktxedsegvb.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhb2R6d2pvZ29rdHhlZHNlZ3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0OTgyNzYsImV4cCI6MjEwNzA3NDI3Nn0.eBr1Qix1deAco-2wFkR-mU7X2a6gJVOI9b4e46NdQHI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const checkSupabaseDirectStatus = async () => {
  try {
    const { data, error } = await supabase.from('disasters').select('id').limit(1);
    if (error) {
      return {
        supabase_configured: true,
        supabase_connected: false,
        mode: 'Supabase Error: ' + error.message,
        supabase_url: SUPABASE_URL,
      };
    }
    return {
      supabase_configured: true,
      supabase_connected: true,
      mode: 'Live Supabase Cloud PostgreSQL',
      supabase_url: SUPABASE_URL,
      message: 'Successfully connected directly to Supabase Cloud Database.'
    };
  } catch (err) {
    return {
      supabase_configured: true,
      supabase_connected: false,
      mode: 'Supabase Offline',
      error: err?.message || 'Connection timeout',
    };
  }
};
