const {
  createReadStream,
  createWriteStream,
  mkdir,
  readdir,
  stat,
  open,
  close,
  unlink,
} = require('fs');
const { join, extname } = require('path');
const { promisify } = require('util');

const fsReadDir = promisify(readdir);
const fsMkDir = promisify(mkdir);
const fsStat = promisify(stat);
const fsOpen = promisify(open);
const fsClose = promisify(close);
const fsUnlink = promisify(unlink);

async function getFilePathList(dirPath) {
  const videoExtName = ['.mp4', '.ogg'];
  const files = await fsReadDir(dirPath);
  let filePathList = [];

  for (const file of files) {
    const fullPath = join(dirPath, file);
    const stats = await fsStat(fullPath);
    if (stats.isFile()) {
      videoExtName.includes(extname(fullPath)) && filePathList.push(fullPath);
    } else if (stats.isDirectory()) {
      const list = await getFilePathList(fullPath);
      filePathList.push(...list);
    }
  }
  return filePathList;
}

module.exports = { getFilePathList };
