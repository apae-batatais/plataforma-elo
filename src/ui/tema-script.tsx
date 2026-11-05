/** Chave onde o navegador guarda o tema escolhido. */
export const CHAVE_TEMA = 'elo-tema';

/** Roda no <head>, antes da pintura, para a página não piscar no tema errado. */
export const SCRIPT_TEMA = `try{var t=localStorage.getItem('${CHAVE_TEMA}');if(t==='claro'||t==='escuro')document.documentElement.dataset.tema=t}catch(e){}`;

/** Primeiro elemento do <body> em todo layout: aplica o tema escolhido antes de o conteúdo aparecer. */
export function ScriptTema() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />;
}
