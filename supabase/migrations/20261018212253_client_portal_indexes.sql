create index jd_portal_customers_auth_user on public.jd_portal_customers(auth_user_id);
create index jd_portal_files_customer on public.jd_portal_files(customer_id);
create index jd_portal_quotes_order on public.jd_portal_quotes(requested_order_id);
