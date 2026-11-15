# Passivo trabalhista e provisão (#142): andamento

Plano: especificação `src/modulos/orcamento/especificacao-folha-caixa-passivo.md` (seção "Continuação #142"). Dois PRs.

## P2 — Passivo trabalhista (PR de entrega #142, parte 1)
- [x] Regras puras (`dominio/passivo.ts`) com testes
- [x] Abas `FeriasTiradas` e `SaldoFGTS`; parâmetros do grupo `passivo`
- [x] Caso de uso `aplicacao/passivo.ts` (painel, simulação, ajustes) com testes de acesso e auditoria
- [x] Tela `/orcamento/passivo`, seções na ficha, menu e indicadores no manifesto
- [x] `npm run verificar` e `npm run build`

## P3 — Provisão e reserva (PR seguinte)
- [ ] Natureza `provisao_trabalhista` no realizado
- [ ] Aba `ReservaTrabalhista` e tela de saldos
- [ ] Provisão sugerida na previsão e "Usar como previsão"
- [ ] Reserva ao lado do passivo; função de domínio de cobertura; indicador `cobertura_passivo`
