-- Supabase blocks deleting from storage.objects with plain SQL (the
-- protect_objects_delete trigger), so the two functions below failed whenever
-- they reached that step. Uploaded files are now removed from the app through
-- the Storage API instead; these functions only handle the database rows.

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
  delete from loans where building_id = v_building_id;
  delete from expenses where building_id = v_building_id;
  delete from construction_expenses where building_id = v_building_id;
  delete from incomes where building_id = v_building_id;
  delete from inventory where building_id = v_building_id;
  delete from activities where building_id = v_building_id;
  delete from notifications where building_id = v_building_id;
  delete from broadcasts where building_id = v_building_id;
end;
$$;

grant execute on function clear_app_data() to authenticated;

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

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function delete_account() from public;
grant execute on function delete_account() to authenticated;
