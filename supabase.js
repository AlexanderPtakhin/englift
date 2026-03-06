import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mlkrswxakzpbbzwtvzeh.supabase.co'
const supabaseAnonKey = 'sb_publishable_sX7-Yj4LLnQweRdf3txECA_7GUrRsNu'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)