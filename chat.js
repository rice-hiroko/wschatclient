'use strict';

const wschat  = require('wschatapi');
const chalk   = require('chalk');
const blessed = require('blessed');

const config     = require('./config');
const helper     = require('./lib/helpers');
const tabswidget = require('./lib/widgets/tabs');

const chat = new wschat('wss://sinair.ru/ws/chat');

chat.open();

var isOpened        = false;
var room            = null;
var history         = {};
var myMessages      = [];
var selectedMessage = myMessages.length;

const white   = chalk.white;
const gray    = chalk.hex('#808080').bold;
const gold    = chalk.hex('#FFD700').bold;
const skyblue = chalk.hex('#87CEEB').bold;
const tomato  = chalk.hex('#FF6347').bold;

const window = blessed.screen({ smartCSR: true, sendFocus: true });

window.title = 'wschatclient';

process.on('SIGWINCH', () => {
  window.emit('resize')
});

const roomsBox  = blessed.box({ label: 'Комнаты', width: '100%', height: 3, border: { type: 'line' } });
const chatBox   = blessed.box({ label: 'Чат', width: '70%', height: '100%-6', top: 3, border: { type: 'line' } });
const onlineBox = blessed.box({ label: 'В комнате', width: '30%', height: '100%-6', top: 3, right: 0, border: { type: 'line' } });
const inputBox  = blessed.box({ label: 'Ваше сообщение:', width: '100%', height: 3, bottom: 0, border: { type: 'line' } });
const joinToBox = blessed.box({ label: 'Подключиться к комнате:', width: 32, height: 6, padding: { top: 1, right: 1, left: 1}, left: 'center', top: 'center', border: { type: 'line' } });

const roomsField      = tabswidget({ parent: roomsBox, padding: { right: 1 }, style: { selected: { fg: 'white', bold: true, inverse: true }, item: { fg: 'white', bold: true } } });
const chatField       = blessed.log({ parent: chatBox, height: '100%-3', mouse: true, padding: { left:  1, right: 1 }, style: {fg: 'white'} });
const typingField     = blessed.box({ parent: chatBox, height: 1, bottom: 0, padding: { left:  1, right: 1 } });
const onlineField     = blessed.list({ parent: onlineBox, interactive: false, padding: { left:  1, right: 1 } });
const inputField      = blessed.textarea({ parent: inputBox, inputOnFocus: true, padding: { left:  1, right: 1 } });
const joinToField     = blessed.textarea({ parent: joinToBox, inputOnFocus: true, height: 1 });
const joinToHintField = blessed.box({ parent: joinToBox, height: 1, bottom: 0 })

window.append(roomsBox);
window.append(chatBox);
window.append(onlineBox);
window.append(inputBox);
window.append(joinToBox);

joinToBox.hide();
window.render();
inputField.focus();

