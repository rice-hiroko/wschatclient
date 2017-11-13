'use strict';

const wschat = require('wschatapi');
const chalk = require('chalk');
const blessed = require('blessed');
const notifier = require('node-notifier');
const config = require('./config');
const Timer = require('./lib/timer');

const chat = new wschat('wss://sinair.ru/ws/chat');

chat.open();

const errorcode = wschat.ErrorCode;
const messagestyle = wschat.MessageStyle;
const userstatus = wschat.UserStatus;

let settings = {
  login: config.Authorization.Login,
  password: config.Authorization.Password,
  apikey: config.Authorization.APIKey,
  popupnotifier: config.Settings.PopupNotifier,
  soundnotifier: config.Settings.SoundNotifier
};

let isOpened = false;
let isAuthorized = false;
let isFocused = false;
let isHooked = false;
let room = null;
let rooms = {};
let lastPMFrom = 0;
let myMessages = [];
let selectedMessage = myMessages.length;
let pattern;
let patternMatches = [];
let selectedMatch = 0;

let timerTyping = new Timer(() => {
  setTyping(false)
});

const white = chalk.white;
const gray = chalk.hex('#808080').bold;
const gold = chalk.hex('#FFD700').bold;
const skyblue = chalk.hex('#87CEEB').bold;
const red = chalk.hex('#FF6666').bold;

const screen = blessed.screen({
  smartCSR: true,
  sendFocus: true
});

const window = blessed.box({
  width: '100%',
  height: '100%'
});

screen.title = 'wschatclient';

process.on('SIGWINCH', () => {
  screen.emit('resize')
});

/**
 * Определение простых областей
 */
  const roomsBox = blessed.box({
    parent: window,
    label: 'Комнаты',
    width: '100%',
    height: 3,
    border: {
      type: 'line'
    }
  });

  const chatBox = blessed.box({
    parent: window,
    label: 'Чат',
    width: '70%',
    height: '100%-6',
    top: 3,
    padding: {
      left: 1,
      right: 1
    },
    border: {
      type: 'line'
    }
  });

  const onlineBox = blessed.box({
    parent: window,
    label: 'В комнате',
    width: '30%',
    height: '100%-6',
    top: 3,
    right: 0,
    padding: {
      left: 1,
      right: 1
    },
    border: {
      type: 'line'
    }
  });

  const inputBox = blessed.box({
    parent: window,
    label: 'Ваше сообщение',
    width: '100%',
    height: 3,
    bottom: 0,
    padding: {
      left: 1,
      right: 1
    },
    border: {
      type: 'line'
    }
  });

  const warningBox = blessed.box({
    parent: window,
    width: 39,
    height: 7,
    top: 'center',
    left: 'center',
    align: 'center',
    inputOnFocus: true,
    padding: 1,
    border: {
      type: 'line',
      fg: '#F88'
    }
  });

  const dialogBox = blessed.box({
    parent: window,
    width: 39,
    height: 9,
    top: 'center',
    left: 'center',
    padding: {
      top: 1,
      left: 1,
      right: 1
    },
    border: {
      type: 'line'
    },
    style: {
      label: {
      }
    }
  });

  const settingsBox = blessed.box({
    parent: window,
    label: 'Настройки',
    width: 49,
    height: 6,
    top: 'center',
    left: 'center',
    padding: 1,
    border: {
      type: 'line'
    }
  });

  const helpBox = blessed.box({
    parent: window,
    label: 'Помощь',
    width: 58,
    height: 20,
    top: 'center',
    left: 'center',
    content:
    gold('Ctrl + E') + '                       ' + gold('Ctrl + Up') + '\n' +
    ' - подключиться к комнате       - история чата вверх\n' +
    gold('Ctrl + Q') + '                       ' + gold('Ctrl + Down') + '\n' +
    ' - отключиться от комнаты       - история чата вниз\n' +
    gold('Ctrl + N') + '                       ' + gold('Ctrl + Left') + '\n' +
    ' - создать комнату              - предыдущая комната\n' +
    gold('Ctrl + R') + '                       ' + gold('Ctrl + Right') + '\n' +
    ' - удалить комнату              - следующая комната\n\n' +
    gold('Ctrl + S') + '                       ' + gold('Up') + '\n' +
    ' - открыть меню настроек        - предыдущее сообщение\n' +
    gold('Ctrl + C') + '                       ' + gold('Down') + '\n' +
    ' - закрыть диалог или клиент    - следующее сообщение\n' +
    gold('Escape') + '                         ' + gold('Enter') + '\n' +
    ' - очистить поле ввода          - отправить сообщение',
    padding: {
      top: 1,
      left: 1,
      right: 1
    },
    border: {
      type: 'line'
    }
  });

