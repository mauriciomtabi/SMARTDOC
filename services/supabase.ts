import { createClient } from '@supabase/supabase-js';

// --- INSTRUÇÕES SQL PARA O SUPABASE ---
/*
  Execute este bloco COMPLETO no "SQL Editor" do Supabase para configurar o banco.

  === MIGRAÇÕES E NOVAS TABELAS ===
  
  -- 7. Tabela de Configurações do Usuário (NOVO)
  create table if not exists user_settings (
    user_id uuid references auth.users not null primary key,
    has_seen_onboarding boolean default false,
    updated_at bigint
  );
  alter table user_settings enable row level security;
  create policy "Users can select own settings" on user_settings for select using (auth.uid() = user_id);
  create policy "Users can insert own settings" on user_settings for insert with check (auth.uid() = user_id);
  create policy "Users can update own settings" on user_settings for update using (auth.uid() = user_id);

*/

const supabaseUrl = 'https://vykaitonxzchslzpmpis.supabase.co';
const supabaseKey = 'sb_publishable_8yQgphtP9IeZDxopAup-PA_lyr513LH';

export const supabase = createClient(supabaseUrl, supabaseKey);