/**
 * Определение горячих клавиш
 *
 * inputField  - поле ввода сообщения
 * joinToField - поле ввода названия комнаты для подключения
 */

  inputField.key('escape', () => {
    inputField.focus();
    inputField.clearValue();
    window.render()
  });

  inputField.key(['C-c'], () => {
    process.exit(0)
  });

  inputField.key(['C-e'], () => {
    joinToHintField.setContent('');
    inputField.cancel();
    joinToBox.show();
    joinToField.focus();
    window.render()
  });

  inputField.key(['C-q'], () => {
    if (room != null) {
      chat.leaveRoom(room.target)
    }
  });

  inputField.key(['C-left'], () => {
    roomsField.moveAndSelectLeft();
    window.render()
  });

  inputField.key(['C-right'], () => {
    roomsField.moveAndSelectRight();
    window.render()
  });

  inputField.key('enter', () => {
    let message = inputField.getValue().replace('\n', '');
    if (message != '') {
      if (message == '/clear') {
        history[room.target] = [];
        chatField.setContent('');
        hlog(room.target, gold('Ваш чат был очищен.'));
        window.render()
      }

      else if (roomsField.ritems.length > 0) {
        room.sendMessage(message)
      };

      if (message != myMessages[myMessages.length - 1]) {
        myMessages.push(message);
        selectedMessage = myMessages.length
      };

      inputField.clearValue();
      selectedMessage = myMessages.length
    }

    else {
      inputField.clearValue();
      window.render()
    }
  });

  inputField.key('up', () => {
    if (selectedMessage > 0) {
      inputField.setValue(myMessages[--selectedMessage])
    };

    window.render()
  });

  inputField.key('down', () => {
    if (selectedMessage < myMessages.length - 1) {
      inputField.setValue(myMessages[++selectedMessage])
    }

    else if (inputField.getValue() == myMessages[myMessages.length - 1]) {
      inputField.setValue('');
      selectedMessage = myMessages.length
    };

    window.render()
  });

  inputField.key(['C-up'], () => {
    chatField.scroll(-1);
    window.render()
  });

  inputField.key(['C-down'], () => {
    chatField.scroll(1);
    window.render()
  });



  joinToField.key('escape', () => {
    joinToField.focus();
    joinToField.clearValue();
    window.render()
  });

  joinToField.key(['C-c'], () => {
    joinToField.cancel();
    joinToBox.hide();
    inputField.focus();
    window.render()
  });

  joinToField.key('enter', () => {
    let _input = joinToField.getValue().replace('\n', '');
    let input = _input.startsWith('#') ? _input : '#' + _input;

    if (input == '#') {
      joinToField.cancel();
      joinToBox.hide();
      inputField.focus();
      window.render();
    }

    else {
      chat.joinRoom({
        target: input,
        callback: (success) => {
          if (success) {
            joinToField.cancel();
            joinToBox.hide();
            inputField.focus();
            return true
          }

          else {
            joinToHintField.setContent(tomato('Такой комнаты не существует.'));
            window.render()
          }
        },
        autoLogin: true,
        loadHistory: true
      });

      joinToField.clearValue()
    };
  });

