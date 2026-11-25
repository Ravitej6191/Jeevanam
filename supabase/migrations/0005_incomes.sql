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
