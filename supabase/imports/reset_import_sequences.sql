-- Run after importing CSV files with explicit id values.

select setval(
  pg_get_serial_sequence('public.videos', 'id'),
  coalesce((select max(id) from public.videos), 1),
  exists(select 1 from public.videos)
);

select setval(
  pg_get_serial_sequence('public.topics', 'id'),
  coalesce((select max(id) from public.topics), 1),
  exists(select 1 from public.topics)
);
