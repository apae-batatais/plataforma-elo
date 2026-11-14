# ADR-023 — Agenda única e busca única pela composição da plataforma

- Situação: proposta (14/11/2026), a aprovar com a especificação da issue #117
- Data: 14/11/2026

## Contexto
A agenda única e a busca única precisam reunir dados de vários apps. A regra 3 do projeto proíbe um
módulo de importar outro, e a ADR-013 já diz como ligar apps: cada módulo oferece uma função de leitura
pequena no seu `index.ts`, e a plataforma liga os lados. Aqui a plataforma é quem consome de todos.

## Decisão
- O Núcleo define só o **formato comum** (`src/nucleo/modulos/agenda-busca.ts`): `ItemDaAgenda` (app,
  título, data ou mês, tipo, serviço opcional, endereço de origem, situação) e `ResultadoDaBusca` (app,
  tipo, título, apoio, endereço). Nenhum valor financeiro nem dado pessoal além do que a tela já mostra.
- Cada módulo exporta duas funções no `index.ts`, `itensDaAgenda(p, quem, periodo)` e
  `buscar(p, quem, termo)`. **Quem decide o que a pessoa pode ver é o próprio módulo**, usando o
  `Autorizador` e as regras de visibilidade que já tem (a agenda e a busca nunca ampliam o acesso).
- A plataforma (`src/plataforma/agenda.ts` e `busca.ts`) chama as funções de todos os módulos ativos,
  junta, ordena e entrega às rotas `/agenda` e `/busca`. Só a plataforma conhece todos os módulos.
- Falha de um app (planilha não preparada, sem acesso) não derruba a página: o app fica de fora e a tela
  avisa "Não foi possível ler: <app>".
- A busca de **pessoas atendidas** fica no Núcleo (`src/nucleo/pessoas/`), filtrada por
  `Autorizador.podeVerPessoa`, e registra auditoria de leitura (sem gravar o termo buscado).
- Leitura direta, sem índice nem cópia: a busca percorre as abas na hora. Com o porte atual das
  planilhas basta; se ficar lenta, vale a ADR-017 (banco relacional) e não um índice paralelo.

## Consequências
- Um app novo entra na agenda e na busca exportando as duas funções e sendo listado na composição.
- Cada módulo é testado sozinho (quem vê o quê); a plataforma é testada com módulos falsos.
- O termo buscado pode ser um nome de pessoa: por isso nunca vai para a auditoria nem para registros.
- Custo: cada busca lê várias abas do Google Planilhas; o limite de leituras por minuto da API é o
  ponto de atenção. A entrega mede e, se preciso, lê só as abas necessárias por app.
