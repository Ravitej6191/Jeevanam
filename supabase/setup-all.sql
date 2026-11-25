-- ===== supabase/migrations/0001_init.sql =====
-- Jeevanam initial schema — single-building PG/hostel/dorm/rental management.
-- MVP scope: one building per owner. owner_id ties every root table back to
-- auth.uid() for row level security; child tables inherit scope via FK joins.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type property_type as enum ('pg', 'co_living', 'building', 'residency', 'apartment');
create type house_type as enum ('1bhk', '2bhk', '3bhk');
create type tenant_status as enum ('active', 'vacated');
create type rent_status as enum ('paid', 'partial', 'pending', 'advance');
create type payment_mode as enum ('cash', 'upi', 'bank_transfer', 'cheque');
create type lender_type as enum ('bank', 'society', 'dwakara', 'hand_cash', 'gold_loan', 'other');
create type expense_category as enum (
  'food', 'groceries', 'milk', 'vegetables', 'gas', 'electricity',
  'internet', 'cleaning', 'repairs', 'furniture', 'salary', 'misc'
);
create type inventory_category as enum (
  'kitchen', 'furniture', 'cleaning', 'appliances', 'gas_cylinders',
  'mattresses', 'beds', 'fans', 'buckets', 'water_cans', 'misc'
);

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- building (single row per owner in MVP)
-- ---------------------------------------------------------------------
create table building (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  property_type property_type not null default 'pg',
  address text,
  city text,
  state text,
  pincode text,
  contact_phone text,
  contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index building_owner_unique on building(owner_id);
create trigger building_set_updated_at before update on building
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- floors
-- ---------------------------------------------------------------------
create table floors (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id) on delete cascade,
  floor_number int not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (building_id, floor_number)
);

-- ---------------------------------------------------------------------
-- houses (a floor's individually rentable units — a tenant is assigned
-- directly to a house, up to its capacity; there is no further bed-level
-- subdivision)
-- ---------------------------------------------------------------------
create table houses (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references floors(id) on delete cascade,
  house_number text not null,
  house_type house_type not null default '1bhk',
  attached_bathroom boolean not null default false,
  gas_connection_number text,
  electricity_bill_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (floor_id, house_number)
);
create trigger houses_set_updated_at before update on houses
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- tenants (at most one active tenant per house)
-- ---------------------------------------------------------------------
create table tenants (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id) on delete cascade,
  house_id uuid references houses(id) on delete set null,
  name text not null,
  phone text not null,
  aadhaar_number text,
  address text,
  occupation text,
  photo_url text,
  joining_date date not null default current_date,
  vacating_date date,
  advance numeric(10, 2) not null default 0,
  deposit numeric(10, 2) not null default 0,
  rent numeric(10, 2) not null default 0,
  rent_status rent_status not null default 'pending',
  status tenant_status not null default 'active',
  notes text,
  deposit_paid_amount numeric(10, 2),
  deposit_paid_date date,
  deposit_screenshot_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index tenants_one_active_per_house on tenants(house_id)
  where status = 'active' and house_id is not null;
create trigger tenants_set_updated_at before update on tenants
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  amount numeric(10, 2) not null,
  payment_date date not null default current_date,
  payment_mode payment_mode not null default 'cash',
  for_month date not null,
  late_fee numeric(10, 2) not null default 0,
  discount numeric(10, 2) not null default 0,
  status rent_status not null default 'paid',
  receipt_number text,
  receipt_url text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- loans
-- ---------------------------------------------------------------------
create table loans (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id) on delete cascade,
  lender_type lender_type not null default 'bank',
  lender_name text,
  amount numeric(10, 2) not null,
  interest_note text,
  taken_on date not null default current_date,
  taken_till date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  amount numeric(10, 2) not null,
  payment_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id) on delete cascade,
  category expense_category not null,
  amount numeric(10, 2) not null,
  expense_date date not null default current_date,
  description text,
  invoice_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- inventory
