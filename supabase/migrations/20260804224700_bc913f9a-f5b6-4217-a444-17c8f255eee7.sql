-- ===== Ajustes em tabelas existentes =====
ALTER TABLE public.canais ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.motivos_perda ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

ALTER TABLE public.jornadas ADD COLUMN IF NOT EXISTS data_perda date;
ALTER TABLE public.jornadas ADD COLUMN IF NOT EXISTS atingiu_fechamento boolean NOT NULL DEFAULT false;
ALTER TABLE public.jornadas ADD COLUMN IF NOT EXISTS atingiu_contrato boolean NOT NULL DEFAULT false;
ALTER TABLE public.jornadas ADD COLUMN IF NOT EXISTS motivo_reabertura text;

UPDATE public.jornadas SET atingiu_fechamento = true
  WHERE data_fechamento IS NOT NULL OR etapa IN ('fechamento','contrato_assinado');
UPDATE public.jornadas SET atingiu_contrato = true WHERE etapa = 'contrato_assinado';

-- ===== Registro diário do funil =====
CREATE TABLE IF NOT EXISTS public.registros_diarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  consultor_id uuid NOT NULL REFERENCES public.consultores(id),
  leads integer NOT NULL DEFAULT 0 CHECK (leads >= 0),
  atendimentos integer NOT NULL DEFAULT 0 CHECK (atendimentos >= 0),
  agendamentos integer NOT NULL DEFAULT 0 CHECK (agendamentos >= 0),
  visitas integer NOT NULL DEFAULT 0 CHECK (visitas >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consultor_id, data)
);
GRANT SELECT, INSERT, UPDATE ON public.registros_diarios TO anon, authenticated;
GRANT ALL ON public.registros_diarios TO service_role;
ALTER TABLE public.registros_diarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY registros_read ON public.registros_diarios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY registros_insert ON public.registros_diarios FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY registros_update ON public.registros_diarios FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER registros_diarios_updated_at BEFORE UPDATE ON public.registros_diarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Pré leads (nível empresa) =====
CREATE TABLE IF NOT EXISTS public.pre_leads_diarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  quantidade integer NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.pre_leads_diarios TO anon, authenticated;
GRANT ALL ON public.pre_leads_diarios TO service_role;
ALTER TABLE public.pre_leads_diarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY pre_leads_read ON public.pre_leads_diarios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pre_leads_insert ON public.pre_leads_diarios FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY pre_leads_update ON public.pre_leads_diarios FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER pre_leads_updated_at BEFORE UPDATE ON public.pre_leads_diarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Metas por ciclo / equipe / consultor =====
CREATE TABLE IF NOT EXISTS public.metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES public.ciclos(id) ON DELETE CASCADE,
  equipe_id uuid REFERENCES public.equipes(id),
  consultor_id uuid REFERENCES public.consultores(id),
  meta_vgl numeric NOT NULL DEFAULT 0,
  meta_contratos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS metas_ciclo_equipe_uk
  ON public.metas (ciclo_id, equipe_id) WHERE consultor_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS metas_ciclo_consultor_uk
  ON public.metas (ciclo_id, consultor_id) WHERE consultor_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas TO anon, authenticated;
GRANT ALL ON public.metas TO service_role;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY metas_open ON public.metas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER metas_updated_at BEFORE UPDATE ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Motivos de transferência =====
CREATE TABLE IF NOT EXISTS public.motivos_transferencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.motivos_transferencia TO anon, authenticated;
GRANT ALL ON public.motivos_transferencia TO service_role;
ALTER TABLE public.motivos_transferencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY motivos_transf_read ON public.motivos_transferencia FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY motivos_transf_insert ON public.motivos_transferencia FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY motivos_transf_update ON public.motivos_transferencia FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ===== Auditoria =====
CREATE TABLE IF NOT EXISTS public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL,
  entidade_id uuid,
  referencia text,
  acao text NOT NULL,
  campo text,
  valor_anterior text,
  valor_novo text,
  justificativa text,
  usuario text NOT NULL DEFAULT 'Gestão',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auditoria_created_idx ON public.auditoria (created_at DESC);
GRANT SELECT, INSERT ON public.auditoria TO anon, authenticated;
GRANT ALL ON public.auditoria TO service_role;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY auditoria_read ON public.auditoria FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY auditoria_insert ON public.auditoria FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ===== Dados iniciais =====
INSERT INTO public.motivos_transferencia (nome) VALUES
  ('Desligamento do consultor'),
  ('Redistribuição de carteira'),
  ('Solicitação do cliente'),
  ('Ajuste operacional'),
  ('Outro')
ON CONFLICT DO NOTHING;

INSERT INTO public.motivos_perda (nome)
SELECT m.nome FROM (VALUES
  ('Cliente perdeu interesse no imóvel'),
  ('Demora no processo de fechamento'),
  ('Cliente reprovado por falta de renda'),
  ('Cliente reprovado por falta de informações'),
  ('Cliente encontrou outro imóvel'),
  ('Proprietário não aprovou'),
  ('Outro')
) AS m(nome)
WHERE NOT EXISTS (SELECT 1 FROM public.motivos_perda p WHERE p.nome = m.nome);

-- metas por equipe no ciclo aberto + distribuição igual entre consultores ativos
INSERT INTO public.metas (ciclo_id, equipe_id, meta_vgl, meta_contratos)
SELECT c.id, e.id, 60000, 12
FROM public.ciclos c
CROSS JOIN public.equipes e
WHERE c.status = 'aberto'
ON CONFLICT DO NOTHING;

INSERT INTO public.metas (ciclo_id, equipe_id, consultor_id, meta_vgl, meta_contratos)
SELECT m.ciclo_id, m.equipe_id, co.id,
       ROUND(m.meta_vgl / GREATEST(cnt.total, 1), 2),
       CEIL(m.meta_contratos::numeric / GREATEST(cnt.total, 1))
FROM public.metas m
JOIN public.consultores co ON co.equipe_id = m.equipe_id AND co.ativo
JOIN (
  SELECT equipe_id, COUNT(*) AS total FROM public.consultores WHERE ativo GROUP BY equipe_id
) cnt ON cnt.equipe_id = m.equipe_id
WHERE m.consultor_id IS NULL
ON CONFLICT DO NOTHING;

-- registros diários de exemplo (últimos 10 dias, consultores ativos)
INSERT INTO public.registros_diarios (data, consultor_id, leads, atendimentos, agendamentos, visitas)
SELECT d::date, co.id,
       6 + (random() * 6)::int,
       4 + (random() * 5)::int,
       2 + (random() * 3)::int,
       1 + (random() * 3)::int
FROM generate_series(CURRENT_DATE - INTERVAL '9 days', CURRENT_DATE, INTERVAL '1 day') d
CROSS JOIN public.consultores co
WHERE co.ativo
ON CONFLICT (consultor_id, data) DO NOTHING;

INSERT INTO public.pre_leads_diarios (data, quantidade)
SELECT d::date, 20 + (random() * 25)::int
FROM generate_series(CURRENT_DATE - INTERVAL '9 days', CURRENT_DATE, INTERVAL '1 day') d
ON CONFLICT (data) DO NOTHING;

INSERT INTO public.auditoria (entidade, acao, referencia, justificativa, usuario)
VALUES ('sistema', 'implantacao', 'Versão completa', 'Carga inicial de metas, registros diários e pré leads', 'Gestão');