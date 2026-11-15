# ADR-028 — Credenciais por instituição guardadas na plataforma e publicação no Instagram

- Situação: proposta (15/11/2026), a aprovar com a especificação da issue #64
- Data: 15/11/2026

## Contexto
A publicação automática no Instagram (Comunicação, fase 3) precisa de uma chave de acesso (token) por
conta de Instagram, e cada OSC usa a sua. A Diretoria decidiu (issue #64) que outras OSCs usam já nesta
entrega e que as credenciais de cada conta devem ser cadastradas **dentro do Elo**, não só em Secrets do
GitHub (que são poucos, ligados à esteira e não escalam por instituição). Planilha é só armazenamento
(ADR-011) e hoje o Elo não guarda segredo de terceiros.

Sobre a Meta (conferido na documentação oficial, 15/11/2026): a API de publicação do Instagram com
"Instagram Login" usa a permissão `instagram_business_content_publish`. Apps que atendem apenas contas
que o dono do app administra ficam em **acesso padrão**, sem revisão. Para atender contas de **outras
organizações** é preciso **acesso avançado**, que exige **revisão do app** e **verificação da empresa**
(Business Verification), em geral com prazo de semanas, e a verificação costuma ser pré-requisito para
enviar a revisão. A publicação por API tem limite diário por conta (a Meta documenta 100 por 24 horas,
com trechos antigos dizendo 50; usar o menor, 50).

## Decisão
1. **Um único app Meta do Elo**, com "Instagram Login" (Business Login). Cada OSC clica em "Conectar
   Instagram", entra com a própria conta profissional e autoriza; o Elo recebe um token de longa duração
   (cerca de 60 dias). Ninguém digita senha nem copia token à mão. `META_APP_ID` e `META_APP_SECRET` são
   Secrets da plataforma (Netlify), com vencimento em `.github/chaves.json` quando houver.
2. **Peça nova do Núcleo: `src/nucleo/credenciais/`.** Guarda segredo por instituição e serviço na aba
   `Credenciais` (planilha do Núcleo). O valor é **cifrado na camada de aplicação** (AES-256-GCM) com a
   chave mestra `ELO_CHAVE_CREDENCIAIS` (Secret da Netlify); a planilha só vê texto cifrado. Colunas:
   instituição, serviço, identificação da conta (ex.: nome de usuário do Instagram), valor cifrado,
   vence em, situação (`conectada`, `expirando`, `expirada`, `desconectada`), conectado por, conectado em.
   O valor **nunca volta para a tela nem para o navegador**, nunca vai para log nem auditoria (a
   auditoria registra só colunas). Desconectar encerra a linha (nada é apagado: valor cifrado é zerado e
   a situação vira `desconectada`). Trocar a chave mestra exige reconectar as contas (roteiro no manual).
   O contrato é genérico: o Gmail (#63) ou outro serviço usam a mesma peça depois, sem mudar o contrato.
3. **Renovação automática.** A rotina (ADR-027, `POST /api/rotina`) renova tokens que vencem em menos de
   15 dias. Falhou a renovação: situação `expirando`, aviso à Comunicação; vencido: `expirada`, nada é
   publicado e o pedido volta para "Agendado" com aviso.
4. **Publicar em duas etapas da Meta** (criar o contêiner de mídia e depois publicar): post com uma
   imagem, Reel (vídeo) e carrossel (2 a 10 itens). A Meta baixa a mídia de um endereço público.
5. **Rota de mídia temporária `/api/midia-temporaria/<código>`**. Para cada publicação o Elo cria um
   código aleatório (mínimo 32 bytes), com validade de 1 hora, que entrega só aquele arquivo (lido da
   pasta de anexos da instituição, ADR-014), sem login. O código só existe enquanto a publicação não
   termina: ao concluir, falhar ou vencer, deixa de funcionar. A rota registra auditoria de cada entrega
   (`acao: 'leitura'`). Foto e vídeo continuam privados no resto do tempo.
6. **Rotina e fila.** Reaproveita a rotina e o padrão de fila da ADR-027: aba `Publicacoes` (planilha da
   Comunicação) com situação `pendente`, `publicando`, `publicada`, `falhou`, `cancelada`, tentativas e
   erro resumido. Idempotente: uma publicação nunca sai duas vezes (situação `publicando` e versão da
   linha; se a Meta já devolveu o identificador do post, a rotina só consulta, nunca recria).
7. **Revisão da Meta é pendência da Diretoria, fora do código.** O Elo funciona de imediato com as contas
   que a Diretoria cadastra como testadoras/administradoras do app (acesso padrão). Abrir para outras
   OSCs depende da verificação da empresa e da revisão do app (issue de pendência da Diretoria). A
   especificação nasce com o caminho: sem revisão, o botão "Conectar Instagram" de uma OSC que não tem
   papel no app mostra aviso claro, nunca erro técnico.
8. **Limites.** Máximo 50 publicações por conta em 24 horas (a rotina respeita e deixa o excedente para
   a rodada seguinte); no máximo 25 por rodada e instituição.

## Consequências
- Primeiro segredo de terceiros guardado pelo Elo: exige a chave mestra como novo Secret da Netlify e
  cuidado de segurança (cifra, nunca exibir, auditoria). Perder a chave mestra = reconectar as contas.
- A mídia fica pública por até 1 hora por publicação, por exigência da Meta; o código é imprevisível e
  de uso encerrado ao fim.
- O Elo passa a depender de um app Meta e da política da Meta; mudança de regra da Meta pode exigir nova
  revisão. Só a camada `src/nucleo/credenciais/` e o adaptador do Instagram conhecem a Meta.
- Limites de tamanho de resposta da hospedagem (Netlify) para vídeos grandes precisam ser medidos na
  construção (entrega 3); se não couberem, o limite de tamanho do vídeo na especificação diminui.
- Depende da #63 (peça de rotina e padrão de fila, ADR-027), que deve entrar antes.
