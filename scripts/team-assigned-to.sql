alter table team_members add column if not exists assigned_to text;

-- Fix existing entries: separate role title from person name
update team_members
set name = 'Media Buyer', assigned_to = 'Mantas Galdikas'
where name = 'Mantas Galdikas' and department = 'Marketing';

update team_members
set name = 'Perf. Creative & Editor', assigned_to = 'Ignas Žakas'
where name = 'Ignas Žakas' and department = 'Marketing';
