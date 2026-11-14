# Plano: código da conta contábil nos cadastros do Orçamento (#127)

Especificação: `src/modulos/orcamento/especificacao.md` (seção "Código da conta contábil nos cadastros").

- [x] 1. Domínio: `dominio/codigo-conta.ts` (limpeza, formato, unicidade, CSV seguro) + testes
- [x] 2. Coluna `codigo_conta` em `GruposGasto` e `Fontes`; salvar, excluir/reativar com as regras 1–4
- [x] 3. Cadastro em lote com coluna de código (regra 5)
- [x] 4. Importação de itens casa grupo/fonte pelo código (regra 6)
- [x] 5. "Baixar planilha": casos de uso, rota e botão (regra 7)
- [x] 6. Telas: campo, coluna, código nas despesas e receitas, botão
- [x] 7. `npm run verificar` e `npm run build`
