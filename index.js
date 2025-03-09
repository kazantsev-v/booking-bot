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
const certDir = '/etc/letsencrypt/live';
const domain = 'vitalykazantsev.me';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const bot = new Telegraf(TELEGRAM_BOT_TOKEN, {
  polling: {
    autoStart: true
  }
});

bot.start(async (ctx) => {
  ctx.reply("Добро пожаловать! Вы можете создать свою систему бронирования или воспользоваться существующими.");
  ctx.reply("Используйте /create для создания новой системы бронирования.");
});

bot.command('create', (ctx) => {
  ctx.reply("Чтобы создать систему бронирования, введите команду в формате:\n/new [название] [дни работы через запятую] [время начала]-[время окончания]\n\nПример: /new Парикмахерская пн,вт,ср,чт,пт 09:00-18:00");
});

bot.command('new', async (ctx) => {
  try {
    const text = ctx.message.text;
    const parts = text.split(' ');
    
    if (parts.length < 4) {
      return ctx.reply("Неверный формат. Используйте: /new [название] [дни работы] [время работы]");
    }
    
    const name = parts[1];
    const workDays = parts[2];
    const workHours = parts[3];
    
    const creatorId = ctx.from.id;
    
    // Сохраняем систему бронирования в БД
    db.run(
      `INSERT INTO booking_systems (name, creator_id, work_days, work_hours) VALUES (?, ?, ?, ?)`,
      [name, creatorId, workDays, workHours],
      function(err) {
        if (err) {
          console.error("Ошибка создания системы бронирования:", err);
          return ctx.reply("Произошла ошибка при создании системы бронирования.");
        }
        
        ctx.reply(`Система бронирования "${name}" успешно создана! ID: ${this.lastID}`);
      }
    );
  } catch (error) {
    console.error("Ошибка создания системы:", error);
    ctx.reply("Произошла ошибка при обработке команды.");
  }
});

app.use(morgan("dev"));
app.use(express.static('public'));
app.use(express.json());

// Создаем или открываем базу данных SQLite
const db = new sqlite3.Database('./bookings.db', (err) => {
  if (err) {
    console.error("Ошибка подключения к SQLite:", err);
  } else {
    console.log("Подключение к SQLite успешно установлено.");
    // Инициализируем структуру БД
    initializeDatabase();
    // Запускаем очистку просроченных записей
    setupAutoCleanup();
  }
});

// Инициализация таблиц базы данных
function initializeDatabase() {
  // Таблица бронирований
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system_id INTEGER NOT NULL,
    telegramUserId TEXT NOT NULL,
    bookingTime TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (system_id) REFERENCES booking_systems(id)
  )`, (err) => {
    if (err) {
      console.error("Ошибка создания таблицы bookings:", err);
    }
  });
  
  // Таблица систем бронирования
  db.run(`CREATE TABLE IF NOT EXISTS booking_systems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    creator_id TEXT NOT NULL,
    work_days TEXT NOT NULL,
    work_hours TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error("Ошибка создания таблицы booking_systems:", err);
    }
  });
}

// Настройка автоматической очистки просроченных записей
function setupAutoCleanup() {
  // Выполняем первую очистку сразу
  cleanupExpiredBookings();
  
  // Затем настраиваем выполнение каждый час
  setInterval(cleanupExpiredBookings, 3600000); // 1 час в миллисекундах
}

// Функция для очистки просроченных записей
function cleanupExpiredBookings() {
  const now = new Date().toISOString();
  
  db.run(
    `DELETE FROM bookings WHERE bookingTime < ?`,
    [now],
    function(err) {
      if (err) {
        console.error("Ошибка при удалении просроченных записей:", err);
      } else {
        console.log(`Очистка просроченных записей: удалено ${this.changes} записей`);
      }
    }
  );
}

// Главная страница
app.get("/", (req, res) => {
  res.send("WELCOME TO THE BOOKING SYSTEM APP");
});

