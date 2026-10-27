import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The app can run in UI demo mode without Supabase credentials.
// Configure both variables before enabling real accounts or storing private data.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const isDemoMode = !supabase;
