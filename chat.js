'use strict';

const wschat  = require('wschatapi');
const chalk   = require('chalk');
const blessed = require('blessed');

const config = require('./config');

const chat = new wschat('wss://sinair.ru/ws/chat');

const white   = chalk.white;
const gray    = chalk.hex('#808080').bold;
const gold    = chalk.hex('#FFD700').bold;
const skyblue = chalk.hex('#87CEEB').bold;
const tomato  = chalk.hex('#FF6347').bold;

const window = blessed.screen({ smartCSR: true, sendFocus: true });

window.title = 'wschatclient';

const roomsBox  = blessed.box({
  label:  'Комнаты',
  width:  '100%',
  height: 3,
  border: {
    type: 'line'
  }
});

const chatBox   = blessed.box({
  label:  'Чат',
  width:  '100%-24',
  height: '100%-6',
  top:    3,
  border: {
    type: 'line'
  }
});

const onlineBox = blessed.box({
  label:  'В комнате',
  width:  24,
  height: '100%-6',
  top:    3,
  right:  0,
  border: {
    type: 'line'
  }
});

const inputBox  = blessed.box({
  label:  'Сообщение',
  width:  '100%',
  height: 3,
  bottom: 0,
  border: {
    type: 'line'
  }
});

const roomsField  = blessed.box({
  parent: roomsBox,
  padding: {
    left:  1,
    right: 1
  }
});

const chatField   = blessed.log({
  parent: chatBox,
  height: '100%-3',
  mouse:  true,
  padding: {
    left:  1,
    right: 1
  }
});

const typingField = blessed.box({
  parent: chatBox,
  height: 1,
  bottom: 0,
  padding: {
    left:  1,
    right: 1
  }
});

const onlineField = blessed.list({
  parent:      onlineBox,
  interactive: false,
  padding: {
    left:  1,
    right: 1
  }
});
const inputField  = blessed.textarea({
  parent: inputBox,
  inputOnFocus: true,
  padding: {
    left:  1,
    right: 1
  }
});

window.append(roomsBox);
window.append(chatBox);
window.append(onlineBox);
window.append(inputBox);

inputField.key(['C-c'], () => process.exit(0));
inputField.key(['C-r'], () => {
  inputField.clearValue();
  window.render()
});

function log(text) {
  chatField.pushLine(text);
  window.render()
};

window.render();

process.on('SIGWINCH', () => window.emit('resize'));

inputField.focus();

chat.open();

