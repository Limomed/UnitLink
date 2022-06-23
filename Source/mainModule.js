const {
  BrowserWindow,
  powerMonitor,
  powerSaveBlocker,
  Menu,
  app,
  screen,
  Tray,
} = require('electron');

const {
  checkLogin,
  getVideoFileList,
  accumulatePlayInfo,
  updateCompletePlayInfo,
} = require('./sqlManager/sqlService');
const AutoLaunch = require('auto-launch');
const { localStore } = require('./envConfig');
const { downloadFile } = require('./ftpService');
const path = require('path');
const screenSaver = 'screenSaver';
const optionWindowTitle = 'UnitLink Option Form';

const { log } = require('./logService');

let powerSaveBlockId = 0;
let timerStartFlag = false;
let timer;
let playList;
let playTime = 0;
let currentPlayIndex = 0;
let optionWindow;
let loginWindow;
let tray;
let mainProcessId;

function createOptionWindow() {
  // Create the browser window.
  if (BrowserWindow.getAllWindows().filter(win => win.title == optionWindowTitle).length === 0) {
    optionWindow = new BrowserWindow({
      title: optionWindowTitle,
      width: 800,
      height: 600,
      icon: path.join(__dirname, '../unitlink.ico'),
      webPreferences: {
        // preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: true,
        contextIsolation: false,
      },
    });
    optionWindow.once('ready-to-show', () => {
      // queryDatabase().then(data => {
      //   optionWindow.webContents.send('DataSend', [data, process.env.settingTime ?? 30]);
      // });
      optionWindow.webContents.send('DataSend', localStore.get('settingTime') ?? 30);
    });

    optionWindow.setMenu(null);
    optionWindow.loadFile(path.join(__dirname, './view/optionForm.html'));
    // Open the DevTools.
    optionWindow.webContents.openDevTools();
  } else {
    optionWindow.show();
    optionWindow.webContents.openDevTools();
  }
}

