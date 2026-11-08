import { parseRecipe, SAMPLE_MARKDOWN } from './recipe-parser.js';
import { listRecipes, getRecipe, putRecipe, removeRecipe, importRecipes } from './recipe-store.js';

const $ = id => document.getElementById(id);
const state = { recipes: [], filter: 'all', query: '', editing: null, viewing: null, deferredInstall: null };
const escFileName = s => (s || 'recipe').replace(/[^a-z0-9._ -]/gi, '_').slice(0, 70);
const now = () => new Date().toISOString();
const parseOrThrow = markdown => { const parsed = parseRecipe(markdown); if (!parsed.valid) throw new Error(parsed.error); return parsed; };
let toastTimeout;

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('toast').classList.add('hidden'), 4200);
}
function showDialog(id) {
  const el = $(id);
  if (!el.open) el.showModal();
}
function closeDialog(id) { if ($(id).open) $(id).close(); }
function create(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function button(label, cls, action, title) {
  const el = create('button', cls, label);
  el.type = 'button';
  if (title) el.title = title;
  el.addEventListener('click', action);
  return el;
}
function addLine(parent, label, val) {
  if (!val) return;
  const part = create('span', 'meta-chip');
  part.append(create('strong', null, label + ' '), document.createTextNode(val));
  parent.append(part);
}
function sortedRecipes() {
  return [...state.recipes].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
function filteredRecipes() {
  return sortedRecipes().filter(recipe => {
    if (state.filter === 'favourites' && !recipe.favorite) return false;
    if (['baking', 'dinner', 'other'].includes(state.filter) && recipe.category !== state.filter) return false;
    const needle = state.query.trim().toLowerCase();
    if (!needle) return true;
    return [recipe.title, recipe.markdown].join(' ').toLowerCase().includes(needle);
  });
}
function render() {
  const all = state.recipes;
  $('recipeCount').textContent = String(all.length);
  const grid = $('recipeGrid');
  grid.replaceChildren();
  const found = filteredRecipes();
  $('emptyState').classList.toggle('hidden', found.length > 0);
  if (!found.length) {
    $('emptyTitle').textContent = all.length ? 'No recipes found.' : 'Your next great recipe belongs here.';
    $('emptyDescription').textContent = all.length ? 'Try a different search or category.' : 'Copy the finished recipe from ChatGPT, paste it here and it’s yours to keep.';
    $('sampleBtn').classList.toggle('hidden', all.length > 0);
  }
  for (const recipe of found) {
    const card = create('article', 'recipe-card');
    const top = create('div', 'card-art ' + (recipe.category || 'other'));
    top.append(create('span', 'art-glyph', recipe.category === 'baking' ? '♨' : recipe.category === 'dinner' ? '✿' : '♡'));
    const heart = button(recipe.favorite ? '♥' : '♡', 'heart-button', async () => {
      recipe.favorite = !recipe.favorite;
      try { await putRecipe(recipe); await refresh(); } catch (e) { toast('Could not save: ' + e.message); }
    }, recipe.favorite ? 'Remove favourite' : 'Add favourite');
    heart.setAttribute('aria-label', recipe.favorite ? 'Remove from favourites' : 'Add to favourites');
    top.append(heart);
    const body = create('div', 'card-body');
    body.append(create('p', 'card-category', recipe.category || 'other'));
    body.append(create('h3', null, recipe.title));
    const details = create('div', 'card-meta');
    addLine(details, 'Prep', recipe.prep);
    addLine(details, 'Cook', recipe.cook);
    if (!details.children.length) details.append(create('span', null, 'Your own creation'));
    body.append(details);
    body.append(button('View recipe  →', 'card-open', () => openDetail(recipe.id)));
    card.append(top, body);
    grid.append(card);
  }
}
async function refresh() { state.recipes = await listRecipes(); render(); }
function preview() {
  const result = parseRecipe($('markdownInput').value);
  const target = $('parsePreview');
  target.replaceChildren();
  if (!result.valid) {
    target.append(create('span', null, '✧ ' + result.error));
    target.classList.remove('ready');
  } else {
    target.classList.add('ready');
    target.append(create('strong', null, '✓ ' + result.title));
    target.append(create('span', null, `${result.ingredients.length} ingredients · ${result.steps.length} steps`));
  }
}
function openEditor(id = null, preset = '') {
  state.editing = id;
  const record = state.recipes.find(r => r.id === id);
  $('editorTitle').textContent = record ? 'Edit your recipe' : 'Add a recipe';
  $('saveRecipeBtn').textContent = record ? 'Save new version' : 'Save recipe';
  $('markdownInput').value = record ? record.markdown : preset;
  preview();
  closeDialog('recipeDialog');
  showDialog('editorDialog');
}
async function saveEditor(event) {
  event.preventDefault();
  try {
    const parsed = parseOrThrow($('markdownInput').value);
    const previous = state.editing ? await getRecipe(state.editing) : null;
    if (previous && parsed.markdown === previous.markdown) { closeDialog('editorDialog'); toast('No changes to save.'); return; }
    const previousVersions = previous ? [...(previous.versions || []), { markdown: previous.markdown, savedAt: previous.updatedAt || previous.createdAt }] : [];
    const record = {
      ...parsed,
      id: previous ? previous.id : crypto.randomUUID(),
      createdAt: previous ? previous.createdAt : now(),
      updatedAt: now(),
      favorite: previous ? !!previous.favorite : false,
      versions: previousVersions.slice(-100),
    };
    await putRecipe(record);
    closeDialog('editorDialog');
    await refresh();
    toast(previous ? 'New recipe version saved!' : 'Recipe saved to your cookbook!');
    if (previous) openDetail(record.id);
  } catch (e) { toast(e.message); }
}
function buildSection(parent, heading, items, numbered = false) {
  if (!items.length) return;
  parent.append(create('h3', 'detail-section-heading', heading));
  const list = create(numbered ? 'ol' : 'ul', 'detail-list' + (numbered ? ' steps-list' : ''));
  items.forEach(text => list.append(create('li', null, text)));
  parent.append(list);
}
async function openDetail(id) {
  const record = await getRecipe(id);
  if (!record) { toast('This recipe is no longer here.'); await refresh(); return; }
  state.viewing = id;
  const holder = $('recipeDetail'); holder.replaceChildren();
  $('detailCategory').textContent = (record.category || 'other').toUpperCase() + ' · YOUR RECIPE';
  holder.append(create('h2', 'detail-title', record.title));
  const meta = create('div', 'detail-meta');
  addLine(meta, 'Serves', record.servings); addLine(meta, 'Prep', record.prep); addLine(meta, 'Cook', record.cook);
  if (meta.children.length) holder.append(meta);
  const actions = create('div', 'detail-actions');
  actions.append(button('✎ Edit recipe', 'button primary small', () => openEditor(id)));
  actions.append(button(record.favorite ? '♥ Favourite' : '♡ Favourite', 'button outline small', async () => {
    record.favorite = !record.favorite; await putRecipe(record); await refresh(); openDetail(id);
  }));
  actions.append(button('↓ Save .md', 'button outline small', () => downloadText(record.markdown + '\n', escFileName(record.title) + '.md', 'text/markdown')));
  holder.append(actions);
  buildSection(holder, 'Ingredients', record.ingredients || []);
  buildSection(holder, 'Method', record.steps || [], true);
  buildSection(holder, 'Notes & ideas', record.notes || []);
  const versions = record.versions || [];
  const history = create('section', 'version-section');
  history.append(create('h3', null, `Recipe history · ${versions.length + 1} version${versions.length ? 's' : ''}`));
  history.append(create('p', 'subtle', 'Each time you edit, the previous recipe is kept here.'));
  versions.forEach((version, index) => {
    const row = create('div', 'version-row');
    const time = version.savedAt ? new Date(version.savedAt).toLocaleDateString() : 'Earlier version';
    row.append(create('span', null, `Version ${index + 1} · ${time}`));
    row.append(button('Restore', 'button outline small', async () => {
      if (!confirm(`Restore version ${index + 1}? Your current version will be kept in history.`)) return;
      try {
        const parsed = parseOrThrow(version.markdown);
        record.versions = [...versions, { markdown: record.markdown, savedAt: record.updatedAt || now() }].slice(-100);
        Object.assign(record, parsed, { updatedAt: now() });
        await putRecipe(record); await refresh(); await openDetail(id); toast('Earlier version restored.');
      } catch (e) { toast(e.message); }
    }));
    history.append(row);
  });
  holder.append(history);
  holder.append(button('Delete this recipe', 'delete-link', async () => {
    if (!confirm(`Delete “${record.title}” and all its versions? This cannot be undone unless you have a backup.`)) return;
    try { await removeRecipe(id); closeDialog('recipeDialog'); await refresh(); toast('Recipe deleted.'); }
    catch (e) { toast(e.message); }
  }));
  showDialog('recipeDialog');
}
function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function backup() {
  const recipes = await listRecipes();
  const payload = JSON.stringify({ app: 'recipe-nest', schema: 1, exportedAt: now(), recipes }, null, 2);
  downloadText(payload, 'recipe-nest-backup-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json');
  toast('Backup downloaded. Keep it somewhere safe.');
}
async function restore(file) {
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) throw new Error('That backup is too large (maximum 25 MB).');
  const parsed = JSON.parse(await file.text());
  if (parsed?.app !== 'recipe-nest' || parsed?.schema !== 1 || !Array.isArray(parsed.recipes)) throw new Error('Please choose a Recipe Nest backup file.');
  if (!confirm(`Import ${parsed.recipes.length} recipe(s)? Existing recipes will not be overwritten.`)) return;
  const count = await importRecipes(parsed.recipes);
  await refresh(); closeDialog('toolsDialog'); toast(`${count} recipe${count === 1 ? '' : 's'} imported!`);
}
function wire() {
  for (const id of ['addBtn', 'heroAddBtn', 'emptyAddBtn']) $(id).addEventListener('click', () => openEditor());
  $('sampleBtn').addEventListener('click', () => openEditor(null, SAMPLE_MARKDOWN));
  for (const id of ['toolsBtn']) $(id).addEventListener('click', () => showDialog('toolsDialog'));
  for (const id of ['backupBtn', 'downloadBackup']) $(id).addEventListener('click', () => backup().catch(e => toast(e.message)));
  document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => closeDialog(el.dataset.close)));
  $('markdownInput').addEventListener('input', preview);
  $('editorForm').addEventListener('submit', saveEditor);
  $('markdownFile').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try { if (file.size > 200000) throw new Error('Recipe files must be smaller than 200 KB.'); $('markdownInput').value = await file.text(); preview(); }
    catch (error) { toast(error.message); }
    e.target.value = '';
  });
  $('restoreFile').addEventListener('change', e => {
    restore(e.target.files[0]).catch(err => toast('Could not restore: ' + err.message)); e.target.value = '';
  });
  $('searchInput').addEventListener('input', e => { state.query = e.target.value; render(); });
  document.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('click', () => {
    state.filter = el.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(chip => {
      const active = chip === el; chip.classList.toggle('active', active); chip.setAttribute('aria-pressed', String(active));
    });
    render();
  }));
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); state.deferredInstall = e; $('installBtn').classList.remove('hidden');
  });
  $('installBtn').addEventListener('click', async () => {
    if (!state.deferredInstall) return;
    state.deferredInstall.prompt(); await state.deferredInstall.userChoice;
    state.deferredInstall = null; $('installBtn').classList.add('hidden');
  });
}
wire();
refresh().catch(e => toast('Recipe storage is unavailable: ' + e.message));
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}