-- ---------------------------------------------------------------------
create table inventory (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id) on delete cascade,
  category inventory_category not null,
  item_name text not null,
  quantity int not null default 0,
  low_stock_threshold int not null default 1,
  unit text not null default 'pcs',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger inventory_set_updated_at before update on inventory
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------
create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  doc_type text not null,
  file_url text not null,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- activities (append-only feed for the dashboard timeline)
-- ---------------------------------------------------------------------
create table activities (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  activity_type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- notifications (event-sourced feed backing the bell icon)
-- ---------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- broadcasts (WhatsApp broadcast send history)
-- ---------------------------------------------------------------------
create table broadcasts (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id) on delete cascade,
  message text not null,
  image_url text,
  audience text not null,
  recipient_count int not null default 0,
  delivered_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- settings (one row per owner)
-- ---------------------------------------------------------------------
create table settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text,
  onboarding_completed boolean not null default false,
  theme text not null default 'system',
  notifications_enabled boolean not null default true,
  rent_reminder_days_before int not null default 3,
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index settings_owner_unique on settings(owner_id);
create trigger settings_set_updated_at before update on settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security — every row is reachable only by its owner, via a
-- join back to building.owner_id (or settings.owner_id / building
-- directly for root tables).
-- ---------------------------------------------------------------------
alter table building enable row level security;
alter table floors enable row level security;
alter table houses enable row level security;
alter table tenants enable row level security;
alter table payments enable row level security;
alter table loans enable row level security;
alter table loan_repayments enable row level security;
alter table expenses enable row level security;
alter table inventory enable row level security;
alter table documents enable row level security;
alter table activities enable row level security;
alter table notifications enable row level security;
alter table broadcasts enable row level security;
alter table settings enable row level security;

create policy building_owner_all on building
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy floors_owner_all on floors
  for all using (
    exists (select 1 from building b where b.id = floors.building_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from building b where b.id = floors.building_id and b.owner_id = auth.uid())
  );

create policy houses_owner_all on houses
  for all using (
    exists (
      select 1 from floors f join building b on b.id = f.building_id
      where f.id = houses.floor_id and b.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from floors f join building b on b.id = f.building_id
      where f.id = houses.floor_id and b.owner_id = auth.uid()
    )
  );

create policy tenants_owner_all on tenants
  for all using (
    exists (select 1 from building b where b.id = tenants.building_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from building b where b.id = tenants.building_id and b.owner_id = auth.uid())
  );

create policy payments_owner_all on payments
  for all using (
    exists (
      select 1 from tenants t join building b on b.id = t.building_id
      where t.id = payments.tenant_id and b.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from tenants t join building b on b.id = t.building_id
      where t.id = payments.tenant_id and b.owner_id = auth.uid()
    )
  );

create policy loans_owner_all on loans
  for all using (
    exists (select 1 from building b where b.id = loans.building_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from building b where b.id = loans.building_id and b.owner_id = auth.uid())
  );

create policy loan_repayments_owner_all on loan_repayments
  for all using (
    exists (
      select 1 from loans l join building b on b.id = l.building_id
      where l.id = loan_repayments.loan_id and b.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from loans l join building b on b.id = l.building_id
      where l.id = loan_repayments.loan_id and b.owner_id = auth.uid()
    )
  );

create policy expenses_owner_all on expenses
  for all using (
    exists (select 1 from building b where b.id = expenses.building_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from building b where b.id = expenses.building_id and b.owner_id = auth.uid())
  );

create policy inventory_owner_all on inventory
  for all using (
    exists (select 1 from building b where b.id = inventory.building_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from building b where b.id = inventory.building_id and b.owner_id = auth.uid())
  );

create policy documents_owner_all on documents
  for all using (
    exists (
      select 1 from tenants t join building b on b.id = t.building_id
      where t.id = documents.tenant_id and b.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from tenants t join building b on b.id = t.building_id
      where t.id = documents.tenant_id and b.owner_id = auth.uid()
    )
  );

create policy activities_owner_all on activities
  for all using (
    exists (select 1 from building b where b.id = activities.building_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from building b where b.id = activities.building_id and b.owner_id = auth.uid())
  );

create policy notifications_owner_all on notifications
  for all using (
    exists (select 1 from building b where b.id = notifications.building_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from building b where b.id = notifications.building_id and b.owner_id = auth.uid())
  );

create policy broadcasts_owner_all on broadcasts
  for all using (
    exists (select 1 from building b where b.id = broadcasts.building_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from building b where b.id = broadcasts.building_id and b.owner_id = auth.uid())
  );

create policy settings_owner_all on settings
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- Storage — tenant photos and deposit screenshots. Uploaded to
-- `<owner_id>/<folder>/<file>` so a simple path-prefix check scopes every
-- read/write to the uploading owner. Bucket is public (public URLs are
-- returned to the client) since these are non-sensitive display images;
-- switch to signed URLs if that changes.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('tenant-uploads', 'tenant-uploads', true)
on conflict (id) do nothing;

create policy tenant_uploads_owner_all on storage.objects
  for all using (
    bucket_id = 'tenant-uploads' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'tenant-uploads' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- Indexes for common lookups
-- ---------------------------------------------------------------------
create index floors_building_id_idx on floors(building_id);
create index houses_floor_id_idx on houses(floor_id);
create index tenants_house_id_idx on tenants(house_id);
create index tenants_building_id_idx on tenants(building_id);
create index payments_tenant_id_idx on payments(tenant_id);
create index expenses_building_id_idx on expenses(building_id);
create index inventory_building_id_idx on inventory(building_id);
create index documents_tenant_id_idx on documents(tenant_id);
create index activities_building_id_idx on activities(building_id);
create index notifications_building_id_idx on notifications(building_id);
create index broadcasts_building_id_idx on broadcasts(building_id);

-- ===== supabase/migrations/0002_deposit_recorded_at.sql =====
-- Tracks the actual moment a deposit was recorded, separate from
-- deposit_paid_date (a plain calendar date the owner can backdate). Mirrors
-- payments.created_at / expenses.created_at, which already serve this role
-- for those record types.
alter table tenants add column deposit_recorded_at timestamptz;

-- ===== supabase/migrations/0003_clear_app_data_rpc.sql =====
-- Wraps "Clear App Data" in a single transaction so a failure partway
-- through (e.g. a dropped connection) can't leave the account half-wiped —
-- the previous client-side loop of 7 sequential deletes had no such
-- guarantee. Runs as the calling user (security invoker, the default),
-- so existing RLS policies still govern what it's allowed to touch.
create or replace function clear_app_data()
returns void
language plpgsql
as $$
declare
  v_building_id uuid;
begin
  select id into v_building_id from building where owner_id = auth.uid();
  if v_building_id is null then
    raise exception 'No building found for this account';
  end if;

  delete from floors where building_id = v_building_id;
  delete from tenants where building_id = v_building_id;
  delete from expenses where building_id = v_building_id;
  delete from inventory where building_id = v_building_id;
  delete from activities where building_id = v_building_id;
  delete from notifications where building_id = v_building_id;
  delete from broadcasts where building_id = v_building_id;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on new functions by default, but making
-- it explicit here means this works regardless of any project-level default
-- privilege changes on the Supabase side.
grant execute on function clear_app_data() to authenticated;

-- ===== supabase/migrations/0004_construction_expenses.sql =====
-- Home construction expense tracking — separate from the day-to-day
-- `expenses` table since construction spend (cement, labor, etc.) has its
-- own category set and is tracked as a standalone running total on the
-- dashboard rather than folded into monthly running costs.

create type construction_category as enum (
  'cement', 'steel', 'bricks', 'sand', 'labor', 'plumbing',
  'electrical', 'painting', 'tiles_flooring', 'doors_windows',
  'architect_design', 'misc'
);

create table construction_expenses (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id) on delete cascade,
  category construction_category not null,
  amount numeric(10, 2) not null,
  expense_date date not null default current_date,
  description text,
  invoice_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index construction_expenses_building_id_idx on construction_expenses(building_id);

alter table construction_expenses enable row level security;

create policy construction_expenses_owner_all on construction_expenses
  for all using (
    exists (select 1 from building b where b.id = construction_expenses.building_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from building b where b.id = construction_expenses.building_id and b.owner_id = auth.uid())
  );

create or replace function clear_app_data()
returns void
language plpgsql
as $$
declare
  v_building_id uuid;
begin
  select id into v_building_id from building where owner_id = auth.uid();
  if v_building_id is null then
    raise exception 'No building found for this account';
  end if;

  delete from floors where building_id = v_building_id;
  delete from tenants where building_id = v_building_id;
  delete from expenses where building_id = v_building_id;
  delete from construction_expenses where building_id = v_building_id;
  delete from inventory where building_id = v_building_id;
  delete from activities where building_id = v_building_id;
  delete from notifications where building_id = v_building_id;
  delete from broadcasts where building_id = v_building_id;
end;
$$;

-- ===== supabase/migrations/0005_incomes.sql =====
-- Non-tenant income (salary, business, interest, ...) — added to the
-- dashboard Income total and trend alongside tenant rent payments.

create type income_category as enum (
  'salary', 'business', 'interest', 'gift', 'refund', 'misc'
);

create table incomes (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id) on delete cascade,
  category income_category not null,
  amount numeric(10, 2) not null,
  income_date date not null default current_date,
  description text,
  created_at timestamptz not null default now()
);

create index incomes_building_id_idx on incomes(building_id);

alter table incomes enable row level security;

create policy incomes_owner_all on incomes
  for all using (
    exists (select 1 from building b where b.id = incomes.building_id and b.owner_id = auth.uid())
  ) with check (
    exists (select 1 from building b where b.id = incomes.building_id and b.owner_id = auth.uid())
  );

create or replace function clear_app_data()
returns void
language plpgsql
as $$
declare
  v_building_id uuid;
begin
  select id into v_building_id from building where owner_id = auth.uid();
  if v_building_id is null then
    raise exception 'No building found for this account';
  end if;

  delete from floors where building_id = v_building_id;
  delete from tenants where building_id = v_building_id;
  delete from expenses where building_id = v_building_id;
  delete from construction_expenses where building_id = v_building_id;
  delete from incomes where building_id = v_building_id;
  delete from inventory where building_id = v_building_id;
  delete from activities where building_id = v_building_id;
  delete from notifications where building_id = v_building_id;
  delete from broadcasts where building_id = v_building_id;
end;
$$;

-- ===== supabase/migrations/0006_delete_account_rpc.sql =====
-- Lets a signed-in user permanently delete their own account. Deleting the
-- auth.users row cascades to building (owner_id on delete cascade) and from
-- there to every record tied to it (floors, tenants, payments, loans,
-- expenses, incomes, ...), and to settings. security definer is required
-- because the client role can't touch the auth schema; it only ever deletes
-- the caller's own row (auth.uid()).
create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Uploaded photos/screenshots live under `<user id>/...` in storage and
  -- aren't covered by the row cascade.
  delete from storage.objects
    where bucket_id = 'tenant-uploads' and (storage.foldername(name))[1] = auth.uid()::text;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function delete_account() from public;
grant execute on function delete_account() to authenticated;

-- ===== supabase/migrations/0007_loan_repayment_receipts.sql =====
-- Optional receipt photos on loan repayments.
alter table loan_repayments
  add column if not exists receipt_urls text[] not null default '{}';


-- ===== supabase/migrations/0008_api_grants.sql =====
-- New Supabase projects can be created with "grant API access to new tables
-- automatically" switched off, in which case the signed-in role gets a 403 on
-- every table. These grants make the schema usable either way. Row level
-- security (see 0001) still limits each user to their own rows.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function clear_app_data() to authenticated;
grant execute on function delete_account() to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
