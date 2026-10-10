-- Full-text index for project search (task 1.2). Kept in sync by syncProjectSearch().
CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
  project_id UNINDEXED,
  name,
  tagline,
  description,
  tags,
  replaces,
  readme,
  tokenize = 'unicode61 remove_diacritics 2'
);
