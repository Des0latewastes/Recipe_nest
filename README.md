# Recipe Nest 🌿

A small, private, offline-first recipe book for iPhone, Android, and desktop. Paste a Markdown recipe copied from ChatGPT, preview it, save it, and keep older versions as you experiment.

No account, server, API key, framework or build step required. All recipes remain in this browser's local IndexedDB storage unless the user deliberately exports a backup file.

## What it does

- Imports ordinary Markdown with a `# Recipe title`, `## Ingredients`, `## Method`, and optional `## Notes` sections.
- Recognises optional metadata: `Servings:`, `Prep:`, `Cook:`, `Category:`.
- Organises recipes, searches names and ingredients, marks favourites, and filters by type.
- Saves the previous Markdown every time a recipe is edited, with one-tap restore.
- Exports individual `.md` recipes and full `.json` backups, and imports backups without overwriting existing IDs.
- Installs to a phone's home screen as a Progressive Web App when served over HTTPS and supports offline access after its first successful load.

## Quick local preview

From the repository folder:

```sh
python -m http.server 8080
```

Open http://localhost:8080 in a browser. For actual phone installation, publish this folder to an **HTTPS** static host such as GitHub Pages. You do **not** need a backend database or API key.

## Publish with GitHub Pages

1. Create a new GitHub repository named `Recipe_nest`.
2. Upload all files from this folder into the repository root (including the `icons` folder).
3. In **Settings → Pages**, enable deployment from the `main` branch, root (`/`).
4. Open the HTTPS URL GitHub Pages provides. It will usually be `https://des0latewastes.github.io/Recipe_nest/`.
5. On Android in Chrome, use the browser menu and choose **Install app** or **Add to Home screen**. On iPhone in Safari, use **Share → Add to Home Screen**.

A GitHub Pages site must be public on some account/repository configurations; don't publish actual recipe backups or private information to it. The shipped code contains no customer recipes.

## For the person writing recipes in ChatGPT

Ask: **“Please give me the final recipe in Markdown, using a title, Ingredients, Method and Notes headings.”**

Then tap **Add a recipe**, paste the text, check the preview and tap **Save recipe**. If you change the recipe next week, tap **Edit recipe** to create another version.

### Example

```markdown
# My Lemon Cake

Servings: 8
Prep: 20 minutes
Cook: 40 minutes
Category: Baking

## Ingredients
- 175g butter
- 175g caster sugar
- 3 eggs
- 175g self-raising flour

## Method
1. Cream butter and sugar.
2. Beat in the eggs and fold in the flour.
3. Bake at 180°C until cooked through.

## Notes
Next time, try more lemon zest.
```

## Storage and limits

- Recipes are stored locally in the particular browser/profile used to access the app. They do **not** automatically sync between phones.
- Deleting browser/site data or uninstalling an app can delete recipes. Use **Backup & restore → Download** regularly and save the backup somewhere you control.
- A backup preserves up to 100 stored previous versions per recipe. The import limit is 25 MB and 2000 recipes.
- An internet connection is needed the first time to install the offline cache. Subsequent use can work offline.
- No AI API calls are made by the app. ChatGPT is only used separately by the recipe author.

## Development

Modules:

- `recipe-parser.js`: permissive Markdown to structured recipe data (never renders imported HTML).
- `recipe-store.js`: IndexedDB persistence and backup import.
- `app.js`: interface and recipe revision management.
- `service-worker.js`: offline application shell caching.
- `styles.css`, `index.html`, `manifest.webmanifest`, `icons/*`: responsive installable UI.

To test the parser: `node --test tests/recipe-parser.test.mjs`.

## Licensing

MIT. See `LICENSE`.