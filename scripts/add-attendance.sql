alter table events add column if not exists attendance int;
update events set attendance = 340 where name = 'Kaunas · Feb 2026' and attendance is null;
update events set attendance = 508 where name = 'Vilnius · May 2026' and attendance is null;
update events set attendance = 440 where name = 'Kaunas · May 2026' and attendance is null;
