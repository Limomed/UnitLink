const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const client = new ftp.Client();
const ftpConfig = require(path.join(__dirname, '../config/ftp-config.json'));
//const ftpConfig = require('../config/ftp-config.json');
const { getVideoFileList } = require('./sqlManager/sqlService');
const { log } = require('./logService');
const util = require('util');
const fsMkDir = util.promisify(fs.mkdir);
const fsStat = util.promisify(fs.stat);
const localVideoPath = path.join(__dirname, '../video/');

async function downloadFile(intro) {
  const playList = await getVideoFileList();
  client.ftp.verbose = true;

  try {
    await client.access(ftpConfig);

    const downloadList = await makeDownloadList(playList);
    // Set a new callback function which also resets the overall counter
    client.trackProgress(info => {
      if (downloadList.totalSize > 0)
        intro.webContents.send('setProgressValue', info.bytesOverall / downloadList.totalSize);
    });

    deleteDontPlayFile(playList);

    for (const downloadFile of downloadList.pathList) {
      await client.downloadTo(path.join(localVideoPath, downloadFile), downloadFile);
    }

    // Stop logging
    client.trackProgress();
  } catch (err) {
    console.log(err);
    log(`downloadFile error : ${err}`);
  }
  client.close();
  return playList;
}

async function ensureLocalDirectory(path) {
  try {
    await fsStat(path);
  } catch (err) {
    await fsMkDir(path, { recursive: true });
  }
}

async function makeDownloadList(playList) {
  const advSet = new Set(playList.map(m => m.AdvertiserId.toString()));
  const uniqeuAdv = [...advSet]; //중복 제거
  const downloadList = {
    pathList: [],
    totalSize: 0,
  };

  for (const adv of uniqeuAdv) {
    const localDirPath = path.join(localVideoPath, adv);
    await ensureLocalDirectory(localDirPath);

    const localFiles = fs.readdirSync(localDirPath);
    let files = await client.list(path.join(adv, '/'));
    files = files.filter(el => playList.map(m => m.Name).includes(el.name));

    files = files.filter(el => !localFiles.includes(el.name));
    downloadList.totalSize = files.reduce((sum, a) => sum + a.size, 0);
    downloadList.pathList.push(...files.map(m => path.join(adv, m.name)));
  }

  return downloadList;
}

async function deleteDontPlayFile(playList) {
  const dontPlayList = [];
  for (const file of fs.readdirSync(localVideoPath)) {
    const filePath = path.join(localVideoPath, file);
    const stat = fs.statSync(filePath);
    if (stat?.isDirectory()) {
      const localFiles = fs.readdirSync(filePath);
      const selectedPlayList = playList.filter(x => x.AdvertiserId == file).map(m => m.Name);
      const dontPlayFiles = localFiles
        .filter(fileName => !selectedPlayList.includes(fileName))
        .map(m => path.join(filePath, m));

      dontPlayList.push(...dontPlayFiles);
    }
  }
  dontPlayList.forEach(filePath => fs.unlinkSync(filePath));
}

module.exports = {
  downloadFile,
};
