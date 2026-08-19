import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

export async function generatePdf(html: string, templateDir: string): Promise<Buffer> {
  // Inline local images as base64 data URIs — setContent() runs from about:blank
  // so file:// URLs are blocked by the browser's cross-origin policy.
  const inlinedHtml = html.replace(/src="([^"]+)"/g, (match, src: string) => {
    if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('file:')) {
      return match;
    }
    const imgPath = path.join(templateDir, src);
    if (!fs.existsSync(imgPath)) return match;
    const ext = path.extname(src).slice(1).toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    const data = fs.readFileSync(imgPath).toString('base64');
    return `src="data:${mime};base64,${data}"`;
  });

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(inlinedHtml, { waitUntil: 'load' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
