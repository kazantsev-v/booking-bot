// index.js
const express = require('express');
const app = express();
const morgan = require("morgan");
const dotenv = require("dotenv").config();
const port = process.env.PORT || 4080;
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const sqlite3 = require('sqlite3').verbose();
const { Telegraf } = require('telegraf');
const certDir = `/etc/letsencrypt/live`;
const domain = `vitalykazantsev.me`;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const bot = new Telegraf(TELEGRAM_BOT_TOKEN, {
  polling: {
    autoStart: true
  }
});

bot.start(async (ctx) => {
  ctx.reply("Добро пожаловать!");
});

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

// Создаем таблицу bookings (с полем bookingSystemId для связи с системой бронирования)
db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegramUserId TEXT NOT NULL,
    bookingTime TEXT NOT NULL,
    bookingSystemId INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err) {
      console.error("Ошибка создания таблицы bookings:", err);
    }
});

// Создаем таблицу booking_systems для хранения систем бронирования
db.run(`CREATE TABLE IF NOT EXISTS booking_systems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    availableDays TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err) {
      console.error("Ошибка создания таблицы booking_systems:", err);
    }
});

// Главная страница
app.get("/", (req, res) => {
  res.send("WELCOME TO THE BASIC EXPRESS APP WITH AN HTTPS SERVER");
});

// API для создания системы бронирования
app.post('/api/booking-systems', (req, res) => {
  const { name, availableDays, startTime, endTime } = req.body;
  // Преобразуем availableDays (массив) в строку, например "1,2,3"
  const availableDaysStr = Array.isArray(availableDays) ? availableDays.join(',') : availableDays;
  db.run(
    `INSERT INTO booking_systems (name, availableDays, startTime, endTime) VALUES (?, ?, ?, ?)`,
    [name, availableDaysStr, startTime, endTime],
    function(err) {
      if (err) {
        console.error("Ошибка создания системы бронирования:", err);
        res.status(500).json({ error: "Internal server error" });
      } else {
        res.status(201).json({ 
          message: "Система бронирования создана", 
          system: { id: this.lastID, name, availableDays: availableDaysStr, startTime, endTime } 
        });
      }
    }
  );
});

// API для получения систем бронирования (с поиском по названию)
app.get('/api/booking-systems', (req, res) => {
  const { q } = req.query;
  let sql = "SELECT * FROM booking_systems";
  let params = [];
  if (q) {
    sql += " WHERE name LIKE ?";
    params.push(`%${q}%`);
  }
  sql += " ORDER BY createdAt DESC";
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Ошибка получения систем бронирования:", err);
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.json(rows);
    }
  });
});

// API для создания записи
app.post('/api/bookings', (req, res) => {
  const { telegramUserId, bookingDate, bookingTime, bookingSystemId } = req.body;
  try {
    // Формируем дату-время записи (bookingDate в формате YYYY-MM-DD, bookingTime в формате HH:MM)
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}:00`);
    const bookingDateTimeString = bookingDateTime.toISOString();
    
    // Вставляем запись в таблицу bookings, учитывая bookingSystemId
    db.run(
      `INSERT INTO bookings (telegramUserId, bookingTime, bookingSystemId) VALUES (?, ?, ?)`,
      [telegramUserId, bookingDateTimeString, bookingSystemId],
      function(err) {
        if (err) {
          console.error("Ошибка добавления записи:", err);
          res.status(500).json({ error: "Internal server error" });
        } else {
          const insertedId = this.lastID;
          // Планирование уведомления: за час до записи
          const notificationTime = new Date(bookingDateTime.getTime() - 60 * 60 * 1000);
          const delay = notificationTime.getTime() - Date.now();
          if (delay > 0) {
            setTimeout(() => {
              bot.telegram.sendMessage(telegramUserId, `Напоминание: Ваша запись запланирована на ${bookingDateTime.toLocaleString()}.`);
            }, delay);
          }
          res.status(201).json({ 
            message: "Booking saved", 
            booking: { id: insertedId, telegramUserId, bookingTime: bookingDateTimeString, bookingSystemId } 
          });
        }
      }
    );
  } catch (error) {
    console.error("Ошибка сохранения записи:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API для получения записей по пользователю
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

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
