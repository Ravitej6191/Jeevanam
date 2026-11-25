-- Optional receipt photos on loan repayments.
alter table loan_repayments
  add column if not exists receipt_urls text[] not null default '{}';
