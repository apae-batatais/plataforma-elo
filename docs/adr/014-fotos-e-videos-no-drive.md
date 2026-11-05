# ADR-014 — Fotos e vídeos em pasta do Drive da instituição

- Situação: aceita (04/11/2026)

## Contexto
A Diretoria pediu foto e vídeo, gravados direto pelo celular, na abertura da requisição.
As planilhas guardam só texto (ADR-011). A hospedagem (Netlify) limita o tamanho do que
passa pelo servidor (cerca de 6 MB por pedido e por resposta). O Elo pode mudar de
dono no futuro, e os arquivos precisam continuar com cada instituição (ADR-012).

## Decisão
- Os arquivos ficam numa **pasta de uma unidade compartilhada do Google Drive da
  instituição**, acessada pela mesma conta de serviço das planilhas (que precisa ser
  Gerente de conteúdo). Unidade compartilhada porque a conta de serviço não tem espaço
  próprio no Drive. O ID da pasta fica no cadastro da instituição na rede, com a chave
  `anexos`, junto das planilhas.
- **Envio direto do navegador para o Drive** (envio retomável): o servidor só abre o
  envio, depois de conferir permissão, tipo de arquivo e tamanho, e devolve o endereço.
  Assim o arquivo não passa pelo limite do servidor.
- Ao enviar a ficha, o servidor confere no Drive cada arquivo (existe, está na pasta,
  tipo e tamanho) antes de ligar à requisição. A planilha guarda só a referência
  (aba `Anexos`: id do arquivo, tipo, tamanho, duração).
- **Ninguém abre pelo Drive.** O Elo entrega o arquivo só a quem pode ver a requisição
  (Autorizador), em trechos de até 4 MB (o navegador pede o vídeo aos poucos), e registra
  a abertura na auditoria (`leitura`).
- Limites: até 3 fotos, reduzidas no navegador (lado maior 1600 px, JPG, até ~1,4 MB),
  e 1 vídeo de até 30 s e 25 MB. Cada tipo de requisição diz se aceita (sem marcação,
  as fichas de serviço aceitam).
- O código fala com os arquivos por uma interface do Núcleo (`ArmazenamentoArquivos`):
  Drive em produção, memória na demonstração e nos testes.

## Consequências
- Para ativar, cada instituição cria a unidade compartilhada, dá acesso à conta de
  serviço e informa o ID da pasta. Sem pasta, as requisições funcionam sem anexos; a tela
  Estrutura das planilhas mostra se a pasta está acessível.
- Na demonstração (memória), o arquivo passa pelo servidor: cada um pode ter até 4 MB.
- Arquivos enviados e não usados (ficha abandonada) ficam na pasta, sem ligação.
- A credencial passa a ter também o escopo do Drive; a conta de serviço só enxerga o
  que foi compartilhado com ela.
- O envio direto depende do Drive aceitar o envio pelo navegador (CORS) para o endereço
  do Elo; isso só pode ser confirmado com a pasta real, no primeiro uso em produção.
