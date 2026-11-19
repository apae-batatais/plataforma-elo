# ADR-035 · Cadastro de pessoa e vínculo com serviço no Núcleo

Situação: proposta · Data: 18 de novembro de 2026 · Proposta: #198

## Contexto

O Cadastro Único (`Pessoas`) e os vínculos com serviço (`VinculosServico`) só têm tela de leitura
(`/nucleo/pessoas`). Saúde, Educação e Parcerias dependem de `VinculosServico` para saber quem é
atendido em cada serviço, e hoje a única forma de ter pessoa e vínculo é carga direta na planilha,
fora do Autorizador e da auditoria. O catálogo de eventos do Núcleo (`PessoaVinculadaAServico`,
`PessoaDesligadaDeServico`) existe, mas nada o emite, e seu formato pede identificador `uuid` de
serviço, enquanto os serviços são referenciados pelo código (ADR-011).

## Decisão

1. O Núcleo ganha os casos de uso de gravação do Cadastro Único em `src/nucleo/pessoas/`:
   cadastrar pessoa, corrigir dados da pessoa, criar vínculo com serviço e encerrar vínculo. Todos
   passam pelo `Autorizador`, usam `inserir`/`atualizar` com a versão lida e chamam
   `registrarAuditoria` com as colunas alteradas.
2. **Encerrar vínculo** grava `saida` e `motivo_saida` e **mantém `ativo = TRUE`**. A coluna `saida`
   é o encerramento desta aba: a contagem de atendidos por mês (`contagem.ts`) e o histórico do
   serviço dependem de ler vínculos já encerrados. `ativo = FALSE` fica reservado a registro
   lançado por engano. Sem apagar nada (regra 6).
3. **Vínculo e pessoa são checados por escopo**: criar ou encerrar vínculo exige
   `core.vinculos.editar` no serviço do vínculo; cadastrar e corrigir pessoa exige
   `core.pessoas.editar` e só vale sobre quem `Autorizador.podeEditarPessoa` aceita.
   A Diretoria passa a ter as duas permissões, de forma global.
4. **Duplicidade**: antes de cadastrar, a camada de aplicação confere o CPF (só dígitos) e o par
   nome + data de nascimento contra **todas** as pessoas ativas, não só as visíveis. O resultado
   para quem não pode ver a pessoa é só "já existe cadastro" (sem nome, sem id).
5. **Eventos**: os dois casos de uso de vínculo devolvem o evento do catálogo (`PessoaVinculada-
   AServico`, `PessoaDesligadaDeServico`) já validado pelo esquema; como não há consumidor ainda
   (ADR-011), nada é publicado em fila. O catálogo muda `servicoId` (uuid) para `servico` (código
   do serviço) e `pessoaId` e `vinculoId` para texto, que é o formato real dos ids nas planilhas.
6. Nenhuma aba nova: `Pessoas`, `Papeis` e `VinculosServico` já estão declaradas e registradas.

## Consequências

- Saúde, Educação e Parcerias deixam de depender de carga manual; a regra 4 e a 7 do `CLAUDE.md`
  passam a valer também para o cadastro das pessoas.
- Quem coordena um serviço não consegue vincular a seu serviço uma pessoa que só existe fora do
  seu escopo; precisa pedir à Diretoria. É o preço de não revelar quem é atendido em outro serviço.
- A conferência de duplicidade lê o cadastro inteiro a cada gravação; com milhares de pessoas ainda
  cabe numa leitura de aba (ADR-011), mas é o primeiro ponto a revisar se a aba crescer muito.
- Mudar o formato do evento é seguro hoje porque nenhum módulo o consome.
