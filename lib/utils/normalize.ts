/**
 * Normalizza una stringa per ricerca case-insensitive e accent-insensitive
 * Rimuove accenti, converte a lowercase, rimuove caratteri speciali
 */
export function normalizeSearchString(input: string): string {
  if (!input) return '';

  return input
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, '') // Keep only alphanumeric and spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();
}

/**
 * Verifica se una stringa contiene un'altra (search fuzzy)
 */
export function fuzzyIncludes(text: string, search: string): boolean {
  const normalizedText = normalizeSearchString(text);
  const normalizedSearch = normalizeSearchString(search);

  return normalizedText.includes(normalizedSearch);
}

/**
 * Calcola score di similarità tra due stringhe (per ordinamento risultati)
 * Ritorna un numero tra 0 (nessuna corrispondenza) e 1 (match perfetto)
 */
export function similarityScore(text: string, search: string): number {
  const normalizedText = normalizeSearchString(text);
  const normalizedSearch = normalizeSearchString(search);

  if (normalizedText === normalizedSearch) return 1;
  if (!normalizedText.includes(normalizedSearch)) return 0;

  // Score basato su posizione del match (all'inizio = più rilevante)
  const index = normalizedText.indexOf(normalizedSearch);
  const positionScore = 1 - (index / normalizedText.length);

  // Score basato su lunghezza del match
  const lengthScore = normalizedSearch.length / normalizedText.length;

  return (positionScore + lengthScore) / 2;
}
