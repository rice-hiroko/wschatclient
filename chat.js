const wsChat = require('wschatapi');
const chalk = require('chalk');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const text = chalk.white;
const evnt = chalk.bold.hex('#FFD700');
const hint = chalk.bold.hex('#808080');
const data = chalk.bold.hex('#87CEEB');

const log = console.log;

let chat = new wsChat('wss://sinair.ru/ws/chat');

chat.onOpen = function(){
  chat.joinRoom('#wschatclient-dev', (success, room) =>{

    process.stdout.write('\033c');

    room.onMessage = function(msgobj) {
      var senderColor = msgobj.color

      if (msgobj.color == 'gray') {
        var senderColor = '#808080'
      }

      if (msgobj.style == 0 && msgobj.to == 0) {
        var message = chalk.bold.hex(senderColor)(msgobj.from_login, ': ') + text(msgobj.message)
        var formattedMessage = message.replace(' :', ':')

        log(formattedMessage)
      }

      else if (msgobj.style == 1) {
        log(hint('* ') + chalk.bold.hex(senderColor)(msgobj.from_login, '') + text(msgobj.message))
      }

      else if (msgobj.style == 2) {
        log(hint("* ") + text(msgobj.message))
      }

      else if (msgobj.style == 3) {
        var message = chalk.bold.hex(senderColor)(msgobj.from_login, ': ') + hint('(( ') + chalk.hex('#808080')(msgobj.message) + hint(' ))')
        var formattedMessage = message.replace(' :', ':')
        log(formattedMessage)
      }

      else if (msgobj.to != 0) {
        var toName = room.getMemberById(msgobj.to).name
        var toColor = room.getMemberById(msgobj.to).color

        if (toColor == 'gray') {
          var toColor = '#808080'
        }

        log(hint('(лс) ') + chalk.bold.hex(senderColor)(msgobj.from_login) + hint(' > ') + chalk.hex(toColor).bold(toName) + ": " + text(msgobj.message))
      }
    };

    room.onUserConnected = function(user) {

      if (user.girl == false) {
        log(data(user.name) + evnt(' подключился к комнате'))
      }

      if (user.girl == true) {
        log(data(user.name) + evnt(' подключилась к комнате'))
      }
    };

    room.onUserDisconnected = function(user) {

      if (user.girl == false) {
        log(data(user.name) + evnt(' отключился от комнаты'))
      }

      else if (user.girl == true) {
        log(data(user.name) + evnt(' отключилась от комнаты'))
      }

    }

    room.onUserStatusChanged = function(user) {

      if (user.status == 4) {
        log(data(user.data) + evnt(' сменил никнейм на ') + data(user.name))
      }

      if (user.status == 6) {
        log(data(user.name) + evnt(' сменил ') + chalk.hex(user.color).bold('цвет'))
      }

      if (user.status == 5) {
        if (user.girl == false)
        log(data(user.name) + evnt(' сменила пол на ') + data('мужской'))

        else if (user.girl == true)
        log(data(user.name) + evnt(' сменил пол на ') + data('женский'))
      }
    }

    room.onSysMessage = function(message) {
      log(evnt(message))
    };

    rl.on('line', (input) => {
      room.sendMessage(input);
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
    });
  });
}

chat.open();
