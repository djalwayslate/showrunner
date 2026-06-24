alter table team_members
  add column if not exists positions text[] default '{}',
  add column if not exists department text,
  add column if not exists context text;

-- migrate existing position -> positions array
update team_members set positions = ARRAY[position] where position is not null and position != '' and (positions is null or positions = '{}');
