/**
 * Recipe Nest Markdown parser.
 * This is deliberately permissive: an ordinary ChatGPT Markdown recipe is
 * enough. It does not evaluate HTML or Markdown and never returns HTML.
 */
const SECTION_WORDS = {
  ingredients: /^(ingredients?\b|what you(?:'ll| will) need\b|you(?:'ll| will) need\b)/i,
  steps: /^(method\b|instructions?\b|directions?\b|steps?\b|preparation\b|how to make(?: it)?\b|how to cook(?: it)?\b)/i,
  notes: /^(notes?\b|tips?\b|variations?\b|serving suggestions?\b|storage\b|make ahead\b)/i,
};

function clean(text) {
  return String(text ?? '').replace(/\*\*|__|\*/g, '').replace(/`/g, '').trim();
}

function classify(section) {
  const value = clean(section).replace(/:$/, '').trim();
  for (const [name, pattern] of Object.entries(SECTION_WORDS)) {
    if (pattern.test(value)) return name;
  }
  return 'notes';
}

function normalizeCategory(raw) {
  const value = clean(raw).toLowerCase();
  if (/bake|bread|cake|cookie|biscuit|dessert|pastry/.test(value)) return 'baking';
  if (/dinner|main|supper|lunch|meal|savoury|savory/.test(value)) return 'dinner';
  return 'other';
}

export function parseRecipe(markdown) {
  const source = String(markdown ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source) return { valid: false, error: 'Paste a recipe to get started.' };
  const lines = source.split('\n');
  let title = '', prep = '', cook = '', servings = '', category = 'other';
  let section = 'preamble';
  const ingredients = [], steps = [], notes = [];
  const preamble = [];

  for (const original of lines) {
    const line = original.trim();
    if (!line || line === '---') continue;
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      const value = clean(heading[1]);
      if (!title && /^#\s+/.test(line)) { title = value; section = 'preamble'; continue; }
      section = classify(value);
      continue;
    }
    const titleLine = line.match(/^(?:recipe\s+)?title\s*:\s*(.+)$/i);
    if (titleLine && !title) { title = clean(titleLine[1]); continue; }
    const meta = line.match(/^(?:[-*]\s*)?(?:\*\*)?(prep(?:aration)?(?:\s*time)?|cook(?:ing)?(?:\s*time)?|total(?:\s*time)?|serv(?:es|ings)|portions?|yield|category|type)(?:\*\*)?\s*:\s*(.+)$/i);
    if (meta && (section === 'preamble' || section === 'notes')) {
      const key = meta[1].toLowerCase(), value = clean(meta[2]);
      if (key.startsWith('prep')) prep = value;
      else if (key.startsWith('cook')) cook = value;
      else if (/serv|portion|yield/.test(key)) servings = value;
      else if (/categor|type/.test(key)) category = normalizeCategory(value);
      // Total time is not shown separately yet; original text stays in Markdown.
      continue;
    }
    const item = clean(line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '').replace(/^\[[ xX]\]\s*/, ''));
    if (!item) continue;
    if (section === 'ingredients') ingredients.push(item);
    else if (section === 'steps') steps.push(item);
    else if (section === 'notes') notes.push(item);
    else preamble.push(item);
  }
  if (!title) title = clean(preamble.shift() || '');
  if (!title) return { valid: false, error: 'Add a recipe title, such as # Lemon Cake.' };
  if (title.length > 150) return { valid: false, error: 'That title is a little long. Please shorten it.' };
  if (!ingredients.length && !steps.length) return { valid: false, error: 'Please include an ## Ingredients or ## Method section.' };
  if (preamble.length) notes.unshift(...preamble);
  if (category === 'other' && /cake|cookie|bread|biscuit|scone|brownie|muffin|pastry/i.test(title)) category = 'baking';
  return { valid: true, title, prep, cook, servings, category, ingredients, steps, notes, markdown: source };
}

export const SAMPLE_MARKDOWN = `# Lemon Drizzle Cake

Servings: 8
Prep: 20 minutes
Cook: 40 minutes
Category: Baking

## Ingredients
- 175g softened butter
- 175g caster sugar
- 3 eggs
- 175g self-raising flour
- Zest of 2 lemons
- Juice of 2 lemons
- 85g granulated sugar for the drizzle

## Method
1. Heat the oven to 180°C (160°C fan). Grease and line a loaf tin.
2. Cream the butter and caster sugar, then beat in the eggs one at a time.
3. Fold in the flour and lemon zest. Spoon into the tin.
4. Bake for about 40 minutes until a skewer comes out clean.
5. Mix the lemon juice with granulated sugar. Prick the warm cake and spoon over the drizzle.
6. Cool in the tin, then slice and enjoy.

## Notes
Try adding a little extra zest next time for a sharper lemon flavour.`;