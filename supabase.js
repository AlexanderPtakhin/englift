import { createClient } from '@supabase/supabase-js';

console.log('[SUPABASE] Инициализация клиента...');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE] ❌ Отсутствуют переменные окружения!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('[SUPABASE] ✅ Клиент создан');
