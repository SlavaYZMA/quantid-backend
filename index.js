const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());

// Увеличиваем таймауты и добавляем обход блокировки
async function scrape(username) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-blink-features=AutomationControlled'
    ],
    defaultViewport: null
  });

  const page = await browser.newPage();
  
  // Максимально скрываем автоматизацию
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  });

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  try {
    await page.goto(`https://www.instagram.com/${username}/`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });

    // Ждём либо посты, либо экран логина — но не падаем
    await page.waitForTimeout(8000);

    // Пытаемся кликнуть "Не сейчас" если выскочил попап логина
    try {
      const notNow = await page.$x("//button[contains(text(), 'Не сейчас')]");
      if (notNow.length > 0) await notNow[0].click();
      await page.waitForTimeout(3000);
    } catch(e) {}

    // Скроллим агрессивно
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(4000);
    }

    const data = await page.evaluate(() => {
      const name = document.querySelector('h2')?.innerText.trim() || document.querySelector('header section h2')?.innerText.trim() || 'Неизвестно';
      
      const bioEl = [...document.querySelectorAll('span, div')].find(el => 
        el.innerText && el.innerText.length > 10 && el.innerText.length < 300 && !el.querySelector('a')
      );
      const bio = bioEl ? bioEl.innerText.trim() : 'Без био';

      const imgs = [...document.querySelectorAll('article img')].slice(0, 25);
      const captions = imgs.map(img => img.alt || img.getAttribute('aria-label') || 'Без описания');
      const images = imgs.map(img => img.src || img.currentSrc);

      return { name, bio, captions, images: images.length ? images : ['no images'] };
    });

    await browser.close();
    return data;

  } catch (err) {
    await browser.close();
    return { name: 'Instagram заблокировал запрос', bio: 'Попробуй позже или используй другой профиль', captions: ['Временно недоступно'], images: [] };
  }
}

app.get('/parse', async (req, res) => {
  const u = (req.query.u || '').replace('@', '').trim().toLowerCase();
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

${data.captions.map((c, i) => `Пост ${i+1}\n${c}\nФото: ${data.images[i] || 'нет'}\n${'─'.repeat(50)}\n`).join('')}`;

    const filename = `@${u}_quantum_mirror_2025.txt`;
    fs.writeFileSync(filename, txt, 'utf-8');

    res.json({
      status: "success",
      download_url: `https://quantid-backend-production.up.railway.app/download?u=${u}`,
      data
    });

  } catch (e) {
    res.status(500).json({ status: "error", message: "Instagram временно недоступен" });
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

app.get('/', (req, res) => res.send('quantid-backend-production · Влада Садик 2025 ❤️'));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log('Server running on port', port));
