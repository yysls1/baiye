// js/supabase.js

// 先检查 supabase 是否已加载
if (typeof supabase === "undefined") {
  console.error("Supabase JS 未加载，请检查 <script src='...supabase.min.js'></script> 的顺序");
} else {
  const SUPABASE_URL = "https://sdkrumvzefqgcrnomesm.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dGKp0d2Se_-jJz1JReK24A_Qfv4S5yE";

  // 全局 client
  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
