/*
 * Platform configuration.
 * This file holds settings only — no member records, credentials or secrets.
 * Anything placed here is visible to every visitor of the site.
 */
window.AIClub = window.AIClub || {};

window.AIClub.config = {
  appName: 'منصة النادي الموحدة',
  clubName: 'نادي الذكاء الاصطناعي',

  /*
   * Where content comes from:
   *   'local'        → window.AIClub.sampleData (only for testing without the Sheet)
   *   'apps-script'  → a Google Apps Script web app that reads a Google Sheet
   *                    (only approved resources are returned)
   */
  dataSource: 'apps-script',

  // Deployed Apps Script web-app URL, e.g. https://script.google.com/macros/s/XXXX/exec
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbyX20rhWLjwnsmi9T0SqwuBAJyuykkDHavTlkqtabyKaYn8pSUWBlMdTKfTNux6FszM/exec',

  // Network timeout for remote content (ms)
  requestTimeoutMs: 12000,

  auth: {
    // University ID length, checked before the ID is verified against the member list
    studentIdLength: 7
  }
};
