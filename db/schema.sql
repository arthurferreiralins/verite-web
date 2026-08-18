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
  ('slogan', 'Slogan (hero)', 'Sua essência. Sua presença.'),
  ('hero_sub', 'Subtítulo do hero', 'Perfumes criados para deixar uma assinatura inesquecível.'),
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
  ('lancamento_title', 'Título da Lista de Espera', 'Seja um dos primeiros a conhecer as próximas criações da VERITÉ.'),
  ('lancamento_sub', 'Subtítulo da Lista de Espera', 'Um convite discreto para conhecer a VERITÉ antes de todos.')
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

-- ============================================================
-- Painel administrativo completo (2026-08-09): categorias, estoque,
-- campos de perfumaria, pedidos/clientes (estrutura pronta, vazios),
-- biblioteca de mídia, log de atividades, aparência. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO categories (name, slug, sort_order) VALUES
  ('Perfumes', 'perfumes', 1),
  ('Óleos Corporais', 'oleos-corporais', 2),
  ('Kits', 'kits', 3),
  ('Novidades', 'novidades', 4)
ON CONFLICT (slug) DO NOTHING;

-- products: solta os CHECKs antigos (categoria passa a validar contra a
-- tabela categories em código; status ganha o estado 'archived').
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check CHECK (status IN ('draft','published','archived'));

ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_stock BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS concentration TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS olfactory_family TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes_top TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes_heart TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes_base TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS occasion TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS intensity TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS longevity TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sillage TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS audience TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products (sku) WHERE sku IS NOT NULL AND sku <> '';

-- messages: ganha o status 'arquivado' (spec pede NOVA/LIDA/RESPONDIDA/ARQUIVADA).
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_status_check;
ALTER TABLE messages ADD CONSTRAINT messages_status_check CHECK (status IN ('novo','lido','respondido','arquivado'));

-- site_settings: identidade visual (aparência) + nome de exibição do admin
-- (login continua só por ADMIN_EMAIL/ADMIN_PASSWORD_HASH via env var — isto
-- é só um apelido de exibição no painel, não um sistema de usuários).
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS favicon_url TEXT;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS admin_display_name TEXT;
-- Bumped by "Encerrar outras sessões" em Minha Conta: um cookie de sessão só
-- é aceito se o "version" assinado nele bater com este valor (ver api/_lib/auth.js).
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

-- SEO individual por produto (opcional — cai no SEO global do site quando vazio).
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description TEXT;

CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  pathname TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  folder TEXT NOT NULL DEFAULT 'geral',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  description TEXT NOT NULL,
  admin_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC);

