-- Remove the legacy videos.video_topic text column after topic normalization.

begin;

do $$
declare
  missing_topic_count integer;
begin
  with legacy_topics as (
    select distinct
      videos.id as video_id,
      btrim(split_topic.topic) as topic_name
    from public.videos
    cross join lateral regexp_split_to_table(
      coalesce(videos.video_topic, ''),
      ','
    ) as split_topic(topic)
    where nullif(btrim(split_topic.topic), '') is not null
  ),
  normalized_topics as (
    select
      video_topics.video_id,
      topics.name as topic_name
    from public.video_topics
    join public.topics on topics.id = video_topics.topic_id
  )
  select count(*)
  into missing_topic_count
  from legacy_topics
  left join normalized_topics
    on normalized_topics.video_id = legacy_topics.video_id
    and normalized_topics.topic_name = legacy_topics.topic_name
  where normalized_topics.video_id is null;

  if missing_topic_count > 0 then
    raise exception
      'Cannot drop videos.video_topic: % legacy topic assignments are missing from public.video_topics.',
      missing_topic_count;
  end if;
end;
$$;

drop trigger if exists videos_sync_video_topics on public.videos;

drop function if exists public.sync_video_topics_from_video_topic();

drop index if exists public.idx_videos_video_topic;

alter table public.videos
  drop column if exists video_topic;

commit;
