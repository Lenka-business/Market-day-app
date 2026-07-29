-- Market Day register: database setup
-- Paste this whole file into Supabase's SQL Editor and click "Run".
-- It creates every table the app needs, in one go.

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text default '🏪',
  created_at timestamp default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null,
  cost numeric(10,2) default 0,
  stock_qty integer default 0,
  image_url text,
  category text,
  created_at timestamp default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  name text,
  suburb text,
  age_range text,
  notes text,
  created_at timestamp default now()
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  customer_id uuid references customers(id),
  subtotal numeric(10,2),
  gst_amount numeric(10,2),
  total numeric(10,2),
  cash_given numeric(10,2),
  change_given numeric(10,2),
  sold_at timestamp default now()
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete cascade,
  product_id uuid references products(id),
  product_name text,
  qty integer,
  unit_price numeric(10,2)
);

-- Turn on Row Level Security, then add one simple open policy per table.
-- This is deliberately simple for a classroom project: anyone with your
-- app link can read and write. Do not put real personal data in here,
-- and do not share the link outside your class.
alter table businesses enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;

create policy "classroom access" on businesses for all using (true) with check (true);
create policy "classroom access" on products for all using (true) with check (true);
create policy "classroom access" on customers for all using (true) with check (true);
create policy "classroom access" on sales for all using (true) with check (true);
create policy "classroom access" on sale_items for all using (true) with check (true);

-- Two starter businesses so the app isn't empty on first load.
insert into businesses (name, icon) values
  ('Sweet Treats Co.', '🧁'),
  ('Bright Threads', '🧵');
