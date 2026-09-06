const db = require('better-sqlite3')('/root/.toolnetapi/db/data.sqlite');
const row = db.prepare("SELECT id, key, flags FROM ApiKey WHERE key='sk-5cd22cc5d79fac05-5pm45y-29827861'").get();
console.log(row);
