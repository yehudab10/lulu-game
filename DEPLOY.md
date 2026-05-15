# How to put Lulu's Road Trip on lulu.boats

This is a one-time setup — about **15 minutes**. After this, your game lives at **https://lulu.boats** forever, for **$0/month**. You don't need to know any code.

You'll do three things:
1. Make a free GitHub account and upload the game folder
2. Turn on "GitHub Pages" with one toggle
3. Point lulu.boats at GitHub by changing a couple settings in Namecheap

---

## Part 1 — Upload the game to GitHub (5 min)

### 1. Create a free GitHub account
- Go to **https://github.com/signup**
- Pick a username, enter your email, choose a password
- Verify your email when GitHub sends a confirmation

### 2. Create a new repository
- After logging in, click the **+** in the top-right corner → **"New repository"**
- **Repository name:** `lulu-game` (or anything you like)
- **Public** (must be public for free GitHub Pages)
- **Don't** check "Add a README" — we already have files
- Click **"Create repository"**

### 3. Upload all the files
On the new empty repo page, you'll see a line that says *"uploading an existing file"* — click it.

Then drag **every file** from your `lulu game` folder into the upload box:
- `index.html`
- `game.js`
- `style.css`
- `manifest.webmanifest`
- `icon-192.svg`
- `icon-512.svg`
- `CNAME`
- `.nojekyll`
- `DEPLOY.md` (this file — optional)

Scroll down, click the green **"Commit changes"** button.

> **Tip:** if you don't see `.nojekyll` in your folder, that's because Windows hides files starting with a dot. In File Explorer click **View → Show → Hidden items** to see it.

---

## Part 2 — Turn on GitHub Pages (1 min)

1. In your repo, click the **Settings** tab (top-right).
2. In the left sidebar, click **Pages**.
3. Under **"Build and deployment"**:
   - **Source:** *Deploy from a branch*
   - **Branch:** `main` and `/ (root)`
4. Click **Save**.
5. Wait ~30 seconds, then refresh the page. You'll see a green ✓ with a URL like:
   ```
   https://YOUR-USERNAME.github.io/lulu-game/
   ```
6. **Click that link** — your game should load! 🎉 (If it shows "404", wait another minute and refresh.)

### Custom domain setup
- Still on the Pages settings page, in the **Custom domain** box, type `lulu.boats` and click **Save**.
- It will say *"Domain's DNS record could not be retrieved"* — that's fine, we fix it in Part 3.
- Check the **"Enforce HTTPS"** box later, once Part 3 is done (GitHub will get a free SSL cert automatically).

---

## Part 3 — Point lulu.boats at GitHub via Namecheap (5 min)

1. Sign in to **https://namecheap.com**.
2. Go to **Domain List** in the sidebar → find **lulu.boats** → click **Manage**.
3. Click the **Advanced DNS** tab at the top.
4. **Delete** any existing records you don't recognize (like "Parking Page" CNAMEs that Namecheap adds by default). Keep anything you specifically use for email.
5. Click **"Add New Record"** four times to add these four **A records** (these are GitHub's official Pages IP addresses):

| Type     | Host | Value             | TTL       |
|----------|------|-------------------|-----------|
| A Record | @    | 185.199.108.153   | Automatic |
| A Record | @    | 185.199.109.153   | Automatic |
| A Record | @    | 185.199.110.153   | Automatic |
| A Record | @    | 185.199.111.153   | Automatic |

6. Then **one more record** — a CNAME so `www.lulu.boats` also works:

| Type        | Host | Value                       | TTL       |
|-------------|------|-----------------------------|-----------|
| CNAME Record| www  | YOUR-USERNAME.github.io.    | Automatic |

(Replace `YOUR-USERNAME` with your real GitHub username. **Keep the trailing dot** — Namecheap needs it.)

7. Click the green **✓ check mark** next to each row to save it.

### Wait for DNS
DNS changes spread across the internet — usually **5 minutes**, sometimes up to an hour. Go grab coffee.

You can check progress at **https://dnschecker.org** — paste `lulu.boats` and pick **A** record. When you see those four `185.199.x.x` IPs lit up green, you're done.

### Final step — turn on HTTPS
- Back in GitHub: **Settings → Pages**
- Check the box **"Enforce HTTPS"** (it may be greyed out for a few minutes; come back later if so)

---

## You're live! 🎉

Open **https://lulu.boats** on your phone — it should work on iPhone Safari and Android Chrome.

### To update the game later
- Edit any file on your computer.
- In your GitHub repo, click the file → click the pencil ✏️ icon → paste the new contents → "Commit changes".
- OR drag the new files into your repo to replace the old ones.
- It takes about a minute for GitHub Pages to redeploy.

### Mobile bonus: install as an app
On your phone, after opening lulu.boats:
- **iPhone:** tap the Share button → **"Add to Home Screen"**
- **Android:** Chrome menu → **"Install app"** (or "Add to Home Screen")

You'll get a real-looking app icon with no address bar. 📱

---

## Troubleshooting

**"404 — site not found"** on the GitHub URL right after enabling Pages
→ Wait 1–2 minutes and refresh. First deploys are slow.

**lulu.boats says "site can't be reached" after waiting**
→ DNS might still be propagating. Check dnschecker.org. If all four IPs aren't green after an hour, double-check the A records in Namecheap — typos in IPs are the #1 cause.

**HTTPS box is greyed out in GitHub**
→ Wait. GitHub needs DNS to be fully working before it can issue an SSL certificate. Try again in an hour.

**Game looks zoomed in / scrolls on phone**
→ Hard refresh the page (pull down to refresh on mobile). Cached version might be loading.

**I want to use the bare apex `lulu.boats` AND `www.lulu.boats` to both work**
→ The setup above already does this — apex via A records, www via CNAME. GitHub auto-redirects www to the apex.
