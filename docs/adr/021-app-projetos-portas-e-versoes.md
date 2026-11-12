# ADR-021 — App Projetos: portas de decisão e documentos versionados

- Situação: proposta (12/11/2026), a aprovar com a especificação de Projetos (issue #107)
- Data: 12/11/2026

## Contexto
O app Projetos acompanha um projeto da ideia ao encerramento, com os conceitos do Guia Project DPro
(PM4NGOs). Tem etapas com **portas de decisão** (pareceres, decisão da Diretoria e alçada configurável) e
**documentos que mudam de versão** (Termo de Abertura). Também se liga a Parcerias, Orçamento, Requisições,
Pessoas, Avaliação e Comunicação, sem repetir cadastros.

## Decisão
1. **Módulo novo `projetos`**, com planilha própria `projetos` (sem dados pessoais de atendidos). Nenhum módulo
   existente muda na especificação; só os catálogos de leitura da entrega P7.
2. **Portas de decisão** são dados e regras do próprio módulo (abas `Portas`, `Pareceres`, `Decisoes`),
   configuradas por OSC (`ConfigProjetos`). O fluxo é uma máquina de estados pura em `dominio/`, testada. Não se
   cria motor genérico de fluxo no Núcleo; se outro app precisar, uma nova ADR avalia extrair.
3. **Pareceristas e decisores de alçada são designados por e-mail** na configuração do módulo, não por perfil.
   As permissões de ação ficam no manifesto e no `Autorizador`; a designação é conferida no caso de uso.
4. **Documentos de fase** ficam numa aba de documentos versionados (conteúdo estruturado validado por zod),
   com situação `rascunho`, `aprovado` ou `substituido`. A versão aprovada nunca é editada.
5. **Ligações com outros apps** seguem a ADR-013: catálogos declarados em `projetos`, entregues pela plataforma,
   com identificador e cópia do nome. App ausente vira "ligação indisponível".
6. Conceitos do guia são usados; **o texto do guia não entra no repositório**. A fonte é citada na Ajuda.

## Consequências
- Cada OSC cria a planilha `projetos` e a chave nova em `PLANILHAS`; "Preparar estrutura" liga as permissões.
- Mudar a regra de uma porta mexe só neste módulo e nos testes dele.
- Portas já abertas guardam a exigência de alçada da data da abertura; mudar o limite não reescreve o histórico.
- Se o Elo for cobrado das OSCs, conferir a licença "não comercial" do guia para modelos ou textos (os conceitos
  são de uso geral).
