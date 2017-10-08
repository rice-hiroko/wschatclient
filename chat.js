'use strict';

const wschat = require('wschatapi');
const chalk = require('chalk');
const blessed = require('blessed');

const config = require('./config');
const bordersColor = config.bordersColor;

const text = chalk.white;
const hint = chalk.bold.hex('#808080');
const data = chalk.bold.hex('#87CEEB');
const event = chalk.bold.hex('#FFD700');
const error = chalk.bold.hex('#FF5555');

const window = blessed.screen({ smartCSR: true, sendFocus: true });

const roomsBox = blessed.box({ label: 'Комнаты', width: '100%', height: 3, border: { type: 'line', fg: bordersColor }, style: { label: { fg: bordersColor } } });
const chatBox = blessed.box({ label: 'Чат', width: '100%-24', height: '100%-6', top: 3, right: 24, border: { type: 'line', fg: bordersColor }, style: { label: { fg: bordersColor } } });
const onlineBox = blessed.box({ label: 'В комнате', width: 24, height: '100%-6', top: 3, bottom: 3, right: 0, border: { type: 'line', fg: bordersColor }, style: { label: { fg: bordersColor } } });
const inputBox = blessed.box({ label: 'Введите сообщение:', width: '100%', height: 3, bottom: 0, border: { type: 'line', fg: bordersColor }, style: { label: { fg: bordersColor } } });

const roomsField = blessed.box({ parent: roomsBox, padding: { left: 1, right: 1 } });
const chatField = blessed.log({ parent: chatBox, scrollable: true, mouse: true, height: '100%-3', top: 0, padding: { left: 1, right: 1 } });
const typingField = blessed.box({ parent: chatBox, height: 1, bottom: 0, padding: { left: 1, right: 1} })
const onlineField = blessed.list({ parent: onlineBox, interactive: false, padding: { left: 1, right: 1 } });
const inputField = blessed.textarea({ parent: inputBox, inputOnFocus: true, padding: { left: 1, right: 1 } });

window.append(roomsBox);
window.append(chatBox);
window.append(onlineBox);
window.append(inputBox);

window.title = 'wsChatClient';

function log(text) { chatField.pushLine(text); window.render() };

inputField.key(['C-c'], () => process.exit(0));
inputField.key(['C-r'], () => { inputField.clearValue(); window.render() });

window.render();

inputField.focus();

const chat = new wschat('wss://sinair.ru/ws/chat');

chat.open();

chat.onOpen = function() {
  if ( config.APIKey != '' ) { chat.authByApiKey(config.APIKey, (success, userinfo) => {}); };

  chat.joinRoom({ target: (config.roomToJoin == '' ? '#chat' : config.roomToJoin), callback: function(success, room) {
    if (success) {
      window.title = 'wsChatClient - ' + room.getTarget();
      roomsField.setContent(chalk.bold.inverse.white(room.getTarget()));
      updateOnlineList();

      room.onMessage = function(msgobj) {
        var senderColor = msgobj.color;
        if (msgobj.color == 'gray') { var senderColor = '#808080' };

        if (msgobj.style == 0 && msgobj.to == 0) { log((chalk.bold.hex(senderColor)(msgobj.from_login, ': ') + text(msgobj.message)).replace(' :', ':')); }
        else if (msgobj.style == 1) { log(hint('* ') + chalk.bold.hex(senderColor)(msgobj.from_login, '') + text(msgobj.message)); }
        else if (msgobj.style == 2) { log(hint('* ') + text(msgobj.message)); }
        else if (msgobj.style == 3) { log((chalk.bold.hex(senderColor)(msgobj.from_login, ': ') + hint('(( ') + chalk.hex('#808080')(msgobj.message) + hint(' ))')).replace(' :', ':')); }
        else if (msgobj.to != 0) {
          var toColor = room.getMemberById(msgobj.to).color;
          if (toColor == 'gray') { var toColor = '#808080' };

          log(hint('(лс) ') + chalk.bold.hex(senderColor)(msgobj.from_login) + hint(' > ') + chalk.hex(toColor).bold(room.getMemberById(msgobj.to).name + ': ') + text(msgobj.message));
        };
      };

      room.onUserConnected = function(userobj) { userobj.girl ? log(data(userobj.name) + event(' подключилась к комнате')) : log(data(userobj.name) + event(' подключился к комнате')); updateOnlineList(); };
      room.onUserDisconnected = function(userobj) { userobj.girl ? log(data(userobj.name) + event(' отключилась от комнаты')) : log(data(userobj.name) + event(' отключился от комнаты')); updateOnlineList(); };

      room.onUserStatusChanged = function(userobj) {
        if (userobj.status == 4) { userobj.girl ? log(data(userobj.data) + event(' сменила никнейм на ') + data(userobj.name)) : log(data(userobj.data) + event(' сменил никнейм на ') + data(userobj.name)); };
        if (userobj.status == 6) { userobj.girl ? log(data(userobj.name) + event(' сменила ') + chalk.hex(userobj.color).bold('цвет')) : log(data(userobj.name) + event(' сменил ') + chalk.hex(userobj.color).bold('цвет')); };
        if (userobj.status == 5) { userobj.girl ? log(data(userobj.name) + event(' сменил пол на ') + data('женский')) : log(data(userobj.name) + event(' сменила пол на ') + data('мужской')); };
        if (userobj.status == 8 || userobj.status == 9) { updateTypingList() };
        updateOnlineList();
      };

      room.onSysMessage = function(msg) { log(event(msg)) };

      function updateOnlineList() {
        onlineField.clearItems();
        var members = room.getMembers();

        for (var i in members) {
          var obj = members[i];
          var memberColor = obj.color;
          if (obj.color == 'gray') { var memberColor = '#808080'; };

          if (obj.status == 2) { onlineField.insertItem(0, (event('* ') + chalk.bold.hex(memberColor)(obj.name))) }
          else if (obj.status == 3) { onlineField.insertItem(0, (hint('* ') + chalk.bold.hex(memberColor)(obj.name))) };
        };
        window.render();
      };

      function updateTypingList() {
        var members = room.getMembers();
        var typingMembers = [];

        for (var i in members) {
          var obj = members[i];
          if (obj.typing && obj.name != room.getMyMemberNick()) { typingMembers.push(members[i]) };
        };
        typingMembers.length > 0 ? typingField.setContent(hint(typingMembers[0].name) + hint(typingMembers.length < 2 ? ' печатает...' : ' и другие печатают...')) : typingField.setContent('');
        window.render();
      };

      window.on('focus', function() { room.changeStatus(7) });
      window.on('blur', function() { room.changeStatus(3) });

      inputField.key('enter', () => { room.sendMessage((inputField.getValue()).replace('\n', '')); inputField.clearValue(); });
    } else {
      if (room.code == 3) { log(error('Комнаты ' + room.target + ' не существует.')) }
      else { log(error('Необработанная ошибка:') + '\n\n' + error(JSON.stringify(room)) + '\n\n' + error('Пожалуйста, сохраните содержимое ошибки выше и создайте задачу по её исправлению на https://github.com/hypersad/wschatclient.'))}
  }}, autoLogin: true, loadHistory: true });
};
