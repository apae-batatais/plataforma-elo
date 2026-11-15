import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';

// Função de um módulo 'use client' chamada numa página ou função do servidor quebra a página só na
// hora de abrir ("Algo deu errado"): tipos, lint, testes e build passam. Aconteceu na Ficha do
// serviço e no painel de sustentabilidade (15/11/2026) com formatarValor de '@/ui/graficos'.
// Componentes (nome com inicial maiúscula) podem ser usados normalmente; o que não pode é *chamar*
// uma função comum (inicial minúscula) vinda de um módulo do navegador.

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return nome === 'testes' || nome === 'node_modules' ? [] : arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

const ehCliente = (texto: string) => /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(texto);

function resolver(origem: string, especificador: string): string | null {
  let base: string;
  if (especificador.startsWith('@/')) base = join('src', especificador.slice(2));
  else if (especificador.startsWith('.')) base = join(dirname(origem), especificador);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return normalize(c);
  }
  return null;
}

/** Nomes importados (sem os `type`) de cada `import { ... } from '...'` do arquivo. */
function importacoes(texto: string): { nomes: string[]; de: string }[] {
  const saida: { nomes: string[]; de: string }[] = [];
  for (const m of texto.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    if (m[1]) continue;
    const nomes = m[2]
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && !p.startsWith('type '))
      .map((p) => (p.includes(' as ') ? p.split(' as ')[1].trim() : p));
    saida.push({ nomes, de: m[3] });
  }
  return saida;
}

/** Chamadas de função de módulo 'use client' feitas em arquivos do servidor. */
export function chamadasDoServidorAoCliente(lista: string[], ler: (a: string) => string): string[] {
  const clientes = new Set(lista.filter((a) => ehCliente(ler(a))).map((a) => normalize(a)));
  const achados: string[] = [];
  for (const arquivo of lista) {
    const texto = ler(arquivo);
    if (ehCliente(texto)) continue;
    const semImports = texto.replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g, '');
    for (const { nomes, de } of importacoes(texto)) {
      const alvo = resolver(arquivo, de);
      if (!alvo || !clientes.has(alvo)) continue;
      for (const nome of nomes.filter((n) => /^[a-z]/.test(n))) {
        if (new RegExp(`\\b${nome}\\s*\\(`).test(semImports)) achados.push(`${arquivo.replace(/\\/g, '/')}: ${nome}() vem de ${de}`);
      }
    }
  }
  return achados;
}

describe('cliente e servidor', () => {
  it('nenhum arquivo do servidor chama função de módulo "use client"', () => {
    expect(chamadasDoServidorAoCliente(arquivos('src'), (a) => readFileSync(a, 'utf8'))).toEqual([]);
  });
});
