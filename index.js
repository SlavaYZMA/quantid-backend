const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());

async function scrape(username) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  await page.goto(`https://www.instagram.com/${username}/`, { timeout: 60000 });

  // Ждём загрузки постов и скроллим
  await page.waitForSelector('article', { timeout: 15000 });
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(4000);
  }

  const result = await page.evaluate(() => {
    const name = document.querySelector('h2')?.innerText.trim() || 'Неизвестно';
    const bioEl = [...document.querySelectorAll('span')].find(s => s.innerText.length > 10 && !s.querySelector('a'));
    const bio = bioEl ? bioEl.innerText.trim() : 'Без био';

    const posts = [...document.querySelectorAll('article img')].slice(0, 25);
    const captions = posts.map(img => img.alt || 'Без описания');
    const images = posts.map(img => img.src);

    return { name, bio, captions, images };
  });

  await browser.close();
  return result;
}

app.get('/parse', async (req, res) => {
  const u = (req.query.u || '').replace('@', '').trim();
  if (!u) return res.status(400).json({ error: 'no username' });

  try {
    const data = await scrape(u);

    const txt = `КВАНТОВЫЙ ПАСПОРТ ИДЕНТИЧНОСТИ
Проект «Квантовая идентичность» · Влада Садик · 2025–2026

Instagram: @${u}
Имя: ${data.name}
Био: ${data.bio}
Дата сканирования: ${new Date().toLocaleString('ru-RU')}

────────────────────────────────────────
ПОСЛЕДНИЕ ПОСТЫ (до 25 шт.)
────────────────────────────────────────

${data.captions.map((c, i) => `Пост ${i+1}\n${c}\nФото: ${data.images[i]}\n${'─'.repeat(50)}\n`).join('')}`;

    const filename = `@${u}_quantum_mirror_2025.txt`;
    fs.writeFileSync(filename, txt, 'utf-8');

    res.json({
      status: "success",
      download_url: `https://quantid-backend.onrender.com/download?u=${u}`,
      data
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Instagram временно недоступен или профиль приватный' });
  }
});

app.get('/download', (req, res) => {
  const u = (req.query.u || '').replace('@', '');
  const file = `@${u}_quantum_mirror_2025.txt`;
  if (fs.existsSync(file)) {
    res.download(file);
  } else {
    res.status(404).send('Файл не найден');
  }
});

app.get('/', (req, res) => res.send('quantid-backend (Node.js + Puppeteer) alive · Влада Садик 2025 ❤️'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server running on port', port));
