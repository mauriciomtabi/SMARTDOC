
-- ==============================================================================
-- SMARTDOC ORGANIZER - DATABASE SCHEMA
-- Copie e cole este conteúdo no "SQL Editor" do seu projeto Supabase.
-- ==============================================================================

-- 1. TABELA DE PASTAS (FOLDERS)
create table if not exists folders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  icon text, -- Emoji da pasta
  created_at bigint
);

-- Políticas de Segurança (RLS) para Pastas
alter table folders enable row level security;

create policy "Users can select own folders" on folders 
  for select using (auth.uid() = user_id);

create policy "Users can insert own folders" on folders 
  for insert with check (auth.uid() = user_id);

create policy "Users can update own folders" on folders 
  for update using (auth.uid() = user_id);

create policy "Users can delete own folders" on folders 
  for delete using (auth.uid() = user_id);


-- 2. TABELA DE DOCUMENTOS (DOCUMENTS)
create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  folder_id text,
  title text,
  category text,
  date text,
  summary text,
  key_values jsonb,
  image_url text,
  is_favorite boolean default false, -- Favoritos
  icon text,                         -- Ícone personalizado do documento
  created_at bigint
);

-- Políticas de Segurança (RLS) para Documentos
alter table documents enable row level security;

create policy "Users can select own documents" on documents 
  for select using (auth.uid() = user_id);

create policy "Users can insert own documents" on documents 
  for insert with check (auth.uid() = user_id);

create policy "Users can update own documents" on documents 
  for update using (auth.uid() = user_id);

create policy "Users can delete own documents" on documents 
  for delete using (auth.uid() = user_id);


-- 3. STORAGE (ARMAZENAMENTO DE IMAGENS)
insert into storage.buckets (id, name, public) 
values ('documents', 'documents', true)
on conflict (id) do nothing;

create policy "Users can upload own images" on storage.objects 
  for insert with check ( bucket_id = 'documents' and auth.uid() = owner );

create policy "Users can view own images" on storage.objects 
  for select using ( bucket_id = 'documents' and auth.uid() = owner );

create policy "Users can delete own images" on storage.objects 
  for delete using ( bucket_id = 'documents' and auth.uid() = owner );

-- 4. TABELA DE TRANSAÇÕES FINANCEIRAS
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  description text not null,
  amount numeric not null,
  type text not null, -- 'income' or 'expense'
  status text not null, -- 'paid' or 'pending'
  category text,
  payment_method text, 
  installments_info text, -- Novo campo para parcelamento (ex: '1/4')
  date text,
  created_at bigint
);

-- MIGRATION: Execute se a tabela já existir e estiver faltando a coluna
alter table transactions add column if not exists payment_method text;
alter table transactions add column if not exists installments_info text;

alter table transactions enable row level security;

create policy "Users can select own transactions" on transactions 
  for select using (auth.uid() = user_id);

create policy "Users can insert own transactions" on transactions 
  for insert with check (auth.uid() = user_id);

create policy "Users can update own transactions" on transactions 
  for update using (auth.uid() = user_id);

create policy "Users can delete own transactions" on transactions 
  for delete using (auth.uid() = user_id);

-- 5. TABELA DE CATEGORIAS DE TRANSAÇÕES
create table if not exists transaction_categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  created_at bigint
);

alter table transaction_categories enable row level security;

create policy "Users can select own categories" on transaction_categories 
  for select using (auth.uid() = user_id);

create policy "Users can insert own categories" on transaction_categories 
  for insert with check (auth.uid() = user_id);

create policy "Users can update own categories" on transaction_categories 
  for update using (auth.uid() = user_id);

create policy "Users can delete own categories" on transaction_categories 
  for delete using (auth.uid() = user_id);

-- 6. TABELA DE ANOTAÇÕES (NOTES)
create table if not exists notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  title text,
  content text,
  type text default 'text', -- 'text', 'audio', 'image'
  is_pinned boolean default false,
  tags text[],
  created_at bigint,
  updated_at bigint
);

alter table notes enable row level security;

create policy "Users can select own notes" on notes 
  for select using (auth.uid() = user_id);

create policy "Users can insert own notes" on notes 
  for insert with check (auth.uid() = user_id);

create policy "Users can update own notes" on notes 
  for update using (auth.uid() = user_id);

create policy "Users can delete own notes" on notes 
  for delete using (auth.uid() = user_id);

-- 7. TABELA DE CONFIGURAÇÕES DO USUÁRIO (USER_SETTINGS)
create table if not exists user_settings (
  user_id uuid references auth.users not null primary key,
  has_seen_onboarding boolean default false,
  updated_at bigint
);

alter table user_settings enable row level security;

create policy "Users can select own settings" on user_settings 
  for select using (auth.uid() = user_id);

create policy "Users can insert own settings" on user_settings 
  for insert with check (auth.uid() = user_id);

create policy "Users can update own settings" on user_settings 
  for update using (auth.uid() = user_id);