/**
 * Определение функциональных областей
 */

  const roomsField = blessed.tabs({
    parent: roomsBox,
    style: {
      selected: {
        fg: 'white',
        bold: true,
        inverse: true
      },
      item: {
        fg: 'white',
        bold: true
      }
    }
  });

  const typingField = blessed.box({
    parent: chatBox,
    height: 1,
    bottom: 0
  });

  const onlineField = blessed.list({
    parent: onlineBox,
    interactive: false
  });

  const inputField = blessed.textarea({
    parent: inputBox,
    inputOnFocus: true
  });

  const settingsField = blessed.list({
    parent: settingsBox,
    items: [
      'Звуковые уведомления при сообщении:     ' + (settings.soundnotifier ? 'вкл.' : 'выкл.'), // 0
      'Графические уведомления при упоминании: ' + (settings.popupnotifier ? 'вкл.' : 'выкл.')  // 1
    ],
    style: {
      selected: {
        fg: 'white',
        bold: true,
        inverse: true
      },
      item: {
        fg: 'white',
        bold: true
      }
    }
  });

  const dialogDescField = blessed.box({
    parent: dialogBox,
    height: 1,
    top: 0,
    align: 'center'
  });

  const dialogInputField = blessed.textarea({
    parent: dialogBox,
    height: 1,
    top: 2,
    inputOnFocus: true,
    style: {
      bold: true,
      inverse: true
    }
  });

  const dialogHintField = blessed.box({
    parent: dialogBox,
    height: 2,
    bottom: 0,
    align: 'center'
  });

helpBox.append(blessed.box({
  height: 1,
  bottom: 0,
  align: 'center',
  content: gold('wschatclient@2.1.4 with <3 by helix')
}));

screen.append(window);

helpBox.hide();
settingsBox.hide();
warningBox.hide();
dialogBox.hide();

screen.render();

inputField.focus();

