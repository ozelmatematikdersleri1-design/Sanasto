export const GOOGLE_AI_MODE_SEARCH_URL = 'https://www.google.com/search?udm=50&q=';

export function buildTranslationPrompt(wordsText: string): string | null {
  const lines = wordsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  return [
    'Aşağıda Türkçe veya Fince kelimeler var. Türkçe kelimelerin Fince karşılığını, Fince kelimelerin Türkçe karşılığını bul.',
    'Çıktıyı yalnızca "Fince - Türkçe" biçiminde, her satırda bir kelime olacak şekilde ver. Numara, başlık, açıklama veya boş satır ekleme.',
    '',
    'Kelimeler:',
    ...lines,
  ].join('\n');
}
