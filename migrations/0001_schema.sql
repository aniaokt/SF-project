CREATE TABLE courses (
  code TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
  department TEXT, credits REAL, terms TEXT,          -- JSON array
  prereqs TEXT, fulfills TEXT,                        -- JSON
  embedding BLOB   -- 768 × float32. Decode as new Float32Array(new Uint8Array(v).buffer)
);
CREATE TABLE postings (
  id TEXT PRIMARY KEY, company TEXT NOT NULL, title TEXT NOT NULL,
  url TEXT, full_text TEXT NOT NULL, scraped_at TEXT
);
CREATE TABLE skills (
  id TEXT PRIMARY KEY, company TEXT NOT NULL, label TEXT NOT NULL,
  aliases TEXT, weight REAL NOT NULL, evidence TEXT,  -- JSON: [{posting_id, quote}]
  embedding BLOB
);
CREATE TABLE requirements (
  id TEXT PRIMARY KEY, program TEXT NOT NULL, label TEXT NOT NULL,
  rule TEXT NOT NULL                                  -- JSON: {n_of: 3, from: [...]}
);
CREATE TABLE llm_cache (
  key TEXT PRIMARY KEY, response TEXT NOT NULL, created_at TEXT
);
CREATE INDEX idx_courses_dept ON courses(department);
CREATE INDEX idx_postings_company ON postings(company);
CREATE INDEX idx_skills_company ON skills(company);
