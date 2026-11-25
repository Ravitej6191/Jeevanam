-- "Reset App Data" keeps the account but must remove everything the owner
-- entered. Earlier versions left loans (and their repayments) and uploaded
-- files behind. Runs as the caller (security invoker), so RLS and the storage
-- policy still limit it to the caller's own rows and files.
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

  delete from storage.objects
    where bucket_id = 'tenant-uploads' and (storage.foldername(name))[1] = auth.uid()::text;
end;
$$;

grant execute on function clear_app_data() to authenticated;
