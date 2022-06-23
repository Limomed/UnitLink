const { log } = require('../logService');
const { localStore } = require('../envConfig');
const { poolPromise } = require('./db');
const moment = require('moment');
let playList = {};

const checkLogin = async account => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(
        `SELECT Top 1 Id FROM UL_ACCOUNT WHERE LoginId = '${account.id}' AND Password = '${account.password}'`,
      );
    return result?.recordset.length > 0 ? result.recordset[0].Id : 0;
  } catch (error) {
    console.log(error);
    log(`checkLogin : ${error}`);
    return { error };
  }
};

const getVideoFileList = async () => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT PL.*, FI.ContractId, FI.Name, FI.Volume, FI.FileType, FI.PlayTime, FI.CreateAt, FI.AdvertiserId
        FROM UL_PlayList PL
        INNER JOIN  UL_FileInfo FI ON PL.FileId = FI.Id
        WHERE FileType = 0 AND IsON = 1 AND AccountId = ${localStore.get('loginId')} 
        `);
    playList = result.recordset;
    return result.recordset;
  } catch (error) {
    log(`getVideoFileList Failed : ${err}`);
    return { error };
  }
};

const updateCompletePlayInfo = async playInfoId => {
  try {
    const query = `UPDATE UL_PlayList 
    SET CompletePlayCount = CompletePlayCount + 1, TotalPlayCount = TotalPlayCount + 1
    WHERE Id = ${playInfoId}`;

    const pool = await poolPromise;
    await pool.request().query(query);

    return true;
  } catch (error) {
    console.log(error);
    log(`updatePlaySummary : ${error}`);
  }
};

const accumulatePlayInfo = async (playInfo, idleTime) => {
  try {
    const playTime = moment.duration(playInfo.PlayTime).asSeconds();
    if (idleTime > playTime) idleTime = playTime;

    const query = `UPDATE UL_PlayList 
    SET TotalPlayCount = TotalPlayCount + 1, TotalPlayTime = DATEADD(second, ${idleTime}, TotalPlayTime)
    WHERE Id = ${playInfo.Id}`;

    const pool = await poolPromise;
    await pool.request().query(query);

    return true;
  } catch (error) {
    console.log(error);
    log(`accumulatePlayInfo : ${error}`);
  }
};

// const queryDatabase = async () => {
//   // return await pool
//   //   .request()
//   //   .query('SELECT * FROM ACCOUNT ', (err, profileset) => {
//   //     if (err) {
//   //       console.log(`fail : ${err}`);
//   //     } else {
//   //       const sendData = profileset.recordset;
//   //       console.log('success');
//   //       console.log(sendData);

//   //       return sendData;
//   //     }
//   //   });

//   try {
//     const result = await pool.request().query('SELECT * FROM ACCOUNT ');
//     return result.recordset;
//   } catch (error) {
//     console.log(error);
//     return null;
//   }
// };

module.exports = {
  checkLogin,
  getVideoFileList,
  accumulatePlayInfo,
  updateCompletePlayInfo,
};
