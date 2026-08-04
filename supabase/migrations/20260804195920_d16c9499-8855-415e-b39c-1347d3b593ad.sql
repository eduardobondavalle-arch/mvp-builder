CREATE TABLE public.equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipes TO anon, authenticated;
GRANT ALL ON public.equipes TO service_role;
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipes_open" ON public.equipes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.consultores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  equipe_id uuid REFERENCES public.equipes(id),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultores TO anon, authenticated;
GRANT ALL ON public.consultores TO service_role;
ALTER TABLE public.consultores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consultores_open" ON public.consultores FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.canais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.canais TO anon, authenticated;
GRANT ALL ON public.canais TO service_role;
ALTER TABLE public.canais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "canais_open" ON public.canais FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.motivos_perda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motivos_perda TO anon, authenticated;
GRANT ALL ON public.motivos_perda TO service_role;
ALTER TABLE public.motivos_perda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "motivos_open" ON public.motivos_perda FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ciclos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  status text NOT NULL DEFAULT 'aberto',
  meta_vgl numeric NOT NULL DEFAULT 0,
  meta_contratos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ciclos TO anon, authenticated;
GRANT ALL ON public.ciclos TO service_role;
ALTER TABLE public.ciclos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ciclos_open" ON public.ciclos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome text NOT NULL,
  cpf text NOT NULL,
  telefone text NOT NULL,
  consultor_id uuid NOT NULL REFERENCES public.consultores(id),
  canal_id uuid NOT NULL REFERENCES public.canais(id),
  data_primeiro_contato date NOT NULL,
  data_entrada_crm date NOT NULL,
  data_visita date NOT NULL,
  data_proposta date NOT NULL,
  imovel text NOT NULL,
  valor_original numeric NOT NULL,
  valor_proposta numeric NOT NULL,
  percentual_intermediacao numeric NOT NULL,
  etapa text NOT NULL DEFAULT 'proposta',
  data_fechamento date,
  valor_atualizado numeric,
  data_envio_contrato date,
  data_assinatura date,
  valor_final numeric,
  motivo_perda_id uuid REFERENCES public.motivos_perda(id),
  descricao_perda text,
  justificativa_nova_jornada text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jornadas TO anon, authenticated;
GRANT ALL ON public.jornadas TO service_role;
ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jornadas_open" ON public.jornadas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.jornada_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id uuid NOT NULL REFERENCES public.jornadas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  etapa_anterior text,
  etapa_nova text,
  justificativa text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.jornada_eventos TO anon, authenticated;
GRANT ALL ON public.jornada_eventos TO service_role;
ALTER TABLE public.jornada_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eventos_read" ON public.jornada_eventos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "eventos_insert" ON public.jornada_eventos FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER jornadas_updated_at BEFORE UPDATE ON public.jornadas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.equipes (id, nome) VALUES
 ('11111111-1111-1111-1111-111111111111','Balneário Camboriú'),
 ('22222222-2222-2222-2222-222222222222','Itapema');

INSERT INTO public.consultores (id, nome, equipe_id) VALUES
 ('a1111111-1111-1111-1111-111111111111','Marina Duarte','11111111-1111-1111-1111-111111111111'),
 ('a2222222-2222-2222-2222-222222222222','Rafael Nogueira','11111111-1111-1111-1111-111111111111'),
 ('a3333333-3333-3333-3333-333333333333','Camila Prado','22222222-2222-2222-2222-222222222222'),
 ('a4444444-4444-4444-4444-444444444444','Diego Alencar','22222222-2222-2222-2222-222222222222');

INSERT INTO public.canais (id, nome) VALUES
 ('c1111111-1111-1111-1111-111111111111','Laís (IA)'),
 ('c2222222-2222-2222-2222-222222222222','Indicação'),
 ('c3333333-3333-3333-3333-333333333333','Portal Imobiliário'),
 ('c4444444-4444-4444-4444-444444444444','Instagram');

INSERT INTO public.motivos_perda (nome) VALUES
 ('Cliente perdeu interesse no imóvel'),
 ('Imóvel locado para outro cliente'),
 ('Reprovado no cadastro'),
 ('Sem retorno do cliente'),
 ('Valor acima do orçamento');

INSERT INTO public.ciclos (nome, data_inicio, data_fim, status, meta_vgl, meta_contratos) VALUES
 ('Ciclo Ago/2026','2026-07-26','2026-08-25','aberto',180000,40),
 ('Ciclo Jul/2026','2026-06-26','2026-07-25','encerrado',160000,36);

INSERT INTO public.jornadas (cliente_nome, cpf, telefone, consultor_id, canal_id, data_primeiro_contato, data_entrada_crm, data_visita, data_proposta, imovel, valor_original, valor_proposta, percentual_intermediacao, etapa, data_fechamento, valor_atualizado, data_envio_contrato, data_assinatura, valor_final) VALUES
 ('Ana Beatriz Souza','012.345.678-90','(47) 99811-2233','a1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','2026-07-28','2026-07-28','2026-07-30','2026-07-31','Ed. Aurora, apto 802',5200,5000,50,'contrato_assinado','2026-08-01',4900,'2026-08-02','2026-08-03',4800),
 ('Carlos Menezes','123.456.789-01','(47) 99722-4411','a2222222-2222-2222-2222-222222222222','c3333333-3333-3333-3333-333333333333','2026-07-27','2026-07-28','2026-07-29','2026-07-30','Res. Vila Nova, casa 3',4300,4100,60,'contrato_assinado','2026-08-01',4050,'2026-08-02','2026-08-04',4000),
 ('Fernanda Lima','234.567.890-12','(47) 99633-8877','a3333333-3333-3333-3333-333333333333','c2222222-2222-2222-2222-222222222222','2026-07-29','2026-07-29','2026-08-01','2026-08-02','Ed. Marine, apto 401',6000,5800,50,'fechamento','2026-08-03',5700,NULL,NULL,NULL),
 ('João Pedro Alves','345.678.901-23','(47) 99544-1122','a4444444-4444-4444-4444-444444444444','c4444444-4444-4444-4444-444444444444','2026-07-30','2026-07-31','2026-08-02','2026-08-03','Ed. Solaris, apto 1203',3800,3700,50,'proposta',NULL,NULL,NULL,NULL,NULL),
 ('Luiza Carvalho','456.789.012-34','(47) 99455-6677','a1111111-1111-1111-1111-111111111111','c1111111-1111-1111-1111-111111111111','2026-07-26','2026-07-27','2026-07-28','2026-07-29','Res. Bosque, casa 12',4500,4400,50,'negocio_perdido',NULL,NULL,NULL,NULL,NULL);

UPDATE public.jornadas SET motivo_perda_id = (SELECT id FROM public.motivos_perda WHERE nome = 'Sem retorno do cliente'), descricao_perda = 'Cliente parou de responder após a proposta.' WHERE etapa = 'negocio_perdido';

INSERT INTO public.jornada_eventos (jornada_id, tipo, etapa_nova, detalhes)
SELECT id, 'criacao', etapa, '{"origem":"seed"}'::jsonb FROM public.jornadas;