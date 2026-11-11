/* English / French interface strings. Pure: no DOM. Missing French keys fall back to English, never to a blank. */
const I18n = (() => {
  'use strict';
  const EN = {
    tabActions: 'Actions', tabMath: 'Math', tabApp: 'App', done: 'Done', back: 'Back', copy: 'Copy', delete: 'Delete',
    history: 'History', export: 'Export', clearHistory: 'Clear history', historyEmpty: 'Nothing here yet.<br>Calculations are saved as you write them.',
    copyResult: 'Copy result', shareImage: 'Share image', toMemory: 'To memory', emptyMemory: 'Empty memory', clearCanvas: 'Clear canvas',
    dragHint: 'Hold a number or a result, then drag it into another expression or down to the memory bar.',
    results: 'Results', decimal: 'Decimal', fraction: 'Fraction', mixed: 'Mixed', resultsHint: 'Fraction and Mixed write exact results as fractions. Decimal always gives a number.',
    angles: 'Angles', radians: 'Radians', degrees: 'Degrees',
    calculate: 'Calculate', instant: 'Instant', onDemand: 'On demand', calculateHint: 'On demand waits for a trailing = before answering.',
    language: 'Language', theme: 'Theme', dark: 'Dark', light: 'Light',
    updates: 'Updates', auto: 'Auto', off: 'Off', checkUpdates: 'Check for updates', getUpdate: 'Get Mikajy Spark {v}',
    updateHint: ' Mikajy Spark {v}{avail}. Updates are looked up on GitHub at most once a day; nothing about you is sent.', availableSuffix: ' · version {n} is available',
    copied: 'Copied', memoryEmptied: 'Memory emptied', upToDate: 'Mikajy Spark is up to date', noResult: 'No result yet', nothingToShare: 'Nothing to share',
    savedToMemory: 'Saved to memory', tooLarge: 'Too large for memory', checking: 'Checking…', offline: 'You are offline', checkFailed: 'Could not check',
    updateAvailable: 'Mikajy Spark {v} is available',
    downloading: 'Downloading the update… {n}', verifying: 'Checking the update…', allowInstall: 'Allow Mikajy Spark to install updates, then come back',
    confirmInstall: 'Confirm the update to finish', installed: 'Updated', getInBrowser: 'Download in the browser',
    installFailed: 'Update not installed: {why}', why_offline: 'no connection', why_checksum: 'the download did not match its checksum',
    why_package: 'it is not a newer Mikajy Spark', why_permission: 'installing updates was not allowed', why_aborted: 'cancelled',
    why_install: 'Android refused it', why_error: 'something went wrong', writeHint: 'write a sum', canvasAria: 'Handwriting canvas: write a calculation with your finger', menuAria: 'Menu',
    unsupported: 'unsupported', undefined: 'undefined'
  };
  const FR = {
    tabActions: 'Actions', tabMath: 'Maths', tabApp: 'Appli', done: 'Terminé', back: 'Retour', copy: 'Copier', delete: 'Supprimer',
    history: 'Historique', export: 'Exporter', clearHistory: "Effacer l'historique", historyEmpty: "Rien pour l'instant.<br>Les calculs sont enregistrés pendant que vous écrivez.",
    copyResult: 'Copier le résultat', shareImage: "Partager l'image", toMemory: 'En mémoire', emptyMemory: 'Vider la mémoire', clearCanvas: "Effacer l'écran",
    dragHint: 'Maintenez un nombre ou un résultat, puis glissez-le dans une autre expression ou vers la barre mémoire.',
    results: 'Résultats', decimal: 'Décimal', fraction: 'Fraction', mixed: 'Mixte', resultsHint: 'Fraction et Mixte écrivent les résultats exacts en fractions. Décimal donne toujours un nombre.',
    angles: 'Angles', radians: 'Radians', degrees: 'Degrés',
    calculate: 'Calcul', instant: 'Instantané', onDemand: 'À la demande', calculateHint: "À la demande attend un = final avant de répondre.",
    language: 'Langue', theme: 'Thème', dark: 'Sombre', light: 'Clair',
    updates: 'Mises à jour', auto: 'Auto', off: 'Non', checkUpdates: 'Vérifier les mises à jour', getUpdate: 'Obtenir Mikajy Spark {v}',
    updateHint: " Mikajy Spark {v}{avail}. Les mises à jour sont cherchées sur GitHub au plus une fois par jour ; rien sur vous n'est envoyé.", availableSuffix: ' · la version {n} est disponible',
    copied: 'Copié', memoryEmptied: 'Mémoire vidée', upToDate: 'Mikajy Spark est à jour', noResult: 'Pas encore de résultat', nothingToShare: 'Rien à partager',
    savedToMemory: 'Enregistré en mémoire', tooLarge: 'Trop grand pour la mémoire', checking: 'Vérification…', offline: 'Vous êtes hors ligne', checkFailed: 'Vérification impossible',
    updateAvailable: 'Mikajy Spark {v} est disponible',
    downloading: 'Téléchargement de la mise à jour… {n}', verifying: 'Vérification de la mise à jour…', allowInstall: "Autorisez Mikajy Spark à installer les mises à jour, puis revenez",
    confirmInstall: 'Confirmez la mise à jour pour terminer', installed: 'Mis à jour', getInBrowser: 'Télécharger dans le navigateur',
    installFailed: 'Mise à jour non installée : {why}', why_offline: 'pas de connexion', why_checksum: 'le téléchargement ne correspond pas à sa somme de contrôle',
    why_package: "ce n'est pas une version plus récente de Mikajy Spark", why_permission: "l'installation des mises à jour n'a pas été autorisée", why_aborted: 'annulée',
    why_install: "Android l'a refusée", why_error: 'une erreur est survenue', writeHint: 'écrivez un calcul', canvasAria: "Zone d'écriture : écrivez un calcul avec le doigt", menuAria: 'Menu',
    unsupported: 'non géré', undefined: 'indéfini'
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
