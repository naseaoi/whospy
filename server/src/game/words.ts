import fs from 'fs';
import path from 'path';

export interface WordPair {
  civilian: string;
  spy: string;
  category: string;
}

let cachedWordLibrary: WordPair[] | null = null;

function loadWordsFromFile(filePath: string, category: string): WordPair[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  return lines.map(line => {
    const parts = line.trim().split('|');
    if (parts.length !== 2) {
      return null;
    }

    const [word1, word2] = parts.map(w => w.trim()).filter(Boolean);
    if (!word1 || !word2) {
      return null;
    }

    const shouldSwap = Math.random() < 0.5;
    return {
      civilian: shouldSwap ? word2 : word1,
      spy: shouldSwap ? word1 : word2,
      category
    };
  }).filter((pair): pair is WordPair => pair !== null);
}

function loadWordLibrary(): WordPair[] {
  const wordbankDir = path.join(__dirname, 'wordbank');

  if (!fs.existsSync(wordbankDir)) {
    throw new Error('词库目录不存在');
  }

  const files = fs.readdirSync(wordbankDir).filter(file => file.endsWith('.txt'));

  if (files.length === 0) {
    throw new Error('词库为空');
  }

  const allWords: WordPair[] = [];

  for (const file of files) {
    const category = path.basename(file, '.txt');
    const filePath = path.join(wordbankDir, file);
    const words = loadWordsFromFile(filePath, category);
    allWords.push(...words);
  }

  return allWords;
}

function getWordLibrary(): WordPair[] {
  if (!cachedWordLibrary) {
    cachedWordLibrary = loadWordLibrary();
  }
  return cachedWordLibrary;
}

export function getRandomWord(): WordPair {
  const library = getWordLibrary();
  if (library.length === 0) {
    throw new Error('词库为空，请检查 wordbank 目录');
  }
  return library[Math.floor(Math.random() * library.length)];
}

export function reloadWordLibrary(): void {
  cachedWordLibrary = null;
}
