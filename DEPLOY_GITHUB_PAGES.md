# How to Deploy on GitHub Pages

1. **Push your code to a public GitHub repository**
   - Go to https://github.com and create a new public repository (e.g., `KairoScrapper`).
   - On your computer, open a terminal and run:
     ```sh
     git init
     git remote add origin https://github.com/YOUR_USERNAME/KairoScrapper.git
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git push -u origin main
     ```
   - Replace `YOUR_USERNAME` with your GitHub username.

2. **Set up GitHub Pages**
   - Go to your repository on GitHub.
   - Click on `Settings` > `Pages` (or `Code and automation` > `Pages`).
   - Under `Source`, select `Deploy from a branch`.
   - Select the `main` branch and set the folder to `/docs`.
   - Click `Save`.

3. **Access your site**
   - After a few minutes, your site will be live at `https://YOUR_USERNAME.github.io/KairoScrapper/`.

---

## Notes
- Only the files in the `docs/` folder will be served. Your Python files (`app.py`, `hello.py`) will NOT run on GitHub Pages.
- All static content (HTML, JS, CSS) is already in the `docs/` folder.
- You can edit `docs/index.html` and `docs/app.js` to update your site.
