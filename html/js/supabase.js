// supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = "https://sdkrumvzefqgcrnomesm.supabase.co";
const SUPABASE_KEY = "sb_publishable_dGKp0d2Se_-jJz1JReK24A_Qfv4S5yE";

// 防止 SPA 重复创建
if (!window.supabaseClient) {
  window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log("Supabase client 已初始化 ✅");
} else {
  console.log("Supabase client 已存在，跳过初始化");
}