/**
 * Определение функций
 */

  function log(text) {
    chatField.pushLine(text)
  };

  function hlog(rname, text) {
    if (room.target == rname) {
      chatField.pushLine(text)
    }

    history[rname] = history[rname] || [];
    history[rname].push(text)
  };

  function roomChanged() {
    window.title = 'wschatclient - ' + room.target;
    chatField.setContent('');
    updateOnlineList();

    for (let i in history[room.target]) {
      log(history[room.target][i])
    };

    window.render();
  };

  function updateRoomsList() {
    roomsField.clearItems();

    for (let i in chat.rooms) {
      roomsField.addItem(chat.rooms[i].target, () => {
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

      let userColor = chalk.hex(helper.hexifyColor(user.color)).bold;

      if (user.status == 2) {
        onlineField.insertItem(0, (gold('* ') + userColor(user.name)))
      }

      else if (user.status == 3) {
        onlineField.insertItem(0, (gray('* ') + userColor(user.name)))
      }
    }

    window.render()
  };

  function updateTypingList() {
    var typingUsers = [];

    for (let i in room.getMembers()) {
      let user = room.getMembers()[i];

      if (user.typing && user.name != room.getMyMemberNick()) {
        typingUsers.push(user)
      };

      typingUsers.length > 0 ? typingField.setContent(gray(typingUsers[0].name) + gray(typingUsers.length < 2 ? ' печатает...' : ' и другие печатают...')) : typingField.setContent('')
    }
  }

/**
 * Обработка событий в чате
 */

  chat.onOpen = function() {
    if (config.APIKey != '') {
      chat.authByApiKey(config.APIKey, (success, userinfo) => {})
    };

    chat.joinRoom({
      target: '#chat',
      autoLogin: true,
      loadHistory: true
    });

    isOpened = true
  };

  chat.onJoinedRoom = function(roomobj) {
    room = roomobj;
    updateRoomsList()
  };

  chat.onLeaveRoom = function(roomobj) {
    if (roomsField.ritems.length > 1) {
      if (roomsField.ritems.indexOf(room.getTarget()) == 0) {
        roomsField.selectCurrentTab();
        updateRoomsList()
      }

      else {
        roomsField.moveAndSelectLeft();
        updateRoomsList()
      }
    }

    else {
      chatField.setContent('');
      onlineField.clearItems();
      roomsField.clearItems();
      room = null
    };

    history[roomobj.target] = [];
    window.render()
  }

  chat.onMessage = function(room, msgobj) {
    let htarget = msgobj.target;

    let userColor = chalk.hex(helper.hexifyColor(msgobj.color)).bold;
    let message = msgobj.message.replace(/https?:\/\/[^\s"']+/g, chalk.hex('#9797FF').bold('$&'));

    if (msgobj.style == 0 && msgobj.to == 0) {
      let content = (userColor(msgobj.from_login, ': ') + message).replace(' :', ':');
      hlog(htarget, content)
    };

    if (msgobj.style == 1) {
      let content = gray('* ') + userColor(msgobj.from_login, '') + white(message);
      hlog(htarget, content)
    };

    if (msgobj.style == 2) {
      let content = gray('* ') + white(message);
      hlog(htarget, content)
    };

    if (msgobj.style == 3) {
      let message = msgobj.message.replace(/https?:\/\/[^\s"']+/g, chalk.hex('#9797FF')('$&'));
      let content = (userColor(msgobj.from_login, ': ') + chalk.hex('#808080')('((', message, '))')).replace(' :', ':');
      hlog(htarget, content)
    };

    if (msgobj.to != 0) {
      let toUserColor = chalk.hex(helper.hexifyColor(room.getMemberById(msgobj.to).color)).bold;

      let content = (gray('(лс) ') + userColor(msgobj.from_login) + gray(' > ') + toUserColor(room.getMemberById(msgobj.to).name, ': ') + white(message)).replace(' :', ':');
      hlog(htarget, content)
    }

    window.render()
  };

  chat.onUserStatusChanged = function(room, userobj) {
    let htarget = userobj.target;

    if (userobj.name != '') {
      if (userobj.status == 4) {
        let content = userobj.girl ? skyblue(userobj.data) + gold(' сменила никнейм на ') + skyblue(userobj.name) : skyblue(userobj.data) + gold(' сменил никнейм на ') + skyblue(userobj.name)
        hlog(htarget, content)
      };

      if (userobj.status == 5) {
        let content = userobj.girl ? skyblue(userobj.name) + gold(' сменил пол на ') + skyblue('женский') : skyblue(userobj.name) + gold(' сменила пол на ') + skyblue('мужской')
        hlog(htarget, content)
      };

      if (userobj.status == 6) {
        let content = userobj.girl ? skyblue(userobj.name) + gold(' сменила ') + chalk.hex(userobj.color).bold('цвет') : skyblue(userobj.name) + gold(' сменил ') + chalk.hex(userobj.color).bold('цвет')
        hlog(htarget, content)
      };

      if (userobj.status == 8 || userobj.status == 9) {
        updateTypingList()
      };

      updateOnlineList()
    }
  };

  chat.onUserConnected = function(room, userobj) {
    let content = userobj.girl ? skyblue(userobj.name) + gold(' подключилась к комнате') : skyblue(userobj.name) + gold(' подключился к комнате');
    hlog(userobj.target, content);
    updateOnlineList()
  };

  chat.onUserDisconnected = function(room, userobj) {
    let content = userobj.girl ? skyblue(userobj.name) + gold(' отключилась от комнаты') : skyblue(userobj.name) + gold(' отключился от комнаты');
    hlog(userobj.target, content);
    updateOnlineList()
  };

  chat.onSysMessage = function(roomobj, msg) {
    hlog(room.target, gold(msg));
    window.render()
  };

  window.on('focus', () => {
    if (isOpened) {
      chat.changeStatus(7)
    }
  });

  window.on('blur', () => {
    if (isOpened) {
      chat.changeStatus(3)
    }
  })
