from flask import Flask, request, jsonify, send_file, make_response
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time
import os
from datetime import datetime

app = Flask(__name__)

def scrape_instagram(username):
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)

    try:
        driver.get(f"https://www.instagram.com/{username}/")
        time.sleep(10)

        for _ in range(4):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(4)

        soup = BeautifulSoup(driver.page_source, "html.parser")

        name_tag = soup.find("h2")
        name = name_tag.get_text(strip=True) if name_tag else "Неизвестно"

        bio_tag = soup.find("div", class_=lambda x: x and "x1lliihq" in x)
        bio = bio_tag.get_text(strip=True) if bio_tag else "Без био"

        posts = soup.find_all("div", class_="x1lliihq")[:25]
        captions = []
        images = []

        for p in posts:
            text_tag = p.find("h1") or p.find("span", class_="x1lliihq")
            text = text_tag.get_text(strip=True)[:500] if text_tag else "Без текста"
            captions.append(text)

            img = p.find("img")
            img_url = img["src"] if img and "src" in img.attrs else "Нет изображения"
            images.append(img_url)

        return {
            "username": username,
            "name": name,
            "bio": bio,
            "captions": captions,
            "images": images,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as e:
        return {"error": str(e)}
    finally:
        driver.quit()

@app.route('/parse')
def parse():
    username = request.args.get('u', '').strip().replace('@', '')
    if not username:
        return jsonify({"error": "no username"}), 400

    print(f"Парсим @{username}...")
    data = scrape_instagram(username)

    if "error" in data:
        return jsonify(data), 500

    txt_content = f"""КВАНТОВЫЙ ПАСПОРТ ИДЕНТИЧНОСТИ
Проект «Квантовая идентичность» · Влада Садик · 2025–2026

Instagram: @{data['username']}
Имя: {data['name']}
Био: {data['bio']}
Дата сканирования: {data['timestamp']}

────────────────────────────────────────
ПОСЛЕДНИЕ ПОСТЫ (до 25 шт.)
────────────────────────────────────────\n\n"""

    for i, (text, img) in enumerate(zip(data['captions'], data['images']), 1):
        txt_content += f"Пост {i:02d}\n{text}\nФото: {img}\n{'─' * 50}\n\n"

    filename = f"@{username}_quantum_mirror_2025.txt"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(txt_content)

    response = make_response(jsonify({
        "status": "success",
        "download_url": f"https://quantid-backend.onrender.com/download?u={username}",
        "data": data
    }))
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

@app.route('/download')
def download():
    username = request.args.get('u', '').strip().replace('@', '')
    filename = f"@{username}_quantum_mirror_2025.txt"
    if os.path.exists(filename):
        return send_file(filename, as_attachment=True, download_name=filename)
    else:
        return "Файл не найден или устарел", 404

@app.route('/')
def health():
    return "quantid-backend alive · Влада Садик 2025 ❤️"

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 5000)))
