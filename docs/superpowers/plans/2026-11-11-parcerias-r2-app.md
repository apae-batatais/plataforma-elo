# Plano — Parcerias R2 (app Parcerias), issue #95

Especificação: `src/modulos/parcerias/especificacao.md` (revisão 2) e ADR-020.

1. Núcleo: contagem de atendidos por serviço e mês (`src/nucleo/pessoas/contagem.ts`, só números).
2. Domínio puro: valores em centavos, per capita mensal/anual, partes iguais, conferência da soma, ocupação e alerta.
3. Abas da planilha `parcerias` e manifesto (permissões `parcerias.*`).
4. Casos de uso: criar termo, adicionar fonte, registrar e cancelar aporte, encerrar, limite de ocupação, vagas, catálogo `termosParaOrcamento`.
5. Telas: lista, novo termo, ficha (fontes, aportes, equipe, per capita e ocupação).
6. Composição (registro de módulos, nomes de planilha, cor do app) e dados fictícios.
7. Testes e verificação.

**Fica para as próximas entregas desta proposta:** R3 (fontes dos termos no Orçamento, conta vinculada, plano de aplicação, rateio de fonte nas despesas) e R4 (rateio na folha, painel de comprometimento, horas).
