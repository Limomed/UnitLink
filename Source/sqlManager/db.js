const sql = require('mssql');
const dbConfig = require('../../config/db-config.json');
const { log } = require('../logService');
//let pool;

const sqlConfig = {
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  server: dbConfig.server,
  pool: {
    max: 100,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  // stream: true,
  options: {
    encrypt: true, // for azure
    trustServerCertificate: false, // change to true for local dev / self-signed certs
  },
};

const poolPromise = new sql.ConnectionPool(sqlConfig)
  .connect()
  .then(pool => {
    console.log('Connected to MSSQL');
    return pool;
  })
  .catch(err => {
    console.log('Connection Failed : ', err);
    log(`Connection Failed : ${err}`);
    throw err;
  });

const ConnectionPool = async () => {
  //pool = await poolPromise;
};

module.exports = {
  ConnectionPool,
  poolPromise,
};
