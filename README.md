# Plataforma APAE Batatais

Plataforma de ferramentas da APAE Batatais: um portal com um app para cada
departamento (Orçamento, Avaliação Diagnóstica e outros), sobre um Núcleo
comum de pessoas, acesso e auditoria.

- Especificação: [`docs/especificacao-plataforma.md`](docs/especificacao-plataforma.md)
- Decisões de arquitetura: [`docs/adr/`](docs/adr/)
- Regras para o agente desenvolvedor: [`CLAUDE.md`](CLAUDE.md)

## Como trabalhamos (tudo na nuvem)

A Diretoria não instala nada no computador (ADR-010). O GitHub é a cópia
oficial do código, e todo o desenvolvimento acontece em sessões do Claude na
nuvem ligadas a este repositório.

1. **Pedido:** a Diretoria descreve a funcionalidade em uma sessão do Claude com este repositório.
2. **Especificação:** o Claude escreve ou atualiza a especificação e a Diretoria aprova.
3. **Construção:** o Claude trabalha em um ramo próprio, roda `npm run verificar` e abre um Pull Request em português.
4. **Verificação automática:** o GitHub roda tipos, lint, fronteiras, testes e build (aba *Actions*).
5. **Prévia:** a Netlify publica cada Pull Request em um link de prévia, em modo demonstração (dados fictícios).
6. **Aprovação:** a Diretoria confere a prévia e aprova o Pull Request pelo navegador; só então a mudança entra na `main`.

## Comandos (usados pelo Claude nas sessões)

```bash
npm install
npm run dados:ficticios   # cria o banco local com dados inventados
npm run dev               # abre a plataforma em modo local
npm run verificar         # tipos, lint, regras de fronteira e testes
```

No modo local, a tela de entrada lista usuários fictícios, um por perfil,
para conferir o que cada pessoa da equipe vai ver.

## Hospedagem

Netlify (`netlify.toml`, ADR-011). Enquanto o Supabase não existir, a
publicação e as prévias rodam em **modo demonstração**: cada servidor monta um
banco em memória com os dados fictícios. Depois de alterar uma migração em
`supabase/migrations/`, rode `npm run migracoes:gerar`.