chat.onOpen = function() {
  if (config.APIKey != '') {
    chat.authByApiKey(config.APIKey, (success, userinfo) => {})
  }

  chat.joinRoom({
    target: '#' + (process.argv[2] ? process.argv[2] : 'chat'),
    callback: function(success, room) {
      if (success) {
        window.title = 'wschatclient - ' + room.getTarget();
        roomsField.setContent(white.bold.inverse(room.getTarget()));

        updateOnlineList();

        room.onMessage = function(msgobj) {
          var color = msgobj.color;
          if (color == 'gray') {
            var color = '#808080'
          };

          var userColor = chalk.hex(color).bold;

          if (msgobj.style == 0 && msgobj.to == 0) {
            log((userColor(msgobj.from_login, ': ') + white(msgobj.message)).replace(' :', ':'))
          };

          if (msgobj.style == 1) {
            log(gray('* ') + userColor(msgobj.from_login, '') + white(msgobj.message))
          };

          if (msgobj.style == 2) {
            log(gray('* ') + white(white(msgobj.message)))
          };

          if (msgobj.style == 3) {
            log((userColor(msgobj.from_login, ': ') + chalk.hex('#808080')('((', msgobj.message, '))')).replace(' :', ':'))
          };

          if (msgobj.to != 0) {
            var toColor = room.getMemberById(msgobj.to).color;
            if (toColor == 'gray') {
              var toColor = '#808080'
            };

            var toUserColor = chalk.hex(toColor).bold;

            log((gray('(лс) ') + userColor(msgobj.from_login) + gray(' > ') + toUserColor(room.getMemberById(msgobj.to).name, ': ') + white(msgobj.message)).replace(' :', ':'))
          }
        };

        room.onUserStatusChanged = function(userobj) {
          if (userobj.name != '') {
            if (userobj.status == 4) {
              userobj.girl ? log(skyblue(userobj.data) + gold(' сменила никнейм на ') + skyblue(userobj.name)) : log(skyblue(userobj.data) + gold(' сменил никнейм на ') + skyblue(userobj.name))
            };

            if (userobj.status == 5) {
              userobj.girl ? log(skyblue(userobj.name) + gold(' сменил пол на ') + skyblue('женский')) : log(skyblue(userobj.name) + gold(' сменила пол на ') + skyblue('мужской'))
            };

            if (userobj.status == 6) {
              userobj.girl ? log(skyblue(userobj.name) + gold(' сменила ') + chalk.hex(userobj.color).bold('цвет')) : log(skyblue(userobj.name) + gold(' сменил ') + chalk.hex(userobj.color).bold('цвет'))
            };

            if (userobj.status == 8 || userobj.status == 9) {
              updateTypingList()
            };

            updateOnlineList()
          }
        };

        room.onUserConnected = function(userobj) {
          userobj.girl ? log(skyblue(userobj.name) + gold(' подключилась к комнате')) : log(skyblue(userobj.name) + gold(' подключился к комнате'));
          updateOnlineList()
        };

        room.onUserDisconnected = function(userobj) {
          userobj.girl ? log(skyblue(userobj.name) + gold(' отключилась от комнаты')) : log(skyblue(userobj.name) + gold(' отключился от комнаты'));
          updateOnlineList()
        };

        room.onSysMessage = function (msg) {
          log(gold(msg))
        };

        function updateOnlineList() {
          onlineField.clearItems();
          var users = room.getMembers();

          for (var i in users) {
            var user = users[i];

            var color = user.color;
            if (user.color == 'gray') {
              color = '#808080'
            };

            var userColor = chalk.hex(color).bold;

            if (user.status == 2) {
              onlineField.insertItem(0, (gold('* ') + userColor(user.name)))
            }

            else if (user.status == 3) {
              onlineField.insertItem(0, (gray('* ') + userColor(user.name)));
            }
          }
          window.render()
        };

        function updateTypingList() {
          var users = room.getMembers();
          var typingUsers = [];

          for (var i in users) {
            var user = users[i];

            if (user.typing && user.name != room.getMyMemberNick()) {
              typingUsers.push(user)
            };

            typingUsers.length > 0 ? typingField.setContent(gray(typingUsers[0].name) + gray(typingUsers.length < 2 ? ' печатает...' : ' и другие печатают...')) : typingField.setContent('')
          }
        };

        window.on('focus', function() {
          room.changeStatus(7)
        });

        window.on('blur', function() {
          room.changeStatus(3)
        });

        var myMessages = [];
        var selectedMessage = myMessages.length;

        inputField.key('enter', () => {
          var message = inputField.getValue().replace('\n', '');
          if (message != '') {
            if (message == '/clear') {
              chatField.setContent('');
              log(gold('Ваш чат был очищен.'));
              inputField.clearValue()
            }

            else {
              room.sendMessage(message);
              inputField.clearValue()
            }

            if (message != myMessages[myMessages.length - 1]) {
              myMessages.push(message);
              selectedMessage = myMessages.length
            }
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
          }

          window.render()
        })
      }

      else {
        if (room.code == 3) {
          log(tomato('Комнаты #') + tomato(process.argv[2]) + tomato(' не существует.'))
        }

        else {
          log(tomato('Необработанная ошибка:') + '\n\n' + tomato(JSON.stringify(room)) + '\n\n' + tomato('Пожалуйста, сохраните содержимое ошибки выше и создайте задачу по добавлению её обработки на https://github.com/hypersad/wschatclient.'))
        }
      }
    },
    autoLogin: true,
    loadHistory: true
  })
}