function createIntroWindow() {
  // Create the browser window.
  //if (BrowserWindow.getAllWindows().length === 0) {
  const introWindow = new BrowserWindow({
    width: 600,
    height: 300,
    show: false,
    //fullscreen: true,
    resizable: false,
    transparent: true,
    titleBarStyle: 'hidden',
    hasShadow: true,
    icon: path.join(__dirname, '../unitlink.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  introWindow.webContents.on('did-finish-load', async () => {
    introWindow.show();
    await runUnitLink(introWindow);
    fadeWindowOut(introWindow, 0.02, 10, 3);
  });
  //optionWindow.setMenu(null);
  introWindow.loadFile(path.join(__dirname, './view/intro.html'));
  // Open the DevTools.
  introWindow.webContents.openDevTools();
  //}

  return introWindow;
}

function createLoginWindow() {
  // Create the browser window.
  loginWindow = new BrowserWindow({
    width: 360,
    height: 480,
    frame: false,
    resizable: false,
    hasShadow: true,
    icon: path.join(__dirname, '../unitlink.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  loginWindow.on('closed', () => {
    if (!localStore.get('loginId') > 0) app.quit();
    loginWindow = null;
  });
  loginWindow.setMenu(null);
  loginWindow.loadFile(path.join(__dirname, './view/login.html'));

  loginWindow.once('ready-to-show', () => {
    loginWindow.show();
  });

  loginWindow.webContents.on('did-finish-load', () => {
    //loginWindow.webContents.send('setLog', path.join(__dirname, '../../log.log'));
  });

  // Open the DevTools.
  loginWindow.webContents.openDevTools();
}

async function test() {
  //ConnectionPool();
  //const bb = await queryDatabase();
  //optionWindow.webContents.send('DataSend', bb);
}
function createVideoWindow(bounds, isMain = true) {
  const videoWindow = new BrowserWindow({
    title: screenSaver,
    width: 1000,
    height: 600,
    fullscreen: true,
    show: false,
    icon: path.join(__dirname, '../unitlink.ico'),
    x: bounds?.x ?? 0 + 50,
    y: bounds?.y ?? 0 + 50,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (isMain) {
    mainProcessId = videoWindow.id;
    videoWindow.on('close', () => {
      recordPlayInfo(mainProcessId, currentPlayIndex, false);
    });
  }

  videoWindow.webContents.openDevTools();
  videoWindow.setMenu(null);
  videoWindow.loadFile(path.join(__dirname, './view/video.html'));
  videoWindow.setAlwaysOnTop(true, 'screen-saver');
  videoWindow.setVisibleOnAllWorkspaces(true);

  videoWindow.once('ready-to-show', () => {
    videoWindow.show();
    videoWindow.webContents.send('setFileList', playList);
  });
}

async function setScreenSaver() {
  const idleTime = powerMonitor.getSystemIdleTime();
  const settingTime = localStore.get('settingTime') ?? 30;
  const allDisplays = screen.getAllDisplays();
  const screenSaverWins = BrowserWindow.getAllWindows().filter(win => win.title == screenSaver);

  screenSaverWins.length > 0 && playTime++;

  console.log('playTime :' + playTime);
  console.log('idleTime :' + idleTime);

  if (idleTime >= settingTime && screenSaverWins.length === 0) {
    powerSaveBlockId = powerSaveBlocker.start('prevent-display-sleep'); // 절전모드 차단
    // 새로 화면보호기 동작할때마다 순서 섞기
    shuffle(playList);

    // 듀얼이상 모니터 사용을 위함  //첫번째는 메인모니터
    for (const display of allDisplays) {
      if (display === allDisplays[0]) createVideoWindow(display.bounds);
      else createVideoWindow(display.bounds, false);
    }
  } else if (idleTime === 0 && screenSaverWins.length > 0) {
    powerSaveBlocker.isStarted(powerSaveBlockId) && powerSaveBlocker.stop(powerSaveBlockId); // 절전모드 차단 해제
    for (const win of screenSaverWins) {
      win.title === screenSaver && win.close();
    }
  }
}

function recordPlayInfo(frameId, receivedIndex, isComplete = true) {
  if (mainProcessId === frameId) {
    currentPlayIndex = receivedIndex;
    if (isComplete) updateCompletePlayInfo(playList[currentPlayIndex].Id);
    else accumulatePlayInfo(playList[currentPlayIndex], playTime);

    playTime = 0;
  }
}

function shuffle(array) {
  let tmp,
    current,
    top = array.length;
  if (top)
    while (--top) {
      current = Math.floor(Math.random() * (top + 1));
      tmp = array[current];
      array[current] = array[top];
      array[top] = tmp;
    }
  return array;
}

function flagOnOff(action) {
  if (timerStartFlag !== action) {
    timerStartFlag = action;
    contextMenu.items[2].checked = timerStartFlag;
    contextMenu.items[3].checked = !timerStartFlag;
    return true;
  }
  return false;
}

function timerStart() {
  if (flagOnOff(true)) {
    clearInterval(timer);
    timer = setInterval(() => {
      setScreenSaver();
    }, 1000);
  }
}
function timerStop() {
  if (flagOnOff(false)) {
    clearInterval(timer);
  }
}

const contextMenu = Menu.buildFromTemplate([
  { label: '환경설정', type: 'normal', click: () => createOptionWindow() },
  { type: 'separator' },
  {
    label: '시작',
    type: 'checkbox',
    checked: true,
    click: () => timerStart(), // 추후 변수로 변경
  },
  {
    label: '정지',
    type: 'checkbox',
    checked: false,
    click: () => timerStop(),
  },
  { type: 'separator' },
  { label: '닫기', type: 'normal', click: () => app.quit() },
]);

const fadeWindowOut = (browserWindow, step = 0.1, fadeEveryXSeconds = 2, initKeep = 1) => {
  let opacity = browserWindow.getOpacity();
  let keep = initKeep;
  // fadeEveryXSeconds 를 주기로 step에 맞게 단계를 나눠 fade 시킨다.
  const interval = setInterval(() => {
    if (browserWindow.isDestroyed()) return;
    // 투명도가 0이 되면 종료
    if (opacity <= 0) {
      clearInterval(interval);
      browserWindow.close();
      return interval;
    }
    browserWindow.setOpacity(opacity);
    // keep 만큼 시간이 지난 후 Fade를 진행한다.
    if (keep <= 0) opacity -= step;
    else keep -= step;
  }, fadeEveryXSeconds);

  return interval;
};

function saveOption(arg) {
  localStore.set('settingTime', arg.settingTime);
  if (timerStartFlag) {
    timerStop();
    timerStart();
  }
}

async function runUnitLink(introWindow) {
  playList = await downloadFile(introWindow);
  tray = new Tray(path.join(__dirname, '../unitlink.ico'));
  tray.setToolTip('Unit Link');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => createOptionWindow());
  timerStart();
}

async function login(account) {
  const result = await checkLogin(account);

  if (result > 0) {
    localStore.set('loginId', result); // 로그인은 최초 한번만 수행
    loginWindow.close();
    createIntroWindow();
  } else loginWindow.webContents.send('loginResult', result);
}

function autoLaunch() {
  let autoLaunch = new AutoLaunch({
    name: 'Unit Link',
    path: app.getPath('exe'),
  });

  autoLaunch.isEnabled().then(isEnabled => {
    if (!isEnabled) autoLaunch.enable();
  });
}

module.exports = {
  timerStart,
  timerStop,
  contextMenu,
  optionWindow,
  createOptionWindow,
  createIntroWindow,
  createLoginWindow,
  test,
  saveOption,
  login,
  recordPlayInfo,
  autoLaunch,
};
