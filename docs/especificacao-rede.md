# Especificação — Várias Apaes no Elo (Rede)

Decisão de arquitetura: ADR-012. Este documento descreve o que muda para quem usa.

## Quem faz o quê
| Quem | O que faz |
| --- | --- |
| Administração da rede (Apae Batatais) | Cadastra e suspende Apaes, confere a configuração técnica de cada uma |
| TI ou Diretoria da Apae nova | Cria o endereço `elo.<domínio>` no DNS, cria as planilhas no Drive e compartilha com a conta de serviço |
| Administração da plataforma (de cada Apae) | Roda "Preparar estrutura", cadastra serviços, áreas e acessos da sua Apae |

## Telas novas
1. **Rede › Instituições** (só Administração da rede): lista das Apaes com
   situação, endereço, domínio e estado das planilhas (encontradas, compartilhadas,
   estrutura preparada). Ações: cadastrar, alterar, suspender e reativar.
2. **Cadastro de uma Apae**: nome curto ("Apae Franca"), razão social, domínio
   de e-mail, endereços de acesso, IDs das planilhas (núcleo, auditoria e uma por
   módulo) e e-mails dos administradores iniciais. Botão **Conferir** testa cada
   planilha e mostra o que falta, em português, sem gravar nada.
3. **Endereço não cadastrado** (pública): explica que o endereço não pertence
   a nenhuma Apae do Elo, sem mostrar dados.

## Passo a passo para uma Apae nova
1. A Administração da rede cadastra a Apae (situação "em preparação").
2. A Apae cria `elo.<domínio>` no DNS (CNAME) e a Apae Batatais inclui o
   endereço na Netlify e no cliente OAuth do Google.
3. A Apae cria as planilhas no próprio Drive e compartilha com a conta de serviço.
4. A Administração da rede cola os IDs e usa **Conferir**.
5. O administrador inicial da Apae entra, roda **Preparar estrutura** e
   cadastra a organização e os acessos. A situação passa a "ativa".

## Regras (com teste)
1. Cada requisição usa só as planilhas da Apae do endereço acessado.
2. Login só com e-mail do domínio da Apae do endereço; a sessão de uma Apae não vale em outra.
3. Apae suspensa: ninguém entra, os dados continuam no Drive dela.
4. Administração da rede não vê dados de pessoas, folha nem orçamento de outras Apaes.
5. Toda alteração no cadastro da Rede registra auditoria (colunas, nunca valores).
6. Sem a planilha `rede`, o Elo funciona como hoje, com uma Apae só.

## Demonstração
A demonstração mostra duas Apaes fictícias (ex.: "Apae Exemplo" e "Apae
Modelo"), cada uma com seus dados, para conferir na prévia que uma não vê a
outra. O seletor de Apae existe só na demonstração.

## Entregas
- **R1**: descoberta da Apae pelo endereço, planilhas e login por Apae, página
  de endereço não cadastrado, demonstração com duas Apaes.
- **R2**: planilha `rede`, perfil Administração da rede e telas de cadastro e conferência.
- **R3**: manual "Como trazer uma Apae para o Elo" e termo de adesão (LGPD).
