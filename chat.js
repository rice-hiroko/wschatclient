'use strict';

const wschat  = require('wschatapi');
const chalk   = require('chalk');
const blessed = require('blessed');

const config     = require('./config');
const helper     = require('./lib/helpers');
const tabswidget = require('./lib/widgets/tabs');

const chat = new wschat('wss://sinair.ru/ws/chat');

const errorcode    = wschat.ErrorCode;
const messagestyle = wschat.MessageStyle;
const userstatus   = wschat.UserStatus;

const userlogin    = config.Authorization.Login;
const userpassword = config.Authorization.Password;

var isOpened        = false;
var isAuthorized    = false;
var room            = null;
var history         = {};
var myMessages      = [];
var selectedMessage = myMessages.length;

chat.open();

const white   = chalk.white;
const gray    = chalk.hex('#808080').bold;
const gold    = chalk.hex('#FFD700').bold;
const skyblue = chalk.hex('#87CEEB').bold;
const red     = chalk.hex('#FF5F5F').bold;

const window = blessed.screen({ smartCSR: true, sendFocus: true });

window.title = 'wschatclient';

process.on('SIGWINCH', () => {
  window.emit('resize')
});

const roomsBox   = blessed.box({ label: 'Комнаты', width: '100%', height: 3, border: { type: 'line' } });
const chatBox    = blessed.box({ label: 'Чат', width: '70%', height: '100%-6', top: 3, border: { type: 'line' } });
const onlineBox  = blessed.box({ label: 'В комнате', width: '30%', height: '100%-6', top: 3, right: 0, border: { type: 'line' } });
const inputBox   = blessed.box({ label: 'Ваше сообщение', width: '100%', height: 3, bottom: 0, border: { type: 'line' } });
const warningBox = blessed.box({ width: 39, height: 7, inputOnFocus: true, padding: 1, left: 'center', top: 'center', align: 'center', border: { type: 'line', fg: '#FF6347' } });
const dialogBox  = blessed.box({ width: 39, height: 9, padding: { top: 1, right: 1, left: 1 }, left: 'center', top: 'center', border: { type: 'line' }, style: { label: {} } });

const roomsField       = tabswidget({ parent: roomsBox, style: { selected: { fg: 'white', bold: true, inverse: true }, item: { fg: 'white', bold: true } } });
const chatField        = blessed.log({ parent: chatBox, height: '100%-3', mouse: true, padding: { left:  1, right: 1 }, style: { fg: 'white' } });
const typingField      = blessed.box({ parent: chatBox, height: 1, bottom: 0, padding: { left:  1, right: 1 } });
const onlineField      = blessed.list({ parent: onlineBox, interactive: false, padding: { left:  1, right: 1 } });
const inputField       = blessed.textarea({ parent: inputBox, inputOnFocus: true, padding: { left:  1, right: 1 } });
const dialogDescField  = blessed.box({ parent: dialogBox, height: 1, top: 0, align: 'center' });
const dialogInputField = blessed.textarea({ parent: dialogBox, inputOnFocus: true, height: 1, top: 2, style: { bold: true, inverse: true } });
const dialogHintField  = blessed.box({ parent: dialogBox, height: 2, bottom: 0, align: 'center' });

window.append(roomsBox);
window.append(chatBox);
window.append(onlineBox);
window.append(inputBox);
window.append(warningBox);
window.append(dialogBox);

warningBox.hide();
dialogBox.hide();

window.render();

inputField.focus();

