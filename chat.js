// Подключение требуемых модулей
const wsChat = require('wschatapi');
const chalk = require('chalk');
const readline = require('readline');

// Создание интерфейса ввода и вывода
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Функция для очистки терминала при загрузке чата
console.clear = function () {
  return process.stdout.write('\033c');
}
// Декларация цветовых констант
const smsg = chalk.bold.yellow;
const msg = chalk.white;
const hint = chalk.bold.hex("#808080");
const prm = chalk.bold.cyan;

// Создание подключения
let chat = new wsChat('wss://sinair.ru/ws/chat');

chat.onOpen = function(){

  // Подключение к комнате
  chat.joinRoom('#chat', (success, room) =>{

    // Предварительная очистка окна терминала
    console.clear()

    // Обработчик получаемых сообщений
    room.onMessage = function(msgobj) {

      // Запись значения цвета никнейма отправителя в переменную
      var senderColor = msgobj.color

      // Замена цвета никнейма, если тот имеет цвет gray (т.е. не HEX)
      if (msgobj.color == 'gray') {
        var senderColor = '#808080'
      }

      // Обработка обычных сообщений
      if (msgobj.style == 0 && msgobj.to == 0) {
        var message = chalk.bold.hex(senderColor)(msgobj.from_login, ": ") + msg(msgobj.message)
        var formattedMessage = message.replace(" ", "")
        console.log(formattedMessage)
      }

      // Обработка сообщений-действий от своего лица
      else if (msgobj.style == 1) {
        console.log(hint("* ") + chalk.bold.hex(senderColor)(msgobj.from_login, "") + msg(msgobj.message))
      }

      // Обработка сообщений от третьего лица
      else if (msgobj.style == 2) {
        console.log(hint("* ") + msg(msgobj.message))
      }

      // Обработка оффтоп-сообщений
      else if (msgobj.style == 3) {
        var message = chalk.bold.hex(senderColor)(msgobj.from_login, ": ") + hint("(( " + msgobj.message + " ))")
        var formattedMessage = message.replace(" ", "")
        console.log(formattedMessage)
      }

      // Обработка личных сообщений
      else if (msgobj.to != 0) {
        var toName = room.getMemberById(msgobj.to).name
        var toColor = room.getMemberById(msgobj.to).color

        if (toColor == 'gray') {
          var toColor = '#808080'
        }
        
        console.log(hint('(лс) ') + chalk.bold.hex(senderColor)(msgobj.from_login) + hint(' > ') + chalk.hex(toColor).bold(toName) + ": " + msg(msgobj.message))
      }
    };

    // Обработчик подключения пользователей
    room.onUserConnected = function(user) {

      // Обработка сообщений о подключении обычного пользователя
      if (user.girl == false) {
        console.log(prm(user.name) + smsg(" подключился к комнате"))
      }

      // Обработка сообщений о подключении пользователя с группой Girls
      if (user.girl == true) {
        console.log(prm(user.name) + smsg(" подключилась к комнате"))
      }
    };

    // Обработчик отключения пользователей
    room.onUserDisconnected = function(user) {

      // Обработка сообщений об отключении обычного пользователя
      if (user.girl == false) {
        console.log(prm(user.name) + smsg(" отключился от комнаты"))
      }

      // Обработка сообщений об отключении пользователя с группой Girls
      else if (user.girl == true) {
        console.log(prm(user.name) + smsg(" отключилась от комнаты"))
      }

    }

    // Обработчик статусов пользователей
    room.onUserStatusChanged = function(user) {

      // Обработка сообщений о смене никнейма
      if (user.status == 4) {
        console.log(prm(user.data) + smsg(" сменил никнейм на ") + chalk.cyan.bold(user.name))
      }

      // Обработка сообщений о смене цвета никнейма
      if (user.status == 6) {
        console.log(prm(user.name) + smsg(" сменил ") + chalk.hex(user.color).bold("цвет"))
      }

      // Обработка сообщений о смене пола
      if (user.status == 5) {
        if (user.girl == false)
        console.log(prm(user.name) + smsg(" сменила пол на ") + prm("мужской"))

        else if (user.girl == true)
        console.log(prm(user.name) + smsg(" сменил пол на ") + prm("женский"))
      }
    }

    // Обработчик системных сообщений
    room.onSysMessage = function(message) {

      // Обработка системных сообщений
      console.log(smsg(message))
    };

    // Функция отправления сообщений и очистки введенного текста
    rl.on('line', (line) => {
      room.sendMessage(line);
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
    });
  });
}

// Открытие окна чата
chat.open();
