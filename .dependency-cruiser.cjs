/**
 * Regras de fronteira da plataforma (ADR-001 e ADR-002).
 * Rodam com `npm run fronteiras` e no GitHub a cada mudança.
 * Uma violação aqui significa que um módulo está "invadindo" outro.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'modulo-nao-importa-outro-modulo',
      comment:
        'Um módulo nunca importa outro módulo. Use eventos de domínio ou a interface pública do Núcleo.',
      severity: 'error',
      from: { path: '^src/modulos/([^/]+)/' },
      to: { path: '^src/modulos/', pathNot: ['^src/modulos/$1/'] },
    },
    {
      name: 'nucleo-nao-depende-de-camadas-acima',
      comment: 'O Núcleo não conhece módulos, capacidades, o portal nem a composição.',
      severity: 'error',
      from: { path: '^src/nucleo/' },
      to: { path: '^src/(modulos|capacidades|plataforma|app)/' },
    },
    {
      name: 'capacidade-nao-depende-de-modulo',
      comment: 'Capacidades compartilhadas servem aos módulos e não dependem deles.',
      severity: 'error',
      from: { path: '^src/capacidades/' },
      to: { path: '^src/(modulos|plataforma|app)/' },
    },
    {
      name: 'so-a-composicao-conhece-os-modulos',
      comment: 'Apenas src/plataforma e as rotas em src/app podem importar módulos.',
      severity: 'error',
      from: { pathNot: '^src/(modulos|plataforma|app)/' },
      to: { path: '^src/modulos/' },
    },
    {
      name: 'ui-e-generica',
      comment: 'Componentes de src/ui não dependem de regras de negócio.',
      severity: 'error',
      from: { path: '^src/ui/' },
      to: { path: '^src/(nucleo|capacidades|modulos|plataforma)/' },
    },
    {
      name: 'sem-ciclos',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
