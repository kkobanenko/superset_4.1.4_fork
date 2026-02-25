#!/usr/bin/env python3
"""
Скрипт для открытия GitLab в браузере через Playwright
"""
from playwright.sync_api import sync_playwright
import time

url = "https://gitlab.gdpgroup.ru"

print(f"Открываю {url} в браузере...")

with sync_playwright() as p:
    # Запускаем браузер в не-headless режиме (видимый)
    browser = p.chromium.launch(headless=False)
    context = browser.new_context(
        viewport={"width": 1280, "height": 1024}
    )
    page = context.new_page()
    
    try:
        print(f"Переход на {url}...")
        page.goto(url, timeout=30000, wait_until="domcontentloaded")
        print(f"✅ Страница загружена: {page.title()}")
        print(f"Текущий URL: {page.url}")
        
        # Держим браузер открытым
        print("Браузер открыт. Нажмите Enter для закрытия...")
        input()
    except Exception as e:
        print(f"❌ Ошибка при открытии страницы: {e}")
        print(f"Проверьте доступность {url}")
        input("Нажмите Enter для закрытия...")
    finally:
        browser.close()
