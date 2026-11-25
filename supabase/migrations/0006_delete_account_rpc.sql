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