-- Pedidos e clientes: estrutura pronta para o futuro (seção 12/13/34/35 do
-- pedido) — nenhuma linha é inserida aqui, telas de admin mostram estado
-- vazio até existir um pedido/cliente real.
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  orders_count INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','confirmado','preparando','enviado','entregue','cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- ============================================================
-- Clube Verité (2026-08-14): área de membros integrada à loja.
-- customers ganha login real (password_hash) e vínculo com o clube;
-- club_codes é o sistema de convites (gerado no painel, um por cartão);
-- coupons/customer_coupons são os benefícios reais de cada membro;
-- favorites sincroniza com o catálogo (products) da própria loja.
-- Idempotente, como o restante deste arquivo.
-- ============================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS club_member BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS club_code_used TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS club_joined_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS club_codes (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','utilizado','bloqueado')),
  label TEXT NOT NULL DEFAULT '',
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_codes_status ON club_codes (status);
CREATE INDEX IF NOT EXISTS idx_club_codes_customer ON club_codes (customer_id);

CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  discount_label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  valid_until DATE,
  auto_grant BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_coupons (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','usado','expirado')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  UNIQUE (customer_id, coupon_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS club_exclusive BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS club_login_attempts (
  id SERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_login_attempts_ip_time ON club_login_attempts (ip, attempted_at);

CREATE TABLE IF NOT EXISTS club_code_attempts (
  id SERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_club_code_attempts_ip_time ON club_code_attempts (ip, attempted_at);

-- Cupom de boas-vindas: concedido automaticamente a todo novo membro
-- (auto_grant = true) no momento em que o código é ativado.
INSERT INTO coupons (name, code, discount_label, description, auto_grant, active) VALUES
  ('Boas-vindas ao Clube', 'VERITE10', '10% OFF', 'Um agradecimento por fazer parte do Clube Verité.', true, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Produção e Estoque (2026-08-16): matérias-primas/frascos/embalagens
-- (inventory_items), lotes de produção (production_batches, código
-- VT-LD-XXX), movimentações de entrada/saída (stock_movements, cobre
-- tanto inventory_items quanto products) e custo/lucro por perfume
-- (novas colunas cost_* em products). Idempotente, como o resto do arquivo.
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('materia_prima','frasco','embalagem')),
  subtype TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un' CHECK (unit IN ('ml','un')),
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(10,4) NOT NULL DEFAULT 0,
  min_threshold NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_items_type ON inventory_items (type);

-- product_id é NOT NULL de propósito: todo lote pertence a um produto já
-- cadastrado em `products` (o formulário de produção escolhe entre os
-- perfumes existentes, não cria produto novo). ON DELETE RESTRICT evita
-- apagar um produto que tenha histórico de lotes por engano.
CREATE TABLE IF NOT EXISTS production_batches (
  id SERIAL PRIMARY KEY,
  lote_code TEXT UNIQUE NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  perfume_name TEXT NOT NULL,
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  essence_item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
  essence_name TEXT NOT NULL DEFAULT '',
  essence_ml NUMERIC(12,2) NOT NULL DEFAULT 0,
  base_item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
  base_name TEXT NOT NULL DEFAULT '',
  base_ml NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_ingredients JSONB NOT NULL DEFAULT '[]',
  total_volume_ml NUMERIC(12,2) NOT NULL DEFAULT 0,
  bottle_size_ml NUMERIC(12,2) NOT NULL DEFAULT 0,
  bottle_item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
  bottle_name TEXT NOT NULL DEFAULT '',
  bottle_count INTEGER NOT NULL DEFAULT 0,
  production_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'produzindo' CHECK (status IN ('produzindo','macerando','pronto','esgotado')),
  -- Garante que os frascos deste lote só entram no estoque do produto uma
  -- única vez, no momento em que o status chega a "pronto" (evita crédito
  -- duplicado se o status for alternado depois).
  stock_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_production_batches_product ON production_batches (product_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_status ON production_batches (status);

-- item_id não é FK de propósito (mesmo padrão de "log de auditoria" de
-- activity_logs): o histórico deve continuar legível mesmo se o item de
-- estoque referenciado for excluído depois, por isso item_name é uma cópia.
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('inventory','product')),
  item_id INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('entrada','saida')),
  quantity NUMERIC(12,2) NOT NULL,
  previous_stock NUMERIC(12,2) NOT NULL,
  new_stock NUMERIC(12,2) NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  admin_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements (item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements (created_at DESC);

-- Custo por perfume (seção "Custos e lucro" do painel) — somados formam o
-- custo total; lucro/margem são calculados em código a partir de price/sale_price.
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_essence NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_base NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_bottle NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_cap NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_label NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_packaging NUMERIC(10,2) NOT NULL DEFAULT 0;

-- ============================================================
-- Reformulação e-commerce (2026-08-18): loja pública ganha vitrines,
-- filtros, busca, favoritos abertos e carrinho (checkout real fica pra
-- depois). "audience" é reaproveitada como gênero (Feminino/Masculino/
-- Unissex) no painel — sem migração nova pra isso. bestseller/
-- limited_edition seguem o mesmo padrão de featured/club_exclusive.
-- "Presentes" vira categoria própria, ao lado das 4 já existentes.
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS bestseller BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS limited_edition BOOLEAN NOT NULL DEFAULT false;

INSERT INTO categories (name, slug, sort_order) VALUES
  ('Presentes', 'presentes', 5)
ON CONFLICT (slug) DO NOTHING;