// API для создания системы бронирования (для работы в mini app)
app.post('/api/booking-systems', (req, res) => {
  const { name, creatorId, workDays, workHours } = req.body;
  
  if (!name || !creatorId || !workDays || !workHours) {
    return res.status(400).json({ error: "Не все обязательные поля заполнены" });
  }
  
  db.run(
    `INSERT INTO booking_systems (name, creator_id, work_days, work_hours) VALUES (?, ?, ?, ?)`,
    [name, creatorId, workDays, workHours],
    function(err) {
      if (err) {
        console.error("Ошибка создания системы бронирования:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
      
      res.status(201).json({ 
        message: "Система бронирования успешно создана", 
        system: { 
          id: this.lastID, 
          name, 
          creator_id: creatorId,
          work_days: workDays,
          work_hours: workHours 
        } 
      });
    }
  );
});

// API для получения списка систем бронирования
app.get('/api/booking-systems', (req, res) => {
  const { search } = req.query;
  let query = `SELECT * FROM booking_systems`;
  let params = [];
  
  if (search) {
    query += ` WHERE name LIKE ?`;
    params.push(`%${search}%`);
  }
  
  query += ` ORDER BY created_at DESC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error("Ошибка получения систем бронирования:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json(rows);
  });
});

// API для получения информации о системе бронирования
app.get('/api/booking-systems/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT * FROM booking_systems WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error("Ошибка получения системы бронирования:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
    
    if (!row) {
      return res.status(404).json({ error: "Система бронирования не найдена" });
    }
    
    res.json(row);
  });
});

// API для проверки доступности временного слота
app.get('/api/bookings/availability', (req, res) => {
  const { systemId, date, time } = req.query;
  
  if (!systemId || !date || !time) {
    return res.status(400).json({ error: "Не все параметры указаны" });
  }
  
  // Формируем полную дату-время для проверки
  const bookingDateTime = new Date(`${date}T${time}:00`);
  const bookingDateTimeString = bookingDateTime.toISOString();
  
  // Проверяем, есть ли уже запись на это время
  db.get(
    `SELECT id FROM bookings WHERE system_id = ? AND bookingTime = ?`,
    [systemId, bookingDateTimeString],
    (err, row) => {
      if (err) {
        console.error("Ошибка проверки доступности:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
      
      // Если запись найдена - время занято
      const available = !row;
      res.json({ available });
    }
  );
});

// API для создания записи
app.post('/api/bookings', (req, res) => {
  const { telegramUserId, systemId, bookingDate, bookingTime } = req.body;
  
  if (!telegramUserId || !systemId || !bookingDate || !bookingTime) {
    return res.status(400).json({ error: "Не все обязательные поля заполнены" });
  }
  
  try {
    // Формируем дату-время записи
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}:00`);
    const bookingDateTimeString = bookingDateTime.toISOString();
    
    // Сначала проверяем, не занято ли это время
    db.get(
      `SELECT id FROM bookings WHERE system_id = ? AND bookingTime = ?`,
      [systemId, bookingDateTimeString],
      (err, row) => {
        if (err) {
          console.error("Ошибка проверки доступности:", err);
          return res.status(500).json({ error: "Internal server error" });
        }
        
        // Если запись найдена - время занято
        if (row) {
          return res.status(400).json({ error: "time_slot_not_available" });
        }
        
        // Вставляем запись в таблицу SQLite
        db.run(
          `INSERT INTO bookings (telegramUserId, system_id, bookingTime) VALUES (?, ?, ?)`,
          [telegramUserId, systemId, bookingDateTimeString],
          function(err) {
            if (err) {
              console.error("Ошибка добавления записи:", err);
              return res.status(500).json({ error: "Internal server error" });
            }
            
            const insertedId = this.lastID;
            
            // Планирование уведомления: за час до записи
            const notificationTime = new Date(bookingDateTime.getTime() - 60 * 60 * 1000);
            const delay = notificationTime.getTime() - Date.now();
            
            if (delay > 0) {
              setTimeout(() => {
                db.get(`SELECT name FROM booking_systems WHERE id = ?`, [systemId], (err, row) => {
                  if (!err && row) {
                    bot.telegram.sendMessage(
                      telegramUserId, 
                      `Напоминание: Ваша запись в "${row.name}" запланирована на ${bookingDateTime.toLocaleString()}.`
                    );
                  }
                });
              }, delay);
            }
            
            res.status(201).json({ 
              message: "Booking saved", 
              booking: { 
                id: insertedId, 
                telegramUserId, 
                systemId,
                bookingTime: bookingDateTimeString 
              } 
            });
          }
        );
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
  
  if (!telegramUserId) {
    return res.status(400).json({ error: "Не указан telegramUserId" });
  }
  
  db.all(
    `SELECT b.*, bs.name as systemName 
     FROM bookings b
     LEFT JOIN booking_systems bs ON b.system_id = bs.id
     WHERE b.telegramUserId = ? 
     ORDER BY b.bookingTime ASC`,
    [telegramUserId],
    (err, rows) => {
      if (err) {
        console.error("Ошибка выборки записей:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json(rows);
    }
  );
});

// API для отмены записи
app.delete('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  const { telegramUserId } = req.query;
  
  if (!telegramUserId) {
    return res.status(400).json({ error: "Не указан telegramUserId" });
  }
  
  // Проверяем, принадлежит ли запись этому пользователю
  db.get(
    `SELECT system_id, bookingTime FROM bookings WHERE id = ? AND telegramUserId = ?`,
    [id, telegramUserId],
    (err, row) => {
      if (err) {
        console.error("Ошибка проверки записи:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
      
      if (!row) {
        return res.status(404).json({ error: "Запись не найдена или не принадлежит этому пользователю" });
      }
      
      // Получаем информацию о системе для уведомления
      db.get(`SELECT name FROM booking_systems WHERE id = ?`, [row.system_id], (err, systemRow) => {
        if (err) {
          console.error("Ошибка получения информации о системе:", err);
        }
        
        // Удаляем запись
        db.run(
          `DELETE FROM bookings WHERE id = ?`,
          [id],
          function(err) {
            if (err) {
              console.error("Ошибка удаления записи:", err);
              return res.status(500).json({ error: "Internal server error" });
            }
            
            // Отправляем уведомление пользователю
            if (systemRow) {
              const bookingTime = new Date(row.bookingTime);
              bot.telegram.sendMessage(
                telegramUserId,
                `Ваша запись в "${systemRow.name}" на ${bookingTime.toLocaleString()} была отменена.`
              );
            }
            
            res.json({ 
              message: "Запись успешно отменена",
              deleted: true
            });
          }
        );
      });
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
  console.log(`HTTPS сервер слушает порт 443`);
}).on('error', (err) => {
  console.error('HTTPS сервер ошибка:', err);
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));