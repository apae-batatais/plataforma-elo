# ADR-039 · Base de Conhecimento: registro de ciência versionado

- Situação: proposta, aprovada com a especificação da issue #231
- Data: 21/11/2026

## Contexto
O Elo ganha o app Base de Conhecimento (`src/modulos/conhecimento`). Seu valor está em provar, depois,
quem recebeu, leu e confirmou um documento (por exemplo, um manual de normas). Isso levanta três
decisões que atravessam o app: o que significa uma ciência quando o documento muda, quem pertence ao
público de uma publicação e como guardar anexos em PDF.

## Decisão
1. **Ciência é por versão da publicação.** Cada ciência e cada tentativa de teste guardam a `versao`.
   Mudar o corpo ou o teste pode ser "correção pequena" (a versão não muda) ou "nova versão" (soma 1 e
   reabre a pendência de todos), escolhido por quem edita. As linhas antigas nunca são alteradas
   (regra 6 do projeto): a ciência da versão anterior continua no histórico.
2. **A ciência é gravada só pela camada de aplicação**, com o usuário da sessão e a hora do servidor.
   Não há geolocalização nem carimbo ICP-Brasil; ambos estão no roadmap.
3. **Público-alvo por atribuições do Núcleo**, sem tabela de grupos nova: `todos`, `perfil` (atribuição
   ativa com o perfil) ou `area` (atribuição ativa com escopo na área). A lista de quem deve cumprir é
   calculada ao abrir o acompanhamento, a partir das atribuições da hora, e não congelada na publicação.
4. **Gabarito protegido:** a coluna `correta` tem `sigilo: 'sensivel'` e nunca é enviada ao navegador; a
   correção é feita no servidor.
5. **Anexo em PDF** usa o mesmo armazenamento de arquivos da ADR-014 (Drive da instituição, entrega
   pela rota do Elo conferida pelo `Autorizador`). A rota de envio passa a aceitar `application/pdf`,
   conferido no servidor, sem mudar o contrato `ArmazenamentoArquivos`.
6. **Aviso por e-mail** reaproveita a peça e a rotina da ADR-027 (aba `Envios` no módulo, texto genérico,
   cópia oculta, idempotente por publicação e versão).

## Consequências
- Quem sai do público (perfil retirado) deixa de aparecer como pendente, mas a ciência já registrada
  permanece no histórico.
- Como o público é recalculado, o acompanhamento de uma publicação antiga pode mudar de total ao longo
  do tempo; o registro de ciências individuais não muda.
- Planilha com e-mails de pessoas fica em planilha própria do app, com sigilo `pessoal` nessas colunas.

## Notas da entrega 4 (23/11/2026)
- Aba `Envios` do módulo: um envio por publicação e edição (idempotente), criado ao publicar ou ao criar nova versão; a tarefa `conhecimento.avisos` da rotina envia em Cco com texto fixo, sem título, e 3 tentativas (15 e 60 minutos). Sem e-mail de envio, nada é agendado e o editor vê o aviso; se a publicação for arquivada ou mudar de versão antes do envio, o aviso é cancelado.
