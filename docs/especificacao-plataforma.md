# Especificação da Plataforma — v1 (resumo para o repositório)

Documento completo, com diagramas: https://claude.ai/artifact/FuL5TfpJoxSZJA7NBo6t34
Este arquivo é o resumo que acompanha o código. Em caso de conflito, as ADRs
em `docs/adr/` valem sobre este resumo.

## Objetivo
Reunir em um só lugar os apps de cada departamento da APAE Batatais, sobre um
Núcleo comum de pessoas, acesso e auditoria. Primeiros apps: Orçamento (Fase 1)
e Avaliação Diagnóstica da Assistência Social (Fase 2).

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
| Núcleo | `src/nucleo` + schema `core` | Identidade, pessoas, organização, documentos, auditoria, eventos |

## Núcleo (schema `core`)
pessoa, papel_pessoa, vinculo_familiar, unidade, area, servico, vinculo_servico,
usuario, perfil, perfil_permissao, atribuicao, documento, auditoria,
evento_dominio, evento_entrega, indicador, valor_indicador.

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
| 0 · Fundação | Núcleo, portal, RLS, auditoria, eventos, dados fictícios, CI | Supabase e Vercel configurados; login de produção com 2 etapas |
| 1 · Orçamento | Importação 2026, previsão, lançamentos, painel | Execução 2026 confere com a planilha; Supabase pago e DPO definidos |
| 2 · Avaliação | Motor + módulo da Assistência, primeiro ciclo da UR | Ciclo fechado, enquadramentos justificados |
| 3 · Expansão | Educação, Saúde/CER, novos módulos | — |

## Situação da Fase 0
- [x] Projeto Next.js + TypeScript, testes, lint de fronteiras
- [x] Schema `core` com RLS, auditoria imutável e eventos (outbox)
- [x] Contrato de módulo (manifesto) e registro de módulos
- [x] Portal com menu por perfil e tela de Pessoas filtrada pelo banco
- [x] Modo local com banco embutido e dados fictícios
- [ ] Conta Supabase (região Brasil) e aplicação das migrações
- [ ] Login de produção (Supabase Auth com verificação em duas etapas)
- [ ] Conta Vercel e prévias automáticas
- [ ] Capacidade de Indicadores (cálculo e painel)
