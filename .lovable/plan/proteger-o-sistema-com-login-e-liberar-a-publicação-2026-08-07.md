# Proteger o sistema com login e liberar a publicação

Hoje todas as tabelas (jornadas, consultores, registros diários, metas, auditoria...) estão abertas para acesso anônimo. Qualquer pessoa com o endereço do app poderia ler ou alterar dados de clientes. Isso é o que está bloqueando a publicação. A correção é exigir login para tudo.

## O que muda para o usuário

- Ao abrir o site sem estar logado, aparece uma tela de login (e-mail e senha) com a identidade visual Adim.
- Cadastro de novas contas fica desativado: só entra quem tiver conta criada pela gestão. Você me diz os e-mails e eu crio os acessos.
- Depois de entrar, todo o painel funciona igual está hoje (Dashboard, Jornada, Registro Diário, Ciclos, Cadastros, Auditoria).
- Botão de "Sair" no cabeçalho, com o e-mail do usuário logado.
- A trilha de auditoria passa a registrar o e-mail de quem fez a alteração, em vez do nome digitado na sessão.

## Etapas

1. **Ajustar as regras de acesso do banco (migração)**: remover todo acesso anônimo e permitir leitura/escrita apenas para usuários autenticados, mantendo o comportamento atual de cada tabela (auditoria e histórico de jornada continuam sem poder ser editados ou apagados).
2. **Tela de login** em `/auth`: e-mail e senha, com logo e cores da marca, mensagens de erro em português e link de recuperação de senha (mais a página de redefinição).
3. **Proteger as rotas**: mover as páginas do painel para a área autenticada; quem não está logado é enviado para `/auth`.
4. **Cabeçalho**: exibir o e-mail logado e o botão Sair, limpando o cache ao sair.
5. **Auditoria**: usar o e-mail da sessão como autor das alterações.
6. **Configuração de auth**: desativar auto-cadastro, ativar verificação de senhas vazadas.
7. **Validar e publicar**: rodar o scan de segurança novamente e publicar quando estiver limpo.

## Detalhes técnicos

- Migração: `DROP POLICY` das políticas `*_open` / `anon` e recriação com `TO authenticated`; `REVOKE` dos grants em `anon` e `GRANT` para `authenticated` + `service_role` em todas as tabelas públicas.
- Rotas protegidas passam para `src/routes/_authenticated/`, usando o gate gerenciado (`ssr: false`, redirect para `/auth`). `src/routes/index.tsx` passa a redirecionar para `/dashboard` quando há sessão e para `/auth` quando não há; o dashboard atual vira `_authenticated/dashboard.tsx`.
- `src/lib/usuario.ts` passa a ler o e-mail de `supabase.auth.getUser()` em vez do `sessionStorage`.
- Listener único de `onAuthStateChange` em `src/routes/__root.tsx` com `router.invalidate()`.
- `supabase--configure_auth`: `disable_signup: true`, `external_anonymous_users_enabled: false`, `auto_confirm_email: false`, `password_hibp_enabled: true`.
- Contas iniciais criadas via Admin API depois que você passar os e-mails.
