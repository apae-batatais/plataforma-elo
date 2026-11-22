# Ficha própria por tipo de requisição (#228)

Refatoração de tela, sem mudar regra, dado gravado ou permissão.

1. [x] `telas/ficha.ts`: tipos comuns (`OpcoesFicha`, `PropsFicha`, `SaidaFicha`).
2. [x] `FichaMateriais`, `FichaTi`, `FichaMobiliario`, `FichaManutencao`: cada uma com seu estado, devolvendo `itens` e `detalhes` ao casco.
3. [x] `FormularioRequisicao` enxuto: Tipo e Área, Projeto, Centros de custo, Anexos, Observações, Enviar.
4. [x] `npm run verificar` e `npm run build` verdes.
