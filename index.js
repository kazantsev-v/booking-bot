// index.js
const express = require('express');
const app = express();
const morgan = require("morgan");
const dotenv = require("dotenv").config();
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const sqlite3 = require('sqlite3').verbose();
const { Telegraf, Markup, Scenes, session } = require('telegraf');

const port = process.env.PORT || 4080;
const certDir = `/etc/letsencrypt/live`;
const domain = `vitalykazantsev.me`;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Настройка Express
app.use(morgan("dev"));
app.use(express.static(`public`));
app.use(express.json());

// Создаем или открываем базу данных SQLite
const db = new sqlite3.Database('./bookings.db', (err) => {
  if (err) {
    console.error("Ошибка подключения к SQLite:", err);
  } else {
    console.log("Подключение к SQLite успешно установлено.");
  }
});

// Создаем таблицу bookings, если её ещё нет
db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegramUserId TEXT NOT NULL,
    bookingTime TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error("Ошибка создания таблицы bookings:", err);
});

// Создаем таблицу systems для хранения информации о системах бронирования
db.run(`CREATE TABLE IF NOT EXISTS systems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegramUserId TEXT NOT NULL,
    uniqueName TEXT NOT NULL,
    availableDays TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error("Ошибка создания таблицы systems:", err);
});

// Express API для создания брони (записи)
app.post('/api/bookings', (req, res) => {
  const { telegramUserId, bookingDate, bookingTime } = req.body;
  try {
    // Формируем дату-время записи (bookingDate в формате YYYY-MM-DD, bookingTime в формате HH:MM)
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}:00`);
    const bookingDateTimeString = bookingDateTime.toISOString();

    db.run(
      `INSERT INTO bookings (telegramUserId, bookingTime) VALUES (?, ?)`,
      [telegramUserId, bookingDateTimeString],
      function(err) {
        if (err) {
          console.error("Ошибка добавления записи:", err);
          res.status(500).json({ error: "Internal server error" });
        } else {
          // Планирование уведомления за час до записи
          const notificationTime = new Date(bookingDateTime.getTime() - 60 * 60 * 1000);
          const delay = notificationTime.getTime() - Date.now();
          if (delay > 0) {
            setTimeout(() => {
              bot.telegram.sendMessage(telegramUserId, `Напоминание: Ваша запись запланирована на ${bookingDateTime.toLocaleString("ru-RU", {timeZone: "Asia/Yekaterinburg"})}.`);
            }, delay);
          }
          res.status(201).json({ message: "Booking saved", booking: { id: this.lastID, telegramUserId, bookingTime: bookingDateTimeString } });
        }
      }
    );
  } catch (error) {
    console.error("Ошибка сохранения записи:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Express API для получения записей по пользователю
app.get('/api/bookings', (req, res) => {
  const { telegramUserId } = req.query;
  db.all(
    `SELECT * FROM bookings WHERE telegramUserId = ? ORDER BY bookingTime ASC`,
    [telegramUserId],
    (err, rows) => {
      if (err) {
        console.error("Ошибка выборки записей:", err);
        res.status(500).json({ error: "Internal server error" });
      } else {
        res.json(rows);
      }
    }
  );
});

// Главная страница
app.get("/", (req, res) => {
  res.send("WELCOME TO THE BASIC EXPRESS APP WITH AN HTTPS SERVER");
});

// Настройка HTTPS-сервера
const options = {
  key: fs.readFileSync(`${certDir}/${domain}/privkey.pem`),
  cert: fs.readFileSync(`${certDir}/${domain}/fullchain.pem`)
};
const server = https.createServer(options, app);
const serverHttp = http.createServer(app);

serverHttp.listen(4081, () => {
  console.log(`HTTP сервер слушает порт 4081`);
}).on('error', (err) => {
  console.error('HTTP сервер ошибка:', err);
});
  
server.listen(443, () => {
  console.log(`HTTPS сервер слушает порт 4080`);
}).on('error', (err) => {
  console.error('HTTPS сервер ошибка:', err);
});

// --- Telegram Bot с использованием сцен --- //

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// Создаем wizard сцену для создания системы бронирования
const createSystemWizard = new Scenes.WizardScene('createSystemWizard',
  async (ctx) => {
    await ctx.reply("Введите уникальное название системы (одно англ. слово):");
    return ctx.wizard.next();
  },
  async (ctx) => {
    const uniqueName = ctx.message.text;
    ctx.wizard.state.system = { uniqueName };
    await ctx.reply("Введите доступные дни записи в формате, например: Mon,Tue,Wed");
    return ctx.wizard.next();
  },
  async (ctx) => {
    const daysText = ctx.message.text;
    const availableDays = daysText.split(',').map(day => day.trim());
    ctx.wizard.state.system.availableDays = availableDays;
    await ctx.reply("Введите время начала и окончания записи в формате HH:MM-HH:MM (например: 10:00-18:00):");
    return ctx.wizard.next();
  },
  async (ctx) => {
    const periodText = ctx.message.text;
    const parts = periodText.split('-');
    if (parts.length !== 2) {
      await ctx.reply("Неверный формат. Введите время в формате HH:MM-HH:MM:");
      return;
    }
    const startTime = parts[0].trim();
    const endTime = parts[1].trim();
    ctx.wizard.state.system.startTime = startTime;
    ctx.wizard.state.system.endTime = endTime;

    // Сохраняем систему в базе данных
    const { uniqueName, availableDays } = ctx.wizard.state.system;
    const telegramUserId = String(ctx.from.id);
    const createdAt = new Date().toISOString();
    db.run(
      `INSERT INTO systems (telegramUserId, uniqueName, availableDays, startTime, endTime, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [telegramUserId, uniqueName, availableDays.join(','), startTime, endTime, createdAt],
      function(err) {
        if (err) {
          console.error("Ошибка сохранения системы:", err);
          ctx.reply("Ошибка при создании системы. Попробуйте ещё раз.");
        } else {
          ctx.reply(`Система "${uniqueName}" успешно создана! Теперь вы можете управлять записями (просмотр, удаление и т.д.).`);
        }
      }
    );
    return ctx.scene.leave();
  }
);

// Регистрируем сцену
const stage = new Scenes.Stage([createSystemWizard]);
bot.use(session());
bot.use(stage.middleware());

// Команда /start – отправка приветственного сообщения с кнопками
bot.start(async (ctx) => {
  const buttons = Markup.inlineKeyboard([
    Markup.button.callback('Записаться', 'book'),
    Markup.button.callback('Создать систему', 'create_system')
  ]);
  await ctx.reply(
    "Добро пожаловать!\n\n" +
    "Если вы хотите записаться – нажмите «Записаться».\n" +
    "Если хотите создать систему управления бронированиями – нажмите «Создать систему».",
    buttons
  );
});

// Обработка нажатия кнопок
bot.action('create_system', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.enter('createSystemWizard');
});

bot.action('book', async (ctx) => {
  await ctx.answerCbQuery();
  // Отправляем ссылку на сайт для записи (можно добавить query-параметры, если нужно)
  ctx.reply("Для записи перейдите по ссылке: https://vitalykazantsev.me");
});

bot.launch();

// Остановка бота при завершении работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
