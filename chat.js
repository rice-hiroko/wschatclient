const wschat = require('wschatapi');
const chalk = require('chalk');
const blessed = require('blessed');

const config = require('./config');

const text = chalk.white;
const event = chalk.bold.hex('#FFD700');
const hint = chalk.bold.hex('#808080');
const data = chalk.bold.hex('#87CEEB');

const window = blessed.screen({ smartCSR: true });

const userAPIKey = config.userAPIKey
const borderColor = config.bordersColor

const roomsBox = blessed.box({ label: 'Комнаты', width: '100%', height: 3, border: { type: 'line', fg: borderColor }, style: { label: { fg: borderColor } } });
const chatBox = blessed.box({ label: 'Чат', width: '100%-24', height: '100%-6', top: 3, right: 24, border: { type: 'line', fg: borderColor }, style: { label: { fg: borderColor } } });
const onlineBox = blessed.box({ label: 'В комнате', width: 24, height: '100%-6', top: 3, bottom: 3, right: 0, border: { type: 'line', fg: borderColor }, style: { label: { fg: borderColor } } });
const inputBox = blessed.box({ label: 'Введите сообщение:', width: '100%', height: 3, bottom: 0, border: { type: 'line', fg: borderColor }, style: { label: { fg: borderColor } } });

const roomsField = blessed.list({ parent: roomsBox, interactive: false, padding: { left: 1, right: 1 } });
const chatField = blessed.log({ parent: chatBox, scrollable: true, mouse: true, padding: { left: 1, right: 1 } });
const onlineField = blessed.list({ parent: onlineBox, interactive: false, padding: { left: 1, right: 1 } });
const inputField = blessed.textarea({ parent: inputBox, inputOnFocus: true, padding: { left: 1, right: 1 } });

window.append(roomsBox);
window.append(chatBox);
window.append(onlineBox);
window.append(inputBox);

window.title = 'wsChatClient';

function log(text) { chatField.pushLine(text); window.render() };

inputField.key(['C-c'], () => process.exit(0));

window.render();

inputField.focus();

let chat = new wschat('wss://sinair.ru/ws/chat');

chat.open();

chat.onOpen = function() {
  if ( userAPIKey != '' ) { chat.authByApiKey(userAPIKey, (success, userinfo) => {}); };

  chat.joinRoom({ target: '#chat', callback: function(success, room){

    updateOnlineList();

    roomsField.insertItem(0, chalk.bold.inverse.white(room.getTarget()));
    window.title = 'wsChatClient - ' + room.getTarget();

    room.onMessage = function(msgobj) {
      var senderColor = msgobj.color;

      if (msgobj.color == 'gray') { var senderColor = '#808080' };

      if (msgobj.style == 0 && msgobj.to == 0) {
        var message = chalk.bold.hex(senderColor)(msgobj.from_login, ': ') + text(msgobj.message);
        var fMessage = message.replace(' :', ':');

        log(fMessage);
      }

      else if (msgobj.style == 1) { log(hint('* ') + chalk.bold.hex(senderColor)(msgobj.from_login, '') + text(msgobj.message)); }

      else if (msgobj.style == 2) { log(hint("* ") + text(msgobj.message)); }

      else if (msgobj.style == 3) {
        var message = chalk.bold.hex(senderColor)(msgobj.from_login, ': ') + hint('(( ') + chalk.hex('#808080')(msgobj.message) + hint(' ))');
        var fMessage = message.replace(' :', ':');

        log(fMessage);
      }

      else if (msgobj.to != 0) {
        var toName = room.getMemberById(msgobj.to).name;
        var toColor = room.getMemberById(msgobj.to).color;

        if (toColor == 'gray') { var toColor = '#808080' };

        log(hint('(лс) ') + chalk.bold.hex(senderColor)(msgobj.from_login) + hint(' > ') + chalk.hex(toColor).bold(toName + ': ') + text(msgobj.message));
      };
    };

    room.onUserConnected = function(user) {
      if (user.girl == false) { log(data(user.name) + event(' подключился к комнате')) }
      else if (user.girl == true) { log(data(user.name) + event(' подключилась к комнате')) };
      updateOnlineList();
    };

    room.onUserDisconnected = function(user) {
      if (user.girl == false) { log(data(user.name) + event(' отключился от комнаты')) }
      else if (user.girl == true) { log(data(user.name) + event(' отключилась от комнаты')) };
      updateOnlineList();
    };

    room.onUserStatusChanged = function(user) {
      if (user.status == 4) { log(data(user.data) + event(' сменил никнейм на ') + data(user.name)) };
      if (user.status == 6) { log(data(user.name) + event(' сменил ') + chalk.hex(user.color).bold('цвет')) };
      if (user.status == 5) {
        if (user.girl == false) { log(data(user.name) + event(' сменила пол на ') + data('мужской')) }
        else if (user.girl == true) { log(data(user.name) + event(' сменил пол на ') + data('женский')) };
      };
      updateOnlineList();
    };

    room.onSysMessage = function(message) { log(event(message)) };

    room.onJoined = function() { updateOnlineList(); };
    room.onLeave = function() { updateOnlineList(); };

    function updateOnlineList() {
      onlineField.clearItems();
      var members = room.getMembers();

      for (var i in members) {
        var obj = members[i];
        var memberColor = obj.color;

        if (obj.color == 'gray') { var memberColor = '#808080'; };

        if (obj.status == 2) {
          var member = event('* ') + chalk.bold.hex(memberColor)(obj.name);
          onlineField.insertItem(0, member);
        }

        else if (obj.status == 3) {
        var member = hint('* ') + chalk.bold.hex(memberColor)(obj.name);
        onlineField.insertItem(0, member);
        };
      };
      window.render();
    };

    inputField.key('enter', () => {
      var message = inputField.getValue();
      var fMessage = message.replace('\n', '');
      room.sendMessage(fMessage);
      inputField.clearValue();
    });
  }, autoLogin: true, loadHistory: true });
};
