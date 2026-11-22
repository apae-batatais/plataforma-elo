# ADR-040 · Manual em PDF gerado da Ajuda pela impressão do navegador

Situação: proposta · Data: 21 de novembro de 2026 · Proposta: #232

## Contexto
O manual em PDF era um arquivo editado à parte (`public/manual/manual-elo.pdf`) e ficou
desatualizado. A Diretoria decidiu (21/11/2026) que a Ajuda da plataforma é a fonte única do manual
e que o PDF traz todos os assuntos, com a indicação de quem usa cada um. Os assuntos da Ajuda são
componentes React com texto, passos e atalhos. O projeto não tem biblioteca de PDF, e a Netlify
cobra por publicação (ADR-019), então gerar arquivo no build ou em função também tem custo.

## Decisão
1. Os assuntos ficam num módulo único (`assuntos.tsx`), com a permissão de cada um. A Ajuda filtra
   por permissão; a página `/ajuda/manual` mostra todos.
2. O PDF é gerado pela **impressão do navegador** ("Salvar como PDF") a partir de `/ajuda/manual`,
   com estilos de impressão (um assunto por página, capa com versão e data). Nenhum PDF fica no
   repositório e nenhuma dependência nova entra.
3. "Para: <perfis>" de cada assunto é calculado das permissões (`PERMISSOES_INICIAIS`).
4. Teste de cobertura: todo item de menu tem assunto na Ajuda.

## Consequências
- O manual é sempre da versão publicada, sem passo manual.
- Sem numeração de página nem índice com páginas; um clique a mais para a pessoa.
- Reabrir a decisão (PDF de verdade com biblioteca) só se a Diretoria precisar de arquivo gerado
  sem navegador, por exemplo envio automático.
- Não muda Núcleo, planilhas nem permissões.
