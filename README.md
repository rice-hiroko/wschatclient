# wsChatClient
Простой клиент для [чата на веб-сокетах](https://sinair.ru/chat)

## Загрузка, установка и запуск
Загрузка:

```
git clone https://github.com/hypersad/wsChatClient`
cd wsChatClient
```

Установка зависимостей:

`npm install`

Запуск:

`node chat.js`

Для выбора комнаты для подключения при запуске, замените #chat в 40 строке на любую желаемую комнату (с указанием #)

## Описание

Поддерживает:
* Получение сообщений
* Обработка всех типов сообщений
* Обработка практически всех событий
* Обработка системных сообщений
* Отправка сообщений
* Отображение пользователей в комнате
* Отображение активной комнаты

Планируется поддержка:
* Возможность подключения к комнатам
* Переключение между несколькими комнатами
* Обработка цитат
* Авторизация с помощью API-ключа
* Отображение статуса пользователей в списке
* Возможность конфигурации чата через соответствующий файл
