/* English / French interface strings. Pure: no DOM. Missing French keys fall back to English, never to a blank. */
const I18n = (() => {
  'use strict';
  const EN = {
    tabActions: 'Actions', tabMath: 'Math', tabApp: 'App', done: 'Done', back: 'Back', copy: 'Copy', delete: 'Delete',
    history: 'History', export: 'Export', clearHistory: 'Clear history', historyEmpty: 'Nothing here yet.<br>Calculations are saved as you write them.',
    copyResult: 'Copy result', shareImage: 'Share image', toMemory: 'To memory', emptyMemory: 'Empty memory', clearCanvas: 'Clear canvas',
    dragHint: 'Hold a number or a result, then drag it into another expression or down to the memory bar.',
    results: 'Results', exact: 'Exact', decimal: 'Decimal', mixed: 'Mixed', resultsHint: 'Exact keeps fractions, √ and π. Decimal gives numbers.',
    angles: 'Angles', radians: 'Radians', degrees: 'Degrees', numbers: 'Numbers', real: 'ℝ real', complex: 'ℂ complex',
    calculate: 'Calculate', instant: 'Instant', onDemand: 'On demand', calculateHint: 'On demand waits for a trailing = before answering.',
    language: 'Language', theme: 'Theme', dark: 'Dark', light: 'Light', recogniser: 'Recogniser', sequence: 'Sequence', classic: 'Classic',
    updates: 'Updates', auto: 'Auto', off: 'Off', checkUpdates: 'Check for updates', getUpdate: 'Get Mikajy {v}',
    updateHint: ' Mikajy {v}{avail}. Updates are looked up on GitHub at most once a day; nothing about you is sent.', availableSuffix: ' · version {n} is available',
    copied: 'Copied', memoryEmptied: 'Memory emptied', upToDate: 'Mikajy is up to date', noResult: 'No result yet', nothingToShare: 'Nothing to share',
    savedToMemory: 'Saved to memory', tooLarge: 'Too large for memory', checking: 'Checking…', offline: 'You are offline', checkFailed: 'Could not check',
    updateAvailable: 'Mikajy {v} is available', writeHint: 'write a sum', canvasAria: 'Handwriting canvas: write a calculation with your finger', menuAria: 'Menu', resetView: 'Reset view',
    unsupported: 'unsupported', undefined: 'undefined', true: 'True', false: 'False'
  };
  const FR = {
    tabActions: 'Actions', tabMath: 'Maths', tabApp: 'Appli', done: 'Terminé', back: 'Retour', copy: 'Copier', delete: 'Supprimer',
    history: 'Historique', export: 'Exporter', clearHistory: "Effacer l'historique", historyEmpty: "Rien pour l'instant.<br>Les calculs sont enregistrés pendant que vous écrivez.",
    copyResult: 'Copier le résultat', shareImage: "Partager l'image", toMemory: 'En mémoire', emptyMemory: 'Vider la mémoire', clearCanvas: "Effacer l'écran",
    dragHint: 'Maintenez un nombre ou un résultat, puis glissez-le dans une autre expression ou vers la barre mémoire.',
    results: 'Résultats', exact: 'Exact', decimal: 'Décimal', mixed: 'Mixte', resultsHint: 'Exact garde les fractions, √ et π. Décimal donne des nombres.',
    angles: 'Angles', radians: 'Radians', degrees: 'Degrés', numbers: 'Nombres', real: 'ℝ réels', complex: 'ℂ complexes',
    calculate: 'Calcul', instant: 'Instantané', onDemand: 'À la demande', calculateHint: "À la demande attend un = final avant de répondre.",
    language: 'Langue', theme: 'Thème', dark: 'Sombre', light: 'Clair', recogniser: 'Reconnaissance', sequence: 'Séquence', classic: 'Classique',
    updates: 'Mises à jour', auto: 'Auto', off: 'Non', checkUpdates: 'Vérifier les mises à jour', getUpdate: 'Obtenir Mikajy {v}',
    updateHint: " Mikajy {v}{avail}. Les mises à jour sont cherchées sur GitHub au plus une fois par jour ; rien sur vous n'est envoyé.", availableSuffix: ' · la version {n} est disponible',
    copied: 'Copié', memoryEmptied: 'Mémoire vidée', upToDate: 'Mikajy est à jour', noResult: 'Pas encore de résultat', nothingToShare: 'Rien à partager',
    savedToMemory: 'Enregistré en mémoire', tooLarge: 'Trop grand pour la mémoire', checking: 'Vérification…', offline: 'Vous êtes hors ligne', checkFailed: 'Vérification impossible',
    updateAvailable: 'Mikajy {v} est disponible', writeHint: 'écrivez un calcul', canvasAria: "Zone d'écriture : écrivez un calcul avec le doigt", menuAria: 'Menu', resetView: 'Réinitialiser la vue',
    unsupported: 'non géré', undefined: 'indéfini', true: 'Vrai', false: 'Faux'
  };
  const TABLES = Object.freeze({en: EN, fr: FR});
  const LANGS = Object.freeze(['en', 'fr']);
  /** 'auto' (or anything unknown) follows the device language, English unless it starts with "fr". */
  function resolve(setting, deviceLanguage) {
    if (LANGS.includes(setting)) return setting;
    return /^fr\b/i.test(String(deviceLanguage || '')) ? 'fr' : 'en';
  }
  function t(lang, key, params) {
    const table = TABLES[lang] || EN;
    let s = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : (Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : key);
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
    return s;
  }
  return Object.freeze({t, resolve, LANGS, EN, FR});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = I18n;
