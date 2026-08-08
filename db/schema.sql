-- VERITE admin panel schema. Idempotent: safe to run multiple times.
-- Run once against the real Vercel Postgres database (see README step in
-- the setup instructions) before the admin panel is usable.

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('perfumes','oleos-corporais','kits','novidades')),
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2),
  sale_price NUMERIC(10,2),
  volume TEXT,
  main_image_url TEXT,
  gallery_urls TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','lido','respondido')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faq_items (
  id SERIAL PRIMARY KEY,
  question TEXT UNIQUE NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_blocks (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  brand_name TEXT NOT NULL DEFAULT 'VERITÉ',
  instagram_url TEXT,
  whatsapp_number TEXT,
  contact_email TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS seo_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  site_title TEXT,
  meta_description TEXT,
  share_image_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seo_settings_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id SERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON admin_login_attempts (ip, attempted_at);

CREATE TABLE IF NOT EXISTS public_submission_attempts (
  id SERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  kind TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submission_attempts_ip_kind_time ON public_submission_attempts (ip, kind, attempted_at);

-- Seed: real content already live on the site today (nothing invented).
INSERT INTO content_blocks (key, label, value) VALUES
  ('slogan', 'Slogan (hero)', 'A verdade está na sua essência.'),
  ('hero_sub', 'Subtítulo do hero', 'Uma fragrância não é só um aroma — é presença, lembrança e verdade.'),
  ('historia_lead', 'Parágrafo de história (A VERITÉ)', 'A VERITÉ nasceu da ideia de que uma fragrância não serve apenas para perfumar. Ela <em>revela personalidade</em>, <em>desperta lembranças</em> e deixa uma <em>presença</em> que continua mesmo depois que a pessoa vai embora.'),
  ('essencia_1_title', 'Nossa Essência — item 1 (título)', 'Autenticidade'),
  ('essencia_1_desc', 'Nossa Essência — item 1 (descrição)', 'A verdade em cada gesto.'),
  ('essencia_2_title', 'Nossa Essência — item 2 (título)', 'Elegância'),
  ('essencia_2_desc', 'Nossa Essência — item 2 (descrição)', 'Sofisticação em cada detalhe.'),
  ('essencia_3_title', 'Nossa Essência — item 3 (título)', 'Qualidade'),
  ('essencia_3_desc', 'Nossa Essência — item 3 (descrição)', 'Excelência que se sente.'),
  ('essencia_4_title', 'Nossa Essência — item 4 (título)', 'Presença'),
  ('essencia_4_desc', 'Nossa Essência — item 4 (descrição)', 'Uma marca que permanece.'),
  ('essencia_5_title', 'Nossa Essência — item 5 (título)', 'Exclusividade'),
  ('essencia_5_desc', 'Nossa Essência — item 5 (descrição)', 'Único, como você.'),
  ('experiencia_tagline', 'Tagline de "Mais que uma fragrância"', 'Porque uma verdadeira essência não se usa — se vive.'),
  ('manifesto_lines', 'Linhas do Manifesto (uma por linha)', 'Não acreditamos que uma fragrância seja apenas algo que se usa.
Ela acompanha momentos.
Desperta memórias.
Revela personalidade.
Cria presença.
Algumas coisas desaparecem quando você vai embora.
Outras permanecem.'),
  ('colecao_title', 'Título da Primeira Coleção', 'A primeira coleção VERITÉ está chegando.'),
  ('colecao_tagline', 'Tagline da Primeira Coleção', 'Três expressões. Uma essência.'),
  ('lancamento_title', 'Título da Lista de Espera', 'Seja um dos primeiros a conhecer a VERITÉ.'),
  ('lancamento_sub', 'Subtítulo da Lista de Espera', 'Em breve, novidades diretamente para você.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO faq_items (question, answer, sort_order, active) VALUES
  ('O que é a VERITÉ?', 'A VERITÉ é uma casa de perfumaria dedicada a transformar fragrâncias em experiências. Acreditamos que um perfume é mais do que um aroma — é uma forma de expressar quem você é.', 1, true),
  ('Qual é a proposta da VERITÉ?', 'Queremos criar mais do que fragrâncias: experiências, lembranças, identidade e presença. Cada detalhe é pensado para ser autêntico, elegante e exclusivo.', 2, true),
  ('Quando será o lançamento?', 'Ainda não temos uma data definida. As novidades serão anunciadas pelos canais oficiais da VERITÉ.', 3, true),
  ('Como posso acompanhar as novidades?', 'Cadastre-se na nossa <a href="#lancamento">lista de espera</a> para ser um dos primeiros a saber quando a VERITÉ chegar.', 4, true),
  ('Como posso entrar em contato?', 'Você pode falar com a gente pela seção de <a href="#contato">Contato</a> logo abaixo, ou pelo WhatsApp já disponível por lá.', 5, true)
ON CONFLICT (question) DO NOTHING;

INSERT INTO site_settings (id, instagram_url, whatsapp_number, contact_email)
VALUES (1, NULL, '5581981553632', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO seo_settings (id, site_title, meta_description, share_image_url)
VALUES (1, 'VERITÉ — A verdade está na sua essência', 'Uma casa de perfumaria dedicada à autenticidade, elegância e exclusividade.', 'https://verite-web.vercel.app/assets/img/og-image.jpg')
ON CONFLICT (id) DO NOTHING;
