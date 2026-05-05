import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

let client = null;
let initError = "";

if (hasSupabaseEnv) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    initError = error?.message || "Supabase 初始化失敗";
  }
}

export const supabase = client;
export const supabaseInitError = initError;
