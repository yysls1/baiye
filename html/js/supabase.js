// supabase.js
const SUPABASE_URL = "https://sdkrumvzefqgcrnomesm.supabase.co";
const SUPABASE_KEY = "sb_publishable_dGKp0d2Se_-jJz1JReK24A_Qfv4S5yE";

// 等官方 supabase.min.js 加载完后再创建 client
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Supabase client 已初始化 ✅");
