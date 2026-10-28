# Especificação da Plataforma — v1 (resumo para o repositório)

Documento completo, com diagramas: https://claude.ai/artifact/FuL5TfpJoxSZJA7NBo6t34
Este arquivo é o resumo que acompanha o código. Em caso de conflito, as ADRs
em `docs/adr/` valem sobre este resumo. A ADR-011 mudou a arquitetura:
camada de aplicação na Netlify e armazenamento em Google Planilhas.

## Objetivo
Reunir em um só lugar os apps de cada departamento da Apae Batatais, sobre um
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
| 3 · Expansão | Educação, Saúde/CER, novos módulos | — |

## Situação da Fase 0
- [x] Camada de aplicação (Next.js) com módulos e regras de fronteira
- [x] Armazenamento em Google Planilhas pela conta de serviço, com controle de versão (ADR-011)
- [x] Acesso por perfil e escopo e auditoria na camada de aplicação
- [x] Login Google institucional (conferido no servidor) e demonstração com dados fictícios
- [x] Publicação na Netlify pelo GitHub (oficial manual, prévia por PR)
- [ ] Google Cloud: conta de serviço e ID do cliente OAuth
- [ ] Planilhas Núcleo e Auditoria criadas e compartilhadas com a conta de serviço
- [ ] Capacidade de Indicadores (cálculo e painel)
