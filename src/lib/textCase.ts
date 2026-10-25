// Primeira letra de cada palavra em maiúscula ("filamento pla" -> "Filamento Pla").
// Só mexe na primeira letra: siglas digitadas em maiúsculas (PLA, PETG, HP, S.A.)
// continuam como estão, e palavras que começam com número (180gr, 11x16x6) não mudam.
// Preposições/artigos no meio do texto ficam minúsculos ("Papel de Seda"), e
// unidades de medida também ("Aparador 15 cm", "Papel 180 gr").
const LOWER_WORDS = new Set(['a', 'o', 'as', 'os', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'com', 'para', 'por'])
const UNITS = new Set(['mm', 'cm', 'm', 'g', 'gr', 'kg', 'ml', 'l'])

export function titleCase(v: string | null | undefined): string {
  return (v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, i) => {
      if (!word) return word
      const lower = word.toLowerCase()
      if (i > 0 && (LOWER_WORDS.has(lower) || UNITS.has(lower))) return lower
      return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1)
    })
    .join(' ')
}
