import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://sdkrumvzefqgcrnomesm.supabase.co";
const SUPABASE_KEY = "sb_publishable_dGKp0d2Se_-jJz1JReK24A_Qfv4S5yE";


// SPA 单例
let supabase;

if (!window.supabaseClient) {
  window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log("Supabase client 已初始化 ✅");
}

supabase = window.supabaseClient;

export default supabase;