// Modules to control application life and create native browser window
//require('dotenv').config();
//console.log(process.env.NODE_ENV);

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
// 기존에 작성된 require() 구문 생략...
const { autoUpdater } = require('electron-updater');
const ProgressBar = require('electron-progressbar');

const { log, logInit } = require('./logService');
const path = require('path');
const mainModule = require('./mainModule');
const { updatePlaySummary } = require('./sqlManager/sqlService');
const { localStore } = require('./envConfig');
let progressBar;

if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(path.join(__dirname, '../'), {
    electron: path.join(__dirname, '../node_modules', '.bin', 'electron'),
    hardResetMethod: 'exit',
  });
}

/* Updater ======================================================*/
autoUpdater.on('checking-for-update', () => {
  log('Checking for update...');
});
autoUpdater.on('update-available', info => {
  log('Update available.');
});
autoUpdater.on('update-not-available', info => {
  log('latest version. : ' + info.version);
  log('app version. : ' + app.getVersion());
});
autoUpdater.on('error', err => {
  log('error in auto-updater. error : ' + err);
});
autoUpdater.on('download-progress', progressObj => {
  let log_message = 'Download speed: ' + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')';
  log(log_message);

  progressBar = new ProgressBar({
    text: 'Downloading...',
    detail: 'Downloading...',
  });

  progressBar
    .on('completed', function () {
      console.info(`completed...`);
      log('client update complte');
      progressBar.detail = 'Task completed. Exiting...';
    })
    .on('aborted', function () {
      console.info(`aborted...`);
    });
});

autoUpdater.on('update-downloaded', info => {
  log('Update downloaded.');
  progressBar.setCompleted();
  dialog
    .showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: 'Install & restart now?',
      buttons: ['Restart', 'Later'],
    })
    .then(result => {
      const buttonIndex = result.response;

      if (buttonIndex === 0) autoUpdater.quitAndInstall(false, true);
    });
});

/* Updater ======================================================*/

ipcMain.on('exit-app', (event, arg) => {
  app.quit();
});

ipcMain.on('test-app', (event, arg) => {
  mainModule.test();
});

ipcMain.on('timerStart', (event, arg) => {
  mainModule.timerStart();
});

ipcMain.on('timerStop', (event, arg) => {
  mainModule.timerStop();
});

ipcMain.on('save', (event, arg) => {
  mainModule.saveOption(arg);
});

ipcMain.on('checkLogin', async (event, arg) => {
  mainModule.login(arg);
});
ipcMain.on('closeApp', (evt, arg) => {
  app.quit();
});

ipcMain.on('playRecord', (evt, arg) => {
  mainModule.recordPlayInfo(evt.senderFrame.frameTreeNodeId, arg);
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

app.whenReady().then(async () => {
  logInit();
  //await ConnectionPool();
  // 자동 업데이트 등록
  autoUpdater.checkForUpdates();

  process.env.NODE_ENV !== 'development' && mainModule.autoLaunch();

  if (localStore.get('loginId') > 0) mainModule.createIntroWindow();
  else mainModule.createLoginWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) mainModule.createOptionWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  //if (process.platform !== 'darwin') app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