/**
 * Определение горячих клавиш
 */

  inputField.key('escape', () => {
    setTyping(false);
    inputField.focus();
    inputField.clearValue();
    screen.render()
  });

  inputField.key(['C-c'], () => {
    process.exit(0)
  });

  inputField.key(['C-n'], () => {
    callDialogBox(1)
  });

  inputField.key(['C-e'], () => {
    callDialogBox(2)
  });

  inputField.key(['C-r'], () => {
    callDialogBox(3)
  });

  inputField.key(['C-q'], () => {
    if (room != null) {
      chat.leaveRoom(room.target)
    }
  });

  inputField.key(['C-g'], () => {
    inputField.cancel();
    helpBox.show();
    helpBox.focus();
    screen.render()
  });

  inputField.key(['C-s'], () => {
    inputField.cancel();
    settingsBox.show();
    settingsField.focus();
    screen.render()
  });

  inputField.key(['C-left'], () => {
    roomsField.moveAndSelectLeft();
    screen.render()
  });

  inputField.key(['C-right'], () => {
    roomsField.moveAndSelectRight();
    screen.render()
  });

  inputField.key('enter', () => {
    setTyping(false);

    let input = inputField.getValue().slice(0, -1);
    if (room != null && input != '') {
      if (input == '/clear') {
        rooms[room.target].history.setContent('');
        rlog(room.target, gold('Ваш чат был очищен.'));
        screen.render()
      };

      if (input.startsWith('/re')) {
        if (input == '/re' || input == '/re ') {
          rlog(room.target, gold('Вы забыли написать текст сообщения :('))
        } else {
          if (lastPMFrom != 0) {
            let message = input.replace('/re ', '');
            room.sendMessage(`/umsg ${lastPMFrom} ${message}`)
          } else {
            rlog(room.target, gold('Вам еще никто не писал в ЛС.'))
          }
        }
      }

      else if (!input.startsWith('/re ') && input != '/clear') {
        room.sendMessage(input)
      };

      if (input != myMessages[myMessages.length - 1]) {
        myMessages.push(input);
        selectedMessage = myMessages.length
      };

      inputField.clearValue();
      selectedMessage = myMessages.length
    } else {
      inputField.clearValue();
      screen.render()
    }
  });

  inputField.key('backspace', () => {
    if (isHooked) {
      isHooked = false;
      let input = inputField.getValue();
      inputField.setValue(input.substring(0, input.lastIndexOf('@') + 1));
      selectedMatch = 0;
      screen.render()
    }
  });

  inputField.key('up', () => {
    if (selectedMessage > 0) {
      inputField.setValue(myMessages[--selectedMessage])
    };

    screen.render()
  });

  inputField.key('down', () => {
    if (selectedMessage < myMessages.length - 1) {
      inputField.setValue(myMessages[++selectedMessage])
    }

    else if (inputField.getValue() == myMessages[myMessages.length - 1]) {
      inputField.clearValue();
      selectedMessage = myMessages.length
    };

    screen.render()
  });

  inputField.key(['C-up'], () => {
    if (room != null) {
      rooms[room.target].history.scroll(-1);
      screen.render()
    }
  });

  inputField.key(['C-down'], () => {
    if (room != null) {
      rooms[room.target].history.scroll(1);
      screen.render()
    }
  });

  inputField.key('tab', () => {
    inputField.setValue(inputField.getValue().slice(0, -1));
    let input = inputField.getValue();
    let mentionPatternRegexp = new RegExp(input.substr(input.lastIndexOf('@')) + '$');
    if (room != null && input.lastIndexOf('@') != -1) {
      if (!isHooked) {
        pattern = input.substr(input.lastIndexOf('@') + 1)
      };

      patternMatches = (rooms[room.target].users).filter(name => {
        return name.startsWith(pattern)
      });

      if (patternMatches.length > 0) {
        isHooked = true;
        inputField.setValue(input.replace(mentionPatternRegexp, '@' + patternMatches[selectedMatch]));
        selectedMatch++;
        if (selectedMatch == patternMatches.length) {
          selectedMatch = 0
        }
      }
    };

    screen.render()
  })

  inputField.on('keypress', (ch, key) => {
    if (key.full != 'escape'    && key.full != 'tab'    &&
        key.full != 'home'      && key.full != 'right'  &&
        key.full != 'insert'    && key.full != 'end'    &&
        key.full != 'pagedown'  && key.full != 'pageup' &&
        key.full != 'return'    && key.full != 'enter'  &&
        key.full != 'delete'    && key.full != 'down'   &&
        key.full != 'up'        && key.full != 'left'   &&
        !key.ctrl) {
          setTyping(true)
    };

    if (key.full != 'backspace' && key.full != 'tab') {
      isHooked = false;
      selectedMessage = 0
    }
  });

  settingsField.key(['C-c', 'escape', 'C-s'], () => {
    settingsBox.hide();
    inputField.focus();
    screen.render()
  });

  settingsField.key(['down'], () => {
    settingsField.down(1);
    screen.render()
  });

  settingsField.key(['up'], () => {
    settingsField.up(1);
    screen.render()
  });

  settingsField.key('enter', () => {
    if (settingsField.selected == 0) {
      settings.soundnotifier = settings.soundnotifier ? false : true;
      settingsField.items[0].content = 'Звуковые уведомления при сообщении:     ' + (settings.soundnotifier ? 'вкл.' : 'выкл.');
    };

    if (settingsField.selected == 1) {
      settings.popupnotifier = settings.popupnotifier ? false : true;
      settingsField.items[1].content = 'Графические уведомления при упоминании: ' + (settings.popupnotifier ? 'вкл.' : 'выкл.');
    };

    screen.render()
  });

  dialogInputField.key('escape', () => {
    dialogInputField.focus();
    dialogInputField.clearValue();
    screen.render()
  });

  dialogInputField.key(['C-c'], () => {
    callDialogBox(0)
  });

  dialogInputField.key('enter', () => {
    let input = dialogInputField.getValue().slice(0, -1);
    input = input.startsWith('#') ? input : '#' + input;

    if (input == '#') {
      callDialogBox(0)
    } else {
      if (dialogBox.type == 1) {
        chat.createRoom(input, (success, errobj) => {
          if (success) {
            callDialogBox(0);
            return true
          } else {
            setDialogBoxError(errobj)
          }
        })
      }

      else if (dialogBox.type == 2) {
        chat.joinRoom({
          target: input,
          callback: (success, roomobj) => {
            if (success) {
              callDialogBox(0);
              return true
            } else {
              setDialogBoxError(roomobj)
            }
          },
          autoLogin: true,
          loadHistory: true
        });

        dialogInputField.clearValue()
      }

      else if (dialogBox.type == 3) {
        if (room != null) {
          if (input != room.target) {
            dialogInputField.clearValue();
            dialogHintField.setContent(red('Для удаления комнаты вы должны находится в ней.'));
            screen.render()
          } else {
            chat.removeRoom(input, (success, errobj) => {
              if (success) {
                callDialogBox(0)
              } else {
                setDialogBoxError(errobj)
              }
            })
          }
        } else {
          callDialogBox(0)
        }
      }
    }
  });

  warningBox.on('keypress', () => {
    warningBox.hide();
    inputField.focus();
    screen.render()
  });

  helpBox.on('keypress', () => {
    helpBox.hide();
    inputField.focus();
    screen.render()
  });

