[Русский](README.md) · [Қазақша](README.kz.md) · **English**

# Simple Univer: download page

The site https://sssox.github.io/SimpleUniver/ helps people download Simple Univer, an unofficial client for univer.kaznu.kz. It detects the visitor's system and offers the right file:

- Windows 10 and 11 (Modern) or Windows 7, 8 and 8.1 (Legacy), 64 or 32 bit, installer or portable ZIP;
- Android, an APK file with a QR code for the phone;
- the extension for Chrome, Edge and Firefox when there is no app for the system (macOS, Linux, ChromeOS, Windows on ARM).

Every file shows its size and SHA-256. The page also has screenshots, a comparison of the versions, answers to common questions and the [extension privacy policy](https://sssox.github.io/SimpleUniver/privacy/) the stores ask for.

The apps and their code live in other repositories:

- Windows and the extension: [SSSox/Simple-UniverKazNU-Desktop](https://github.com/SSSox/Simple-UniverKazNU-Desktop)
- Android: [SSSox/Simple-UniverKazNU-Android](https://github.com/SSSox/Simple-UniverKazNU-Android)

## How the site works

Plain HTML, CSS and JavaScript with no framework and no dependencies. The site loads no outside fonts, scripts or counters: the visitor's browser talks only to sssox.github.io and downloads the files from GitHub.

| Path | What it holds |
|---|---|
| `site/index.html` | the download page; the Russian text sits in the HTML and shows without JavaScript |
| `site/assets/strings.js` | texts in Russian, Kazakh and English |
| `site/assets/detect.js` | system and bitness detection |
| `site/assets/site.js` | language, tabs, file links, gallery |
| `site/privacy/` | the extension policy in three languages, static HTML |
| `site/data/releases.json` | data about the latest releases; written by the build |
| `scripts/releases.mjs` | reads the latest releases through the GitHub API and writes `releases.json` |
| `stores.json` | store links for the extension |

The site gets release data at build time, not in the visitor's browser. On the university network many students share one address, and without a token the GitHub API allows only 60 requests an hour.

## Running it locally

You need Node.js 20 or newer.

```bash
node --test "tests/*.test.mjs"
```

```bash
node scripts/releases.mjs
```

```bash
node scripts/serve.mjs
```

The first command runs the tests: system detection, parsing of API answers, matching texts in three languages. The second downloads release data into `site/data/releases.json`; with a `GITHUB_TOKEN` variable the request limit is higher. The third serves the site at http://127.0.0.1:8780/SimpleUniver/ (pass another port as the first argument).

## Publishing

The workflow `.github/workflows/pages.yml` tests the site, collects release data and publishes the `site` folder to GitHub Pages. It runs after every push to `main`, every 6 hours, and by hand with «Run workflow» on the Actions tab. A new app release reaches the site within 6 hours.

If the GitHub API does not answer, the build stops with an error and the previous version of the site stays up.

Once, in the repository settings: Settings → Pages → Source: **GitHub Actions**.

GitHub turns off the schedule when a repository has had no commits for 60 days. The site then misses new releases until someone turns the workflow back on in the Actions tab or runs it by hand.

## Store links

Until the extension is published, the site offers a ZIP for manual installation. After publication, put the addresses in `stores.json`:

```json
{
  "chrome": "https://chromewebstore.google.com/detail/…",
  "edge": "https://microsoftedge.microsoft.com/addons/detail/…",
  "firefox": "https://addons.mozilla.org/…"
}
```

The build skips an address that starts differently. An empty string means "not published yet".

## License

GPL-3.0-or-later, like both apps. The license text is in [LICENSE](LICENSE).
