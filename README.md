# Plataforma APAE Batatais

Plataforma de ferramentas da APAE Batatais: um portal com um app para cada
departamento (Orçamento, Avaliação Diagnóstica e outros), sobre um Núcleo
comum de pessoas, acesso e auditoria.

- Especificação: [`docs/especificacao-plataforma.md`](docs/especificacao-plataforma.md)
- Decisões de arquitetura: [`docs/adr/`](docs/adr/)
- Regras para o agente desenvolvedor: [`CLAUDE.md`](CLAUDE.md)

## Rodar no computador (modo local, só dados fictícios)

Requisitos: Node.js 20 ou mais novo e Git.

```bash
npm install
npm run dados:ficticios   # cria o banco local com dados inventados
npm run dev               # abre em http://localhost:3000
```

Na tela de entrada, escolha um usuário fictício. Cada um tem um perfil
diferente, para você conferir o que cada pessoa da equipe vai ver.

## Verificar antes de entregar

```bash
npm run verificar   # tipos, lint, regras de fronteira e testes
```

## Onde guardar o código

Clone o repositório fora do Google Drive (por exemplo, `C:\dev\plataforma-apae`).
A sincronização do Drive pode corromper repositórios Git. O GitHub é a cópia oficial.
