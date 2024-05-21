import { Mwn } from 'mwn';
import fs from 'fs';

/**
 * @typedef {import('mwn').Template} Template
 */

// Create an mwn bot instance
const bot = new Mwn({
  apiUrl: 'https://runescape.wiki/api.php',
});
const params = [
  'class',
  'slot',
  'tier',
  'damageTier',
  'accuracyTier',
  'armourTier',
  'invtier',
  'type',
  'damage',
  'accuracy',
  'style',
  'armour',
  'life',
  'prayer',
  'strength',
  'ranged',
  'magic',
  'necromancy',
  'pvmReduction',
  'pvpReduction',
  'attack_range',
  'speed',
];
const disallowedCategories = [
  'Category:Augmented items',
  'Category:Dyed equipment',
];

/**
 * @param {Record<string, string>} data 
 * @returns {boolean}
 */
function isWeaponOrArmour(data) {
  const stats = [
    'armour',
    'strength',
    'attack',
    'damage',
    'accuracy',
    'ranged',
    'magic',
    'necromancy',
    'prayer',
    'life',
  ];
  
  for (const stat of stats) {
    const value = parseFloat(data[stat]);
    if (value > 0) return true;
  }

  return false;
}

/**
 * 
 * @param {Record<string, string | number>} data 
 * @param {string} field 
 * @param {[string[], string][]} translations 
 */
function normalizeField(data, field, translations = []) {
  if (data[field] === undefined) return;
  
  let value = data[field].toLowerCase();
  for (const translation of translations) {
    const befores = translation[0];
    const after = translation[1];

    if (befores.includes(value)) {
      value = after;
      break;
    }
  }

  data[field] = value;
}

/**
 * @param {Template} tmpl 
 * @param {string} key 
 * @param {number} version 
 */
function maybeGetVersion(tmpl, key, version) {
  const k = `${key}${version}`;
  let value = tmpl.getValue(k);

  return value !== null ? value : tmpl.getValue(key);
}

function parseFloatIf(key, data) {
  try {
    if (isNaN(data[key])) return;
  } catch (e) {
    console.error(key)
    throw e;
  }

  data[key] = parseFloat(data[key]);
}

// Function to extract template data from wikitext
/**
 * 
 * @param {string} wt 
 * @param {string} title
 * @param {any[]} templateName 
 * @returns 
 */
function extractTemplateData(wt, title, data) {
  const wikitext = new bot.Wikitext(wt);
  wikitext.parseLinks();
  const templates = wikitext.parseTemplates();
  if (!templates?.length) return;

  const files = new Map();
  for (const file of wikitext.files) {
    files.set(file.wikitext, file);
  }

  /** @type {Template} */
  let itemInfobox;
  /** @type {Template} */
  let bonusesInfobox;

  for (const template of templates) {
    if (template.name === 'Infobox Item') {
      itemInfobox = template;
    } else if (template.name === 'Infobox Bonuses') {
      bonusesInfobox = template;
    }

    if (itemInfobox && bonusesInfobox) {
      break;
    }
  }

  // Page must have item infobox and bonuses infobox
  if (!itemInfobox || !bonusesInfobox) {
    return;
  }

  let version = 1;
  do {
    const localName = maybeGetVersion(itemInfobox, 'name', version) || title;
    const stats = {};

    for (const param of params) {
      const value = maybeGetVersion(bonusesInfobox, param, version);
      if (value !== null && value !== '') {
        stats[param] = value;
      }
    }

    normalizeField(stats, 'type', [
      [['power armour'], 'power'],
      [['repriser', 'rebounder'], 'defender'],
    ]);
    normalizeField(stats, 'style', [
      [['stabbing'], 'stab'],
      [['crushing'], 'crush'],
      [['slashing'], 'slash'],
      [['bolts'], 'bolt'],
      [['arrows'], 'arrow'],
    ]);
    normalizeField(stats, 'class', [
      [['all', 'none'], 'hybrid']
    ]);
    normalizeField(stats, 'slot', [
      [['offhand', 'off-hand weapon'], 'off-hand'],
      [['mainhand', 'weapon', 'main hand'], 'main-hand'],
      [['back'], 'cape'],
      [['torso'], 'body'],
    ]);
    normalizeField(stats, 'tier', [
      [['no', 'none'], '0'],
    ]);

    if (!isWeaponOrArmour(stats)) return;

    parseFloatIf('accuracy', stats);
    parseFloatIf('attack_range', stats);
    parseFloatIf('speed', stats);
    parseFloatIf('damage', stats);
    parseFloatIf('armour', stats);
    parseFloatIf('strength', stats);
    parseFloatIf('ranged', stats);
    parseFloatIf('magic', stats);
    parseFloatIf('armourTier', stats);
    parseFloatIf('pvmReduction', stats);
    parseFloatIf('damageTier', stats);
    parseFloatIf('accuracyTier', stats);
    parseFloatIf('necromancy', stats);
    parseFloatIf('life', stats);
    parseFloatIf('prayer', stats);
    parseFloatIf('tier', stats);

    const imageText = maybeGetVersion(itemInfobox, 'image', version);
    let image;
    if (files.has(imageText)) {
      const t = files.get(imageText);
      image = `https://runescape.wiki/images/${t.target.title}`;
    }

    data.push({
      itemName: localName,
      id: parseInt(maybeGetVersion(itemInfobox, 'id', version)),
      image,
      stats,
    });
  } while (bonusesInfobox.getParam(`version${++version}`));
}

(async function () {
  await bot.getSiteInfo();

  const allTemplateData = [];
  let count = 0;

  for await (const results of bot.continuedQueryGen({
    format: 'json',
    list: 'search',
    action: 'query',
    formatversion: 2,
    srsearch: 'insource:/\\{\\{*Infobox Bonuses*/',
    srlimit: 500,
    srprop: '',
    srsort: 'relevance',
  })) {
    const ids = results.query.search.map(p => p.pageid);
    const pagesContent = await bot.read(ids, {
      prop: 'categories|revisions',
      clcategories: disallowedCategories.join('|'),
      cllimit: 500,
    });

    // Step 2: Get the content of each page
    for (const pageContent of pagesContent) {
      count++;

      // Skipping over equipment that is dyed or augmented 
      if (pageContent.categories?.length) {
        continue;
      }

      extractTemplateData(pageContent.revisions[0].content, pageContent.title, allTemplateData);
    }

    console.log(`Finished ${count}/${results.query.searchinfo.totalhits}`);
  }

  fs.writeFileSync('equipment_data.json', JSON.stringify(allTemplateData, null, 2));
})();
