# Especificação da Plataforma — v1 (resumo para o repositório)

Documento completo, com diagramas: https://claude.ai/artifact/FuL5TfpJoxSZJA7NBo6t34
Este arquivo é o resumo que acompanha o código. Em caso de conflito, as ADRs
em `docs/adr/` valem sobre este resumo. A ADR-011 mudou a arquitetura:
camada de aplicação na Netlify e armazenamento em Google Planilhas.

## Objetivo
Reunir em um só lugar os apps de cada departamento da Apae Batatais, sobre um
Núcleo comum de pessoas, acesso e auditoria. Primeiros apps: Orçamento (Fase 1)
e Avaliação de Serviços Sociais da Assistência Social (Fase 2).

## Princípios
1. Simples antes de elegante: uma linguagem, um banco, um app, um deploy.
2. Nenhum servidor para administrar.
3. Um dado, um dono: cada pessoa é cadastrada uma única vez.
4. Apps independentes.
5. LGPD por padrão: proteção no banco, não só na tela.
6. Tudo escrito no repositório.
7. Entregas pequenas e reversíveis, revisadas em prévia.

## Camadas
| Camada | Pasta | Conteúdo |
| --- | --- | --- |
| Portal | `src/app` | Login, menu por perfil, layout |
| Módulos | `src/modulos/<id>` | Um app por departamento |
| Capacidades | `src/capacidades` | Motor de avaliação, Indicadores |
| Núcleo | `src/nucleo` + planilhas `nucleo` e `auditoria` | Armazenamento, acesso, pessoas, organização, auditoria, sessão |

## Núcleo (planilha `nucleo`, uma aba por tabela)
Abas: Unidades, Areas, Servicos, Pessoas, Papeis, VinculosFamiliares,
VinculosServico, Usuarios, Perfis, PerfilPermissoes, Atribuicoes.
Planilha `auditoria`, aba Registros (somente inclusão).
Definições em `src/nucleo/estrutura/tabelas.ts`.

## Perfis iniciais
| Perfil | Vê | Altera |
| --- | --- | --- |
| Administrador da plataforma | Configuração, usuários, auditoria | Organização e acessos; não vê atendidos |
| Diretoria | Todas as pessoas, auditoria, indicadores | Aprovações |
| Financeiro | Orçamento | Previsão e lançamentos |
| Coordenação de serviço | Atendidos do seu escopo e familiares | Cadastro e vínculos do escopo |
| Técnico avaliador | Atendidos do seu escopo | Avaliações que conduz |
| Leitura | Painéis agregados | Nada |

Escopo de atribuição: global, unidade, área ou serviço. Escopo de unidade ou
área cobre os serviços daquela unidade ou área.

## Eventos do Núcleo
| Evento | Quando |
| --- | --- |
| `PessoaVinculadaAServico` | Novo vínculo ativo com serviço |
| `PessoaDesligadaDeServico` | Vínculo encerrado (com motivo) |

## Roteiro
| Fase | Entrega | Para avançar |
| --- | --- | --- |
| 0 · Fundação | Camada de aplicação, armazenamento em planilhas, acesso, auditoria, demonstração, CI | Google Cloud, Drive e Netlify configurados; login Google institucional |
| 1 · Orçamento | Importação 2026/2027, previsão, folha e rateio, lançamentos, painel | Execução confere com a planilha; DPO definido |
| 2 · Avaliação | Motor + módulo da Assistência, primeiro ciclo da UR | Ciclo fechado, enquadramentos justificados |

Fase 2, entrega 1 (06/11/2026): módulo Avaliação de Serviços Sociais, com avaliação inicial e anual, comparativo da mesma pessoa, painel por serviço atual e fundamento legal do instrumento (ADR-016). O motor de avaliação fica para as próximas entregas.
| 3 · Expansão | Educação, Saúde/CER, novos módulos | — |

## Situação da Fase 0
- [x] Camada de aplicação (Next.js) com módulos e regras de fronteira
- [x] Armazenamento em Google Planilhas pela conta de serviço, com controle de versão (ADR-011)
- [x] Acesso por perfil e escopo e auditoria na camada de aplicação
- [x] Login Google institucional (conferido no servidor) e demonstração com dados fictícios
- [x] Publicação na Netlify pelo GitHub (oficial manual, prévia por PR)
- [x] Google Cloud: conta de serviço e ID do cliente OAuth
- [x] Planilhas Núcleo e Auditoria criadas e compartilhadas com a conta de serviço
- [ ] Capacidade de Indicadores (cálculo e painel)

## Textos e demonstração sem nomes próprios (proposta #97)

**Objetivo**: o Elo atende várias OSCs; nenhum texto visto por quem usa, nem dado fictício, cita
instituição, unidade, marca ou cidade reais. **Para quem**: todas as pessoas que usam o Elo, a
Operadora da rede e quem confere as prévias. **Frentes**: telas (textos) e regras e dados (dados
fictícios e configuração inicial do Núcleo, a pedido da proposta). Fora os textos e dados
fictícios listados abaixo, nenhum módulo muda.

### Regra permanente (decisão da Diretoria, 11/11/2026)
Textos de tela, dicas, exemplos, mensagens, dados fictícios e manual **nunca citam nome próprio**
de instituição, unidade, marca ou cidade. Termos genéricos: "instituição", "nome da instituição",
"OSC", "Sede". Fica de fora a documentação interna (especificações, ADRs, metodologia, regras do
agente), que quem usa o Elo não vê. A regra já está no `CLAUDE.md` (neste PR). O Desenvolvedor
repete a regra nas habilidades `telas` e `regras-e-dados` na entrega.

### O que muda
1. **Nomes da demonstração** (`src/nucleo/config.ts`): instituição `exemplo` passa a
   "Instituição Exemplo A" (por extenso: "Instituição Exemplo A (fictícia)"); `modelo` passa a
   "Instituição Exemplo B" ("Instituição Exemplo B (fictícia)"). Códigos, domínios e unidades não
   mudam. "Instituição Operadora da Plataforma" continua como a Administração da rede, sem perfis
   dos apps. A tabela da seção "Demonstração" de `docs/especificacao-rede.md` já foi atualizada
   neste PR; atualizar `tests/nucleo/instituicoes.test.ts`.
2. **Textos da Rede**: cadastro da instituição (`formulario-instituicao.tsx`: dicas, placeholder e
   exemplo de unidades) e as 4 mensagens de erro de `src/nucleo/rede/rede.ts` usam exemplos
   genéricos: "Instituição Exemplo", `instituicao-exemplo`, `instituicao.org.br`,
   `elo.instituicao.org.br`, `sede=Sede`. Descrição da página: "As instituições que usam o Elo".
   Passo a passo do endereço de acesso: endereço genérico.
3. **Outros textos**: Orçamento (dica do Total CEBAS: "o que a instituição efetivamente
   desembolsa"); Tesouraria › Contas ("As contas da instituição onde o dinheiro fica guardado…");
   Requisições (dica "Onde é o serviço": "Ex.: Sede, banheiro do pátio"); exemplo do cadastro de
   serviços em lote (`cadastro-em-lote.tsx`), que cita a área "Rural" e a unidade "Filial"
   (trocar por área e unidade iniciais, como "Educação" e "Sede").
4. **Dados fictícios**: requisição com local "Sede, banheiro do pátio"; departamento "Apae Rural"
   → "Produção (exemplo)"; receitas "Vendas Vem da Rural (exemplo)" e "Vendas da Rural (exemplo)"
   → "Vendas da produção (exemplo)" e "Venda de mudas (exemplo)" (nomes distintos); pauta
   "Bastidores da horta da Apae Rural" → "Bastidores da horta da instituição"; cidade dos atendidos
   fictícios → "Cidade Exemplo"; unidade fictícia "Unidade Rural (Filial)" → "Unidade Filial
   (exemplo)".
5. **Área "Rural"** (pergunta da Diretoria ao Arquiteto; decisão tomada sozinho, no PR): sai de
   `AREAS_INICIAIS` (`src/nucleo/estrutura/dados-iniciais.ts`); instituição nova nasce com 7 áreas
   e cadastra as suas. Instituições já cadastradas não perdem a área (nada é apagado; "Preparar
   estrutura" só semeia abas vazias). Na demonstração, a área e a unidade fictícias do viveiro
   passam a `producao` ("Produção (exemplo)") e `filial` ("Unidade Filial (exemplo)"), criadas
   pelos dados fictícios, não pela configuração inicial. `rural_viveiro` vira `producao_viveiro`
   e `rural` vira `producao`/`filial` nos dados fictícios e nos testes que os usam.
6. **Manual**: título "Manual do Elo" (Ajuda, `docs/manual/README.md`, documento no Claude Docs);
   a Ajuda e o PDF (`public/manual/manual-elo.pdf`) são atualizados no mesmo PR de entrega.
7. **Comentários internos do código** com exemplos de Apae Franca/Batatais viram genéricos
   (`config.ts`, `rede/tabelas.ts`, `dados-iniciais.ts`, `preparar.ts`, `plataforma/instituicao.ts`).

### Regras de negócio (com teste)
1. A demonstração lista "Instituição Exemplo A" e "Instituição Exemplo B"; uma continua sem ver
   os dados da outra (testes de isolamento existentes seguem verdes).
2. `AREAS_INICIAIS` não contém "Rural"; "Preparar estrutura" numa instituição nova cria 7 áreas.
3. Teste de guarda: nenhum arquivo de `src/` (exceto testes e a lista de e-mails de setor em
   `src/ui/saudacao.ts`), incluindo os dados fictícios, contém "Apae", "Batatais", "Franca" ou
   "Rural" como nome próprio. A palavra "apae" em `saudacao.ts` fica (não é exibida; evita tratar
   e-mail institucional como nome de pessoa).
4. Mensagens de erro do cadastro de instituição continuam validando as mesmas regras, só com
   exemplos genéricos.

### Fica de fora
Dados das instituições reais; especificações, ADRs, metodologia e regras do agente; a lista de
e-mails de setor da saudação.

### Entregas
Uma só (cabe num PR): textos, dados fictícios, nomes da demonstração e manual.

### Critérios de pronto (na prévia)
- A tela de entrada mostra "Instituição Exemplo A" e "Instituição Exemplo B".
- Rede › Nova instituição: dicas, placeholders e erros sem nomes próprios.
- Orçamento, Tesouraria › Contas, Requisições, Comunicação e atendidos fictícios sem nomes
  próprios; o teste de guarda passa.
- Ajuda e manual chamam-se "Manual do Elo".