/**
 * Определение функций
 */

  function rlog(rname, text) {
    if (rooms[rname] != null) {
      rooms[rname].history.pushLine(text)
    } else {
      console.log('rlog fallback: ' + text)
    }
  };

  function callDialogBox(type) {
    /**
     * Вызов диалога
     *
     * 0 - обнулить свойства диалога и скрыть его
     * 1 - диалог создания новой комнаты
     * 2 - диалог подключения к комнате
     * 3 - диалог удаления комнаты
     */
     dialogBox.type = '0';
     dialogBox.setLabel('');
     dialogBox.style.border.fg = '';
     dialogBox.style.label.fg = '';
     dialogDescField.setContent('');
     dialogInputField.clearValue();
     dialogInputField.style.fg = '';
     dialogHintField.setContent('');

     if (type != 0) {
       if (type == 1) {
         dialogBox.type = '1';
         dialogBox.setLabel('Создание комнаты');
         dialogDescField.setContent(white.bold('Введите название новой комнаты'));
         dialogInputField.style.fg = 'white'
       }

       else if (type == 2) {
         dialogBox.type = '2';
         dialogBox.setLabel('Подключение к комнате');
         dialogDescField.setContent(white.bold('Введите название комнаты'));
         dialogInputField.style.fg = 'white'
       }

       else if (type == 3) {
         dialogBox.type = '3';
         dialogBox.setLabel('Удаление комнаты');
         dialogBox.style.border.fg = '#FF6347';
         dialogBox.style.label.fg = '#FF6347';
         dialogDescField.setContent(red('Введите название удаляемой комнаты'));
         dialogInputField.style.fg = '#FF6347'
      }

      inputField.cancel();
      dialogBox.show();
      dialogInputField.focus();
      screen.render()
    } else {
      dialogInputField.cancel();
      dialogBox.hide();
      inputField.focus();
      screen.render()
    }
  };

  function setDialogBoxError(errobj) {
    switch(errobj.code) {
      case errorcode.unknown:
        dialogHintField.setContent(red('Неизвестная ошибка.'))
      break;

      case errorcode.database_error:
        dialogHintField.setContent(red('Ошибка при подключении к базе данных.'))
      break;

      case errorcode.already_connected:
        dialogHintField.setContent(red('Вы уже подключены к данной комнате.'))
      break;

      case errorcode.not_found:
        dialogHintField.setContent(red('Такой комнаты не существует.'))
      break;

      case errorcode.access_denied:
        if (dialogBox.type == 1) {
          dialogHintField.setContent(red('Авторизируйтесь для создания комнаты.'))
        }

        else if (dialogBox.type == 3) {
          dialogHintField.setContent(red('Вы не являетесь создателем данной комнаты.'))
        }
      break;

      case errorcode.invalid_target:
        dialogHintField.setContent(red('Некорректное название комнаты.'))
      break;

      case errorcode.already_exists:
        dialogHintField.setContent(red('Комната с таким названием уже существует.'))

      default:
        dialogHintField.setContent(red(`Неизвестная ошибка: (${errobj.code}).`))
    };

    dialogInputField.clearValue();
    screen.render()
  };

  function roomChanged() {
    screen.title = `wschatclient - ${room.target}`;
    rooms[room.target].history.show();
    updateOnlineList();
    updateTypingList();

    screen.render()
  };

  function updateRoomsList() {
    roomsField.clearItems();

    for (let i in chat.rooms) {
      roomsField.addItem(chat.rooms[i].target, () => {
        if (room != null) {
          rooms[room.target].history.hide();
        };

        room = chat.rooms[i];
        roomChanged()
      })
    };

    roomsField.selectTab(roomsField.ritems.indexOf(room.target))
  };

  function updateOnlineList() {
    onlineField.clearItems();

    for (let i in room.getMembers()) {
      let user = room.getMembers()[i];

      let userColor = chalk.hex(hexifyColor(user.color)).bold;
      if (user.status == userstatus.online) {
        onlineField.add(gold('* ') + userColor(user.name))
      }

      else if (user.status == userstatus.away) {
        onlineField.add(gray('* ') + userColor(user.name))
      }
    };

    screen.render()
  };

  function updateUsersList(target) {
    rooms[target].users = rooms[target].users || [];
    rooms[target].users = room.getMembers().map(user => user.name);
    selectedMatch = 0
  };

  function updateTypingList() {
    var typingUsers = [];
    var typingUsers = room.getMembers().filter((userobj) => { return userobj.typing && userobj.name != room.getMyMemberNick() });

    typingUsers.length > 0 ? typingField.setContent(gray(typingUsers[0].name) + gray(typingUsers.length < 2 ? ' печатает...' : ' и другие печатают...')) : typingField.setContent('')
  };

  function hexifyColor(value) {
    return {
      'aquamarine': '#7FFFD4',
      'deeppink':   '#FF1493',
      'dodgerblue': '#1E90FF',
      'gray':       '#808080'
    }

    [value] || value
  };

  function processMessage(message) {
    let urlRegexp = /https?:\/\/[^\s"']+/g;
    let quoteRegexp = /^> (?:([\s\S]+?)(?:\n^$\n?)|([\s\S]+)$)/mg;
      if (message.startsWith('> ')) {
        message = message.replace('>', '\n>')
      };

      message = message.replace(urlRegexp, chalk.hex('#9797FF')('$&'));
      message = message.replace(quoteRegexp, chalk.hex('#EEEE88')('$&'));

      if (message.indexOf('> ') != -1) {
        message = message.replace(/\n\n/g, '\n')
      };

      return message
  };

  function setTyping(value) {
    if (value) {
      if (!timerTyping.started) {
        sendTyping(true)
      }
      timerTyping.start(5)
    } else {
      timerTyping.stop();
      sendTyping(false)
    }
  };

  function sendTyping(value) {
    if (room != null && room.getMyMemberNick() != '') {
      room.changeStatus(value ? userstatus.typing : userstatus.stop_typing)
    }
  };

  function soundNotify() {
    if (settings.soundnotifier && !isFocused && room.getMyMemberNick() != '') {
      process.stdout.write('\x07')
    }
  };

/**
 * Обработка событий в чате
 */

  chat.onOpen = function() {
    if (settings.login != '' && settings.password != '' && !isAuthorized) {
      chat.authByLoginAndPassword(settings.login, settings.password, (success, userinfo) => {
        if (success) {
          isAuthorized = true
        } else {
          if (userinfo.code == errorcode.access_denied) {
            warningBox.setContent(red('Ошибка при авторизации:\nПревышено количество попыток авторизации, попробуйте позже.'))
          }

          else if (userinfo.code == errorcode.incorrect_loginpass) {
            warningBox.setContent(red('Ошибка при авторизации:\nНеверный логин и/или пароль.'))
          } else {
            warningBox.setContent(red(`Ошибка при авторизации:\nНеизвестная ошибка (${userinfo.code}).`))
          };

          inputField.cancel();
          warningBox.show();
          warningBox.focus();
          screen.render();
        }
      })
    };

    if (settings.apikey != '' && !isAuthorized) {
      chat.authByApiKey(settings.apikey, (success, userinfo) => {
        if (userinfo.user_id != 0) {
          isAuthorized = true
        } else {
          warningBox.setContent(red('Ошибка при авторизации:\nНеверный API ключ.'));
          inputField.cancel();
          warningBox.show();
          warningBox.focus();
          screen.render()
        }
      })
    };

    chat.joinRoom({
      target: '#chat',
      autoLogin: true,
      loadHistory: true
    });

    isOpened = true
  };

  chat.onJoinedRoom = function(roomobj) {
    rooms[roomobj.target] = rooms[roomobj.target] || {};
    if (rooms[roomobj.target].history == null) {
      rooms[roomobj.target].history = blessed.log({
        parent: chatBox,
        height: '100%-3',
        mouse: true,
        style: {
          fg: 'white'
        }
      })
    }

    if (room != null) {
      rooms[room.target].history.hide()
    };

    room = roomobj;
    updateRoomsList();
    updateUsersList(room.target)
  };

  chat.onLeaveRoom = function(roomobj) {
    rooms[room.target].history.setContent('');
    if (roomsField.ritems.length > 1) {
      if (roomsField.ritems.indexOf(room.getTarget()) == 0) {
        roomsField.selectCurrentTab();
        updateRoomsList()
      } else {
        roomsField.moveAndSelectLeft();
        updateRoomsList()
      }
    } else {
      screen.title = 'wschatclient';
      rooms[room.target].history.setContent('');
      onlineField.clearItems();
      roomsField.clearItems();
      room = null
    };

    screen.render()
  };

  chat.onRoomCreated = function(target) {
    chat.joinRoom({
      target: target,
      autoLogin: true,
      loadHistory: true
    })
  };

  chat.onMessage = function(room, msgobj) {
    let target = msgobj.target;

    if (settings.popupnotifier && !isFocused && room.getMyMemberNick() != '' && msgobj.message.indexOf('@' + room.getMyMemberNick()) != -1) {
      notifier.notify({
        'title': `[${msgobj.target}] ${msgobj.from_login}`,
        'message': msgobj.message.substr(0, 64) + (msgobj.message.length > 64 ? '...' : ''),
        'timeout': 5
      })
    };

    let userColor = chalk.hex(hexifyColor(msgobj.color)).bold;
    let message = processMessage(msgobj.message);

    if (msgobj.style == messagestyle.message && msgobj.to == 0) {
      rlog(target, userColor(msgobj.from_login + ': ') + message)
    };

    if (msgobj.style == messagestyle.me) {
      rlog(target, gray('* ') + userColor(msgobj.from_login, '') + message)
    };

    if (msgobj.style == messagestyle.event) {
      rlog(target, gray('* ') + message)
    };

    if (msgobj.style == messagestyle.offtop) {
      let message = msgobj.message.replace(/https?:\/\/[^\s"']+/g, chalk.hex('#9797FF')('$&'));
      rlog(target, userColor(msgobj.from_login + ': ') + chalk.hex('#808080')('((', message, '))'))
    };

    if (msgobj.to != 0) {
      if (msgobj.from_login != room.getMyMemberNick()) {
        lastPMFrom = msgobj.from
      };

      let toUserColor = chalk.hex(hexifyColor(room.getMemberById(msgobj.to).color)).bold;
      rlog(target, gray('(лс) ') + userColor(msgobj.from_login) + gray(' > ') + toUserColor(room.getMemberById(msgobj.to).name + ': ') + message)
    };

    screen.render()
  };

  chat.onUserStatusChanged = function(room, userobj) {
    let target = userobj.target;
    switch(userobj.status) {
      case userstatus.nick_change:
        rlog(target, skyblue(userobj.data) + gold(userobj.girl ? ' сменила никнейм на ' : ' сменил никнейм на ') + skyblue(userobj.name));
        updateUsersList(userobj.target)
      break;

      case userstatus.gender_change:
        if (room.getMyMemberNick() == '') {
          rlog(target, gold('Вы сменили пол на ' + skyblue(userobj.girl ? 'женский' : 'мужской')))
        } else {
          rlog(target, skyblue(userobj.name) + (userobj.girl ? gold(' сменил пол на ') + skyblue('женский') : gold(' сменила пол на ') + skyblue('мужской')))
        }
      break;

      case userstatus.color_change:
        if (room.getMyMemberNick() == '') {
          rlog(target, gold('Вы сменили ' + chalk.hex(userobj.color).bold('цвет')))
        } else {
          rlog(target, skyblue(userobj.name) + gold(userobj.girl ? ' сменила ' : ' сменил ') + chalk.hex(userobj.color).bold('цвет'))
        }
      break;

      case userstatus.typing:
      case userstatus.stop_typing:
        updateTypingList()
    };

    updateOnlineList()
  };

  chat.onUserConnected = function(room, userobj) {
    rlog(userobj.target, skyblue(userobj.name) + gold(userobj.girl ? ' подключилась к комнате' : ' подключился к комнате'));
    updateOnlineList();
    updateUsersList(userobj.target)
  };

  chat.onUserDisconnected = function(room, userobj) {
    rlog(userobj.target, skyblue(userobj.name) + gold(userobj.girl ? ' отключилась от комнаты' : ' отключился от комнаты'));
    updateOnlineList();
    updateUsersList(userobj.target)
  };

  chat.onSysMessage = function(room, message) {
    rlog(room.target, gold(message));
    screen.render()
  };

screen.on('focus', () => {
  if (isOpened) {
    isFocused = true;
    chat.changeStatus(userstatus.back)
  }
});

screen.on('blur', () => {
  if (isOpened) {
    isFocused = false;
    chat.changeStatus(userstatus.away)
  }
})
