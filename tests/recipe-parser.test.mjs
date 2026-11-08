import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecipe, SAMPLE_MARKDOWN } from '../recipe-parser.js';

test('parses sample recipe with all sections', () => {
 const p = parseRecipe(SAMPLE_MARKDOWN);
 assert.equal(p.valid, true);
 assert.equal(p.title, 'Lemon Drizzle Cake');
 assert.equal(p.servings, '8');
 assert.equal(p.category, 'baking');
 assert.equal(p.ingredients.length, 7);
 assert.equal(p.steps.length, 6);
 assert.equal(p.notes.length, 1);
});
test('handles windows newlines and title fallback', () => {
 const p = parseRecipe('Tomato Soup\r\n\r\n## Ingredients\r\n- Tomatoes\r\n## Instructions\r\n1. Simmer.');
 assert.equal(p.title, 'Tomato Soup');
 assert.deepEqual(p.steps, ['Simmer.']);
});
test('rejects empty and nonrecipe text', () => {
 assert.equal(parseRecipe(' ').valid, false);
 assert.equal(parseRecipe('# Hello there').valid, false);
});
test('does not output HTML', () => {
 const p = parseRecipe('# <script>alert(1)</script>\n## Ingredients\n- Lemon\n## Method\n1. Mix.');
 assert.equal(p.valid, true);
 assert.equal(p.title, '<script>alert(1)</script>');
});
test('recognises Markdown bold metadata', () => {
 const p = parseRecipe('# Toast\n**Prep:** 5 min\n**Category:** Dinner\n## Ingredients\n- Bread\n## Method\n1. Toast bread');
 assert.equal(p.prep, '5 min');
 assert.equal(p.category, 'dinner');
});
test('recognises descriptive ingredient and method headings', () => {
 const p = parseRecipe('# Granola\n## Ingredients (makes one jar)\n- Oats\n## Method and variations\n1. Mix.');
 assert.equal(p.valid, true);
 assert.deepEqual(p.ingredients, ['Oats']);
 assert.deepEqual(p.steps, ['Mix.']);
});