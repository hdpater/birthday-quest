# Birthday Quest 🕯️

A birthday RPG adventure. Collect all 50 candles and bring them to the Warlock!

## How to host on GitHub Pages

### One-time setup (5 minutes)

**Step 1 — Create a GitHub repository**
1. Go to https://github.com/new
2. Name it `birthday-quest` (or anything you like)
3. Set it to **Public**
4. Click **Create repository** — do NOT tick "Add README"

**Step 2 — Upload these files**

Option A — via GitHub website (easiest):
1. On your new empty repo page, click **uploading an existing file**
2. Drag the entire `birthday-quest` folder contents into the upload area
3. Make sure the folder structure is preserved (especially `.github/workflows/deploy.yml`)
4. Commit to `main`

Option B — via terminal:
```bash
cd birthday-quest
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/birthday-quest.git
git push -u origin main
```

**Step 3 — Enable GitHub Pages**
1. Go to your repo → **Settings** → **Pages** (left sidebar)
2. Under "Source", select **GitHub Actions**
3. Click Save

**Step 4 — Wait ~2 minutes**

GitHub Actions will automatically build and deploy. Go to:
- **Actions** tab to watch the build
- **Settings → Pages** to find your URL

Your game will be live at:
`https://YOUR_USERNAME.github.io/birthday-quest/`

### Re-deploying after changes
Any push to `main` automatically rebuilds and redeploys.
