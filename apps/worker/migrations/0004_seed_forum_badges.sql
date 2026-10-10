-- Forum boards (task 3.13) and badges (task 3.12). Idempotent.
INSERT INTO forum_boards (slug, name, description, position) VALUES
  ('show-and-tell', 'Show & Tell', 'Share what you built, finished or not.', 10),
  ('help', 'Help & Debugging', 'Stuck? Ask here. Mark the answer that solved it.', 20),
  ('collab-wanted', 'Collab Wanted', 'Find people to build with: art, backend, sound, testing.', 30),
  ('prompts-and-workflows', 'Prompts & Workflows', 'Prompts, agent setups and workflows that worked (or didn''t).', 40),
  ('free-alternatives', 'Free Alternatives Requests', 'Is there an open version of X? Ask, or point people to one.', 50),
  ('site-ideas', 'Feature Ideas for the site', 'How should this place work? Suggestions welcome.', 60),
  ('off-topic', 'Off-topic', 'Everything else. Be kind.', 70)
ON CONFLICT(slug) DO UPDATE SET name = excluded.name, description = excluded.description, position = excluded.position;
--> statement-breakpoint
INSERT INTO badges (key, name, description, icon_key) VALUES
  ('first-fork', 'First Fork', 'Continued someone else''s project for the first time.', 'badge-first-fork'),
  ('most-forked', 'Most Forked', 'A project of yours was forked by 10 different people on the site.', 'badge-most-forked'),
  ('bug-squasher', 'Bug Squasher', 'Moved 10 Studio cards out of Bug fix.', 'badge-bug-squasher'),
  ('helper', 'Helper', 'Five of your forum replies were marked as the solution.', 'badge-helper'),
  ('collab-champion', 'Collab Champion', 'Five of your collab requests were accepted.', 'badge-collab-champion'),
  ('streak-7', '7-day Streak', 'Active on the site seven days in a row.', 'badge-streak-7')
ON CONFLICT(key) DO UPDATE SET name = excluded.name, description = excluded.description, icon_key = excluded.icon_key;
