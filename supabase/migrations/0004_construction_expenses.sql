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