/**
 * Определение горячих клавиш
 */

  inputField.key('escape', () => {
    inputField.focus();
    inputField.clearValue();
    window.render()
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
  })

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
    let input = inputField.getValue().replace('\n', '');
    if (input != '') {
      if (input == '/clear') {
        history[room.target] = [];
        chatField.setContent('');
        hlog(room.target, gold('Ваш чат был очищен.'));
        window.render()
      }

      else if (roomsField.ritems.length > 0) {
        room.sendMessage(input)
      };

      if (input != myMessages[myMessages.length - 1]) {
        myMessages.push(input);
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
      inputField.clearValue();
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



  dialogInputField.key('escape', () => {
    dialogInputField.focus();
    dialogInputField.clearValue();
    window.render()
  });

  dialogInputField.key(['C-c'], () => {
    callDialogBox(0)
  });

  dialogInputField.key('enter', () => {
    let _input = dialogInputField.getValue().replace('\n', '');
    let input = _input.startsWith('#') ? _input : '#' + _input;

    if (input == '#') {
      callDialogBox(0)
    }

    else {
      if (dialogBox.type == 1) {
        chat.createRoom(input, (success, err) => {
          if (success) {
            callDialogBox(0);
            return true
          }

          else {
            if (err.code == errorcode.invalid_target) {
              dialogHintField.setContent(red('Недопустимое название комнаты.'))
            }

            else if (err.code == errorcode.already_exists) {
              dialogHintField.setContent(red('Комната с таким названием уже существует.'))
            }

            else if (err.code == errorcode.access_denied && !isAuthorized) {
              dialogHintField.setContent(red('Для создания комнаты необходимо авторизироваться.'))
            }

            else {
              dialogHintField.setContent(red(`Неизвестная ошибка (${err.code}).`))
            };

            dialogInputField.clearValue();
            window.render()
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
            }

            else {
              if (roomobj.code == errorcode.already_connected) {
                dialogHintField.setContent(red('Вы уже подключены к данной комнате.'))
              }

              else if (roomobj.code == errorcode.not_found) {
                dialogHintField.setContent(red('Такой комнаты не существует.'))
              }

              else {
                dialogHintField.setContent(red(`Неизвестная ошибка (${roomobj.code}).`))
              };

              window.render()
            }
          },
          autoLogin: true,
          loadHistory: true
        });

        dialogInputField.clearValue()
      }

      else if (dialogBox.type == 3) {
        if (input != room.target) {
          dialogInputField.clearValue();
          dialogHintField.setContent(red('Для удаления комнаты вы должны находится в ней.'));
          window.render()
        }

        else {
          chat.removeRoom(input, (success, err) => {
            if (success) {
              callDialogBox(0)
            }

            else {
              if (err.code == errorcode.access_denied) {
                dialogHintField.setContent(red('Вы не являетесь создателем комнаты.'))
              }

              else {
                dialogHintField.setContent(red(`Неизвестная ошибка (${err.code}).`))
              };

              window.render()
            }
          })
        }
      }
    }
  });



  warningBox.on('keypress', () => {
    warningBox.hide();
    inputField.focus();
    window.render()
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

  function callDialogBox(type) {
    /**
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
      window.render()
    }

    else {
      dialogInputField.cancel();
      dialogBox.hide();
      inputField.focus();
      window.render();
    }
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
    if (userlogin != '' && userpassword != '') {
      chat.authByLoginAndPassword(userlogin, userpassword, (success, userinfo) => {
        if (success) {
          isAuthorized: true
        }

        else {
          if (userinfo.code == errorcode.access_denied) {
            warningBox.setContent(red('Ошибка при авторизации:\nПревышено количество попыток авторизации, попробуйте позже.'));
          }

          else if (userinfo.code == errorcode.incorrect_loginpass) {
            warningBox.setContent(red('Ошибка при авторизации:\nНеверный логин и/или пароль.'));
          }

          else {
            warningBox.setContent(red(`Ошибка при авторизации:\nНеизвестная ошибка (${userinfo.code}).`));
          };

          inputField.cancel();
          warningBox.show();
          warningBox.focus();
          window.render();
        }
      })
    };

    chat.joinRoom({
      target: '#wschatclient-dev',
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
  };

  chat.onRoomCreated = function(ntarget) {
    chat.joinRoom({
      target: ntarget,
      autoLogin: true,
      loadHistory: true
    })
  }

  chat.onMessage = function(room, msgobj) {
    let htarget = msgobj.target;

    let userColor = chalk.hex(helper.hexifyColor(msgobj.color)).bold;
    let message = msgobj.message.replace(/https?:\/\/[^\s"']+/g, chalk.hex('#9797FF').bold('$&'));

    if (msgobj.style == messagestyle.message && msgobj.to == 0) {
      let content = (userColor(msgobj.from_login, ': ') + message).replace(' :', ':');
      hlog(htarget, content)
    };

    if (msgobj.style == messagestyle.me) {
      let content = gray('* ') + userColor(msgobj.from_login, '') + white(message);
      hlog(htarget, content)
    };

    if (msgobj.style == messagestyle.event) {
      let content = gray('* ') + white(message);
      hlog(htarget, content)
    };

    if (msgobj.style == messagestyle.offtop) {
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
      if (userobj.status == userstatus.nick_change) {
        let content = userobj.girl ? skyblue(userobj.data) + gold(' сменила никнейм на ') + skyblue(userobj.name) : skyblue(userobj.data) + gold(' сменил никнейм на ') + skyblue(userobj.name)
        hlog(htarget, content)
      };

      if (userobj.status == userstatus.gender_change) {
        let content = userobj.girl ? skyblue(userobj.name) + gold(' сменил пол на ') + skyblue('женский') : skyblue(userobj.name) + gold(' сменила пол на ') + skyblue('мужской')
        hlog(htarget, content)
      };

      if (userobj.status == userstatus.color_change) {
        let content = userobj.girl ? skyblue(userobj.name) + gold(' сменила ') + chalk.hex(userobj.color).bold('цвет') : skyblue(userobj.name) + gold(' сменил ') + chalk.hex(userobj.color).bold('цвет')
        hlog(htarget, content)
      };

      if (userobj.status == userstatus.typing || userobj.status == userstatus.stop_typing) {
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
