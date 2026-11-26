-- Inspection becomes its own section, turned on per agency in Paramètres,
-- with two ways to work: photos (8 views, AI comparison) or one walk-around video.

alter table public.agencies
  add column inspection_enabled boolean not null default false,
  add column inspection_mode text not null default 'photos' check (inspection_mode in ('photos', 'video'));

-- Each inspection keeps the mode it was made with (the return follows the departure).
alter table public.inspections
  add column mode text not null default 'photos' check (mode in ('photos', 'video')),
  add column video_path text check (char_length(video_path) <= 300),
  add constraint inspections_video_path check (video_path is null or split_part(video_path, '/', 1) = agency_id::text);
