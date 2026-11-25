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
