# ADR-010 · Desenvolvimento somente na nuvem

- Situação: aceita
- Data: 2026-10-25
- Substitui a orientação anterior de clonar o repositório em `C:\dev`.

## Contexto
A Diretoria não quer manter cópia do código nem ferramentas de
desenvolvimento (Node.js, Git) no computador.

## Decisão
- O GitHub (`apae-batatais/plataforma-apae`) é a única cópia oficial.
- Todo o desenvolvimento acontece em sessões do Claude na nuvem ligadas ao
  repositório, em ambientes descartáveis.
- A Diretoria revisa e aprova pelo navegador: Pull Request, verificação
  automática (GitHub Actions) e prévia (Render; ver ADR-011).

## Consequências
- Nada a instalar ou atualizar na máquina da Diretoria.
- Sem risco de corromper o repositório pela sincronização do Google Drive.
- A prévia no Render passa a ser o principal jeito de conferir uma mudança
  antes de aprová-la; até ela existir, a conferência é feita pelo resumo do
  Pull Request e pela verificação automática.
- Os ambientes da nuvem continuam sem acesso a dados de produção (ADR-008).
