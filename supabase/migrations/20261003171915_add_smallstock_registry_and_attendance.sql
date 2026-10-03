create table if not exists public.farm_smallstock_registry (
  tag_id text primary key,
  species text not null check (species in ('goat', 'sheep')),
  is_active boolean not null default true,
  sex text check (sex in ('male', 'female', 'unknown')),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by text,
  updated_by text,
  source text not null default 'manual'
);

alter table public.farm_smallstock_registry drop constraint if exists farm_smallstock_registry_pkey;
alter table public.farm_smallstock_registry add primary key (species, tag_id);

create index if not exists idx_farm_smallstock_registry_species_active
  on public.farm_smallstock_registry (species, is_active, tag_id);

create table if not exists public.farm_smallstock_attendance (
  species text not null check (species in ('goat', 'sheep')),
  attendance_date date not null,
  present_tags text[] not null default '{}'::text[],
  present_count integer not null default 0 check (present_count >= 0),
  total_active integer check (total_active is null or total_active >= 0),
  recorded_at timestamptz not null default timezone('utc', now()),
  updated_by text,
  comment text,
  source text not null default 'manual',
  primary key (species, attendance_date)
);

create index if not exists idx_farm_smallstock_attendance_date
  on public.farm_smallstock_attendance (attendance_date desc, species);

alter table public.farm_smallstock_registry enable row level security;
alter table public.farm_smallstock_attendance enable row level security;
