import type { NextApiRequest, NextApiResponse } from 'next';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const locale = (req.query.locale as string) || 'en';
  const outputDir = join(process.cwd(), 'public/_tyndale');
  const filePath = join(outputDir, `${locale}.json`);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: `No translations for ${locale}` });
  }

  try {
    const translations = JSON.parse(readFileSync(filePath, 'utf-8'));
    return res.status(200).json(translations);
  } catch {
    return res.status(500).json({ error: 'Failed to read translations' });
  }
}
