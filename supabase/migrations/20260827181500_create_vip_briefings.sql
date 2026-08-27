create table if not exists public.vip_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  support_id uuid not null unique references public.supports(id) on delete cascade,
  promotion_goal text not null,
  scene_idea text not null,
  product_or_material text,
  additional_notes text,
  terms_accepted boolean not null default false,
  status text not null default 'submitted',
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vip_briefings_promotion_goal_length check (char_length(promotion_goal) between 3 and 1000),
  constraint vip_briefings_scene_idea_length check (char_length(scene_idea) between 20 and 4000),
  constraint vip_briefings_product_length check (product_or_material is null or char_length(product_or_material) <= 1000),
  constraint vip_briefings_notes_length check (additional_notes is null or char_length(additional_notes) <= 2000),
  constraint vip_briefings_terms_required check (terms_accepted = true),
  constraint vip_briefings_status_valid check (status in ('submitted','in_review','approved','change_requested'))
);

create index if not exists vip_briefings_user_id_idx on public.vip_briefings (user_id);

alter table public.vip_briefings enable row level security;

revoke all on table public.vip_briefings from anon, authenticated;
grant all on table public.vip_briefings to service_role;

comment on table public.vip_briefings is 'Briefing privado da cena promocional de apoiadores VIP; acesso somente pelas Edge Functions autenticadas.';
comment on column public.vip_briefings.scene_idea is 'Descrição de como o apoiador VIP imagina sua inserção promocional ao final do episódio.';
