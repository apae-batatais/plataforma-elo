# ADR-033 — Auditoria completa e erro sem detalhes na leitura de anexos

Situação: proposta (aguarda aprovação da Diretoria) · Data: 17/11/2026 · Issue #66 · Complementa o ADR-014

## Contexto

Fotos, vídeos e documentos ficam no Drive e só o Elo os entrega, a quem pode ver o registro dono
(ADR-014). A leitura de dado sensível deve ficar na auditoria (regra 8 do `CLAUDE.md`). A revisão
da Comunicação (Entrega 3) achou duas lacunas, que existem também nas Requisições:

1. **Leitura por faixa sem registro.** Só o pedido que começa no byte 0 grava a auditoria. Um pedido
   com `Range: bytes=1-` lê o arquivo inteiro sem deixar rastro.
2. **Erro 502 repassa o texto do Google.** `ErroArquivo.message` (que pode trazer o código do
   arquivo e detalhes da conta de serviço) vai direto para o corpo da resposta ao navegador.

## Decisão

1. **Toda leitura é registrada.** Cada pedido de leitura de anexo que passa pela conferência de
   permissão grava `acao: 'leitura'`, qualquer que seja a faixa, com `detalhes: { faixa: 'inicio-fim' }`
   (números de bytes, nunca conteúdo). A leitura inteira em fluxo (Comunicação, sem `Range`) continua
   gravando uma vez só, porque é um único pedido do navegador.
2. **Uma função só no Núcleo** (`src/nucleo/armazenamento/leitura-de-anexo.ts`) faz a conferência de
   faixa e a auditoria; Requisições e Comunicação a chamam e mantêm só a regra de "quem vê". Assim
   as duas não divergem de novo.
3. **Erro de arquivo tem dois textos.** `ErroArquivo` passa a ter `detalhe` (texto técnico, com o do
   Google) além de `message` (texto seguro). Nas rotas de leitura o navegador recebe só um texto fixo
   ("Não foi possível abrir o arquivo agora. Tente de novo; se continuar, avise a Administração.") e o
   detalhe vai para o registro do servidor (`console.error`). Os fluxos da Administração (conferir
   pasta, abrir envio) continuam mostrando o motivo completo, pois quem os vê precisa dele.
4. **Faixa inválida** (início depois do fim, ou além do tamanho) responde 416, sem ler o Drive e
   sem auditoria de leitura.

## Consequências

- Vídeo tocado pelo navegador pede vários trechos de até 4 MB: cada um vira uma linha de auditoria
  (um vídeo de 40 MB gera cerca de 10). Se a aba de auditoria crescer demais, uma janela de
  "uma linha por pessoa e anexo a cada N minutos" fica como evolução (roadmap).
- Mudança no Núcleo (`arquivos.ts`, novo arquivo de leitura) e nos dois módulos, só nas rotas e
  nos casos de uso de leitura de anexo. Nenhuma aba nova.
- A resposta com cache do navegador (`max-age=300`) não chega ao servidor e não é registrada;
  aceito: o conteúdo já foi liberado àquela pessoa naquela sessão.
