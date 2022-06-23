const electronLog = require('electron-log');
const path = require('path');

function logInit() {
  electronLog.transports.file.level = 'info';
  electronLog.transports.file.resolvePath = () => path.join(__dirname, '../../info.log');
}

function log(message) {
  electronLog.info(message);
}

module.exports = {
  logInit,
  log,
};
