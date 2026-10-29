# ADR-012 · Várias Apaes no mesmo Elo

- Situação: proposta (aguarda aprovação da Diretoria)
- Data: 2026-10-29
- Complementa: ADR-011 (camada de aplicação e planilhas)

## Contexto
A Apae Batatais quer oferecer o Elo a outras Apaes. Cada Apae tem o próprio
domínio (apaebatatais.org.br, apaefranca.org.br…), o próprio Google Workspace
e quer os dados no próprio Drive. A Diretoria decidiu (29/10/2026):

1. **Um sistema só**: uma publicação atende todas as Apaes; uma atualização vale para todas.
2. **Entrada só com e-mail do domínio** da Apae (ex.: @apaefranca.org.br), além do cadastro de acesso.

## Decisão
```
elo.apaebatatais.org.br ─┐                          ┌─► planilhas no Drive da Apae Batatais
elo.apaefranca.org.br   ─┼─► Elo (um site Netlify) ─┼─► planilhas no Drive da Apae Franca
elo.apae<cidade>.org.br ─┘   descobre a Apae        └─► …
                             pelo endereço
```
- **Endereço**: cada Apae acessa o Elo por um endereço do próprio domínio,
  sugerido `elo.<domínio>`. A Apae cria um registro CNAME no seu DNS apontando
  para o site; o endereço entra como *domain alias* na Netlify (certificado HTTPS
  automático). A Netlify recomenda no máximo 50 endereços por site.
- **Cadastro das Apaes (Rede)**: uma planilha central `rede`, da Apae Batatais
  (operadora do Elo), com a aba `Instituicoes`: código, nome, razão social,
  domínio de e-mail, endereços, situação (ativa/suspensa), IDs das planilhas e
  administradores iniciais. Novo perfil **Administração da rede**, só na Apae
  Batatais, com a tela *Rede › Instituições* para cadastrar, suspender e conferir
  cada Apae. Nada é apagado: Apae que sai fica `suspensa`.
- **Descoberta**: a cada requisição, o servidor lê o endereço acessado e acha a
  Apae. Endereço desconhecido ou Apae suspensa: página explicando, sem dados.
  O cadastro da Rede fica em memória por alguns minutos para não gastar leituras.
- **Dados**: cada Apae cria as próprias planilhas (`nucleo`, `auditoria` e as
  dos módulos) no **próprio Drive** e as compartilha com a conta de serviço do
  Elo. A camada de aplicação monta um armazenamento por Apae; nenhuma tela ou
  caso de uso recebe planilhas de outra Apae (teste automático cobre isso).
  "Preparar estrutura" e a auditoria funcionam por Apae.
- **Login**: o mesmo cliente OAuth do Google para todas; cada endereço novo é
  incluído nas "Origens JavaScript autorizadas". O servidor confere que o
  domínio do e-mail (`hd`) é o da Apae do endereço, e a sessão (cookie do
  próprio endereço) leva o código da Apae: uma sessão de uma Apae nunca vale em outra.
- **Compatibilidade**: sem a planilha `rede` configurada, o Elo continua com
  uma Apae só, pelas variáveis atuais (`DOMINIO`, `PLANILHAS`). A Apae Batatais
  migra sem parar.
- **Identidade**: o Elo mostra o nome da Apae em todas as telas (menu, entrada,
  título da aba). Logotipo próprio de cada Apae fica para depois.

## Consequências
- **LGPD**: a Apae Batatais passa a ser *operadora* dos dados das outras Apaes
  (cada Apae é a controladora e os dados ficam no Drive dela). Antes da primeira
  Apae nova: termo de adesão com as obrigações de operador, e a transferência
  internacional (funções nos EUA) registrada na análise de LGPD de cada uma.
- **Limites e custo**: as Apaes dividem a cota do Google Planilhas do projeto
  (cerca de 300 leituras por minuto) e os créditos da Netlify. O plano gratuito
  já acabou uma vez com uma Apae só: com mais Apaes, prever plano pago da
  Netlify (ou rateio entre as Apaes) e acompanhar a cota do Google.
- **Atualização única**: uma mudança vale para todas no mesmo dia. Mudanças de
  estrutura (abas e colunas novas) pedem "Preparar estrutura" em cada Apae; a
  tela da Rede mostra quais ainda não prepararam.
- **Suporte**: a Administração da rede vê o cadastro e a situação técnica de
  cada Apae, mas **não** vê pessoas, folha nem orçamento das outras Apaes.
