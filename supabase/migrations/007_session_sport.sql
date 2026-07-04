-- Sessions carry their own sport (a football group can still book a cricket
-- night). Null means "inherit the group's sport" — old rows keep working.
alter table sessions add column sport text;
