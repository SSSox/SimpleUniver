**Русский** · [Қазақша](README.kz.md) · [English](README.en.md)

# Simple Univer: страница загрузок

Сайт https://sssox.github.io/SimpleUniver/ помогает скачать Simple Univer, неофициальный клиент сайта univer.kaznu.kz. Он сам определяет систему посетителя и предлагает нужный файл:

- Windows 10 и 11 (Modern) или Windows 7, 8 и 8.1 (Legacy), 64 или 32 бита, установщик или portable ZIP;
- Android, файл APK с QR-кодом для телефона;
- расширение для Chrome, Edge и Firefox, если приложения для системы нет (macOS, Linux, ChromeOS, Windows на ARM).

У каждого файла указаны размер и SHA-256. Есть скриншоты, ответы на частые вопросы и [политика конфиденциальности расширения](https://sssox.github.io/SimpleUniver/privacy/), которую требуют магазины.

Само приложение и его код живут в других репозиториях:

- Windows и расширение: [SSSox/Simple-UniverKazNU-Desktop](https://github.com/SSSox/Simple-UniverKazNU-Desktop)
- Android: [SSSox/Simple-UniverKazNU-Android](https://github.com/SSSox/Simple-UniverKazNU-Android)

## Как устроен сайт

Обычные HTML, CSS и JavaScript без фреймворков и без зависимостей. Сайт не загружает чужие шрифты, скрипты и счётчики: браузер посетителя обращается только к sssox.github.io, а файлы скачивает с GitHub.

| Путь | Что там |
|---|---|
| `site/index.html` | страница загрузок; русский текст лежит прямо в HTML и виден без JavaScript |
| `site/assets/strings.js` | тексты на русском, казахском и английском |
| `site/assets/detect.js` | определение системы и разрядности |
| `site/assets/site.js` | язык, вкладки, ссылки на файлы, галерея |
| `site/privacy/` | политика расширения на трёх языках, статический HTML |
| `site/data/releases.json` | данные о последних релизах; создаётся при сборке |
| `scripts/releases.mjs` | читает последние релизы через GitHub API и пишет `releases.json` |
| `stores.json` | ссылки на расширение в магазинах |

Данные о релизах сайт получает при сборке, а не в браузере посетителя. В сети университета много студентов выходят в интернет с одного адреса, и без токена GitHub API разрешает только 60 запросов в час.

## Запуск у себя

Нужен Node.js 22 или новее.

```bash
node --test "tests/*.test.mjs"
```

```bash
node scripts/releases.mjs
```

```bash
node scripts/serve.mjs
```

Первая команда запускает тесты: определение системы, разбор ответов API, совпадение текстов на трёх языках. Вторая скачивает данные о релизах в `site/data/releases.json`; с переменной `GITHUB_TOKEN` лимит запросов выше. Третья открывает сайт по адресу http://127.0.0.1:8780/SimpleUniver/ (порт можно передать первым аргументом).

## Публикация

Workflow `.github/workflows/pages.yml` проверяет сайт, собирает данные о релизах и публикует папку `site` на GitHub Pages. Он запускается после каждого push в `main`, каждые 6 часов и вручную кнопкой «Run workflow» на вкладке Actions. Новый релиз приложения появляется на сайте не позже чем через 6 часов.

Если GitHub API не ответил, сборка останавливается с ошибкой и на сайте остаётся прошлая версия.

## Лицензия

GPL-3.0-or-later, как у обоих приложений. Текст лицензии в файле [LICENSE](LICENSE).
