# SZZ Vozový park

Jednoduchá webová aplikace pro evidenci firemních vozidel.

## Nasazení na GitHub Pages

1. Na GitHubu vytvoř nový veřejný repozitář, například `szz-vozovy-park`.
2. Do kořenové složky repozitáře nahraj všechny tyto soubory:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `logo.svg`
   - `manifest.webmanifest`
   - `sw.js`
   - `README.md`
3. Otevři **Settings → Pages**.
4. V části **Build and deployment** zvol **Deploy from a branch**.
5. Vyber větev **main** a složku **/(root)**.
6. Ulož nastavení. GitHub následně zobrazí adresu aplikace.

## Důležité omezení této verze

Data se ukládají do prohlížeče konkrétního zařízení pomocí Local Storage. Na jiném telefonu nebo počítači proto nebudou automaticky vidět. Pro společná firemní data a přihlášení zaměstnanců je nutné připojit databázi, například Firebase.
