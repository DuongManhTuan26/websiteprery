const fs = require('fs');
const config = require('./config');

async function saveStorage(page) {
  const localStorageData = await page.evaluate(() => {
    return Object.fromEntries(
      Object.keys(localStorage).map(key => [
        key,
        localStorage.getItem(key)
      ])
    );
  });

  fs.writeFileSync(
    config.output.localStorage,
    JSON.stringify(localStorageData, null, 2)
  );

  const sessionStorageData = await page.evaluate(() => {
    return Object.fromEntries(
      Object.keys(sessionStorage).map(key => [
        key,
        sessionStorage.getItem(key)
      ])
    );
  });

  fs.writeFileSync(
    config.output.sessionStorage,
    JSON.stringify(sessionStorageData, null, 2)
  );

  const indexedDBData = await page.evaluate(async () => {
    if (!indexedDB.databases) {
      return [];
    }

    const databases = await indexedDB.databases();

    return databases.map(db => ({
      name: db.name,
      version: db.version
    }));
  });

  fs.writeFileSync(
    config.output.indexedDB,
    JSON.stringify(indexedDBData, null, 2)
  );
}

module.exports = {
  saveStorage
};