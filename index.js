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

// Открываем или создаем базу данных SQLite
const db = new sqlite3.Database('./bookings.db', (err) => {
  if (err) {
    console.error("Ошибка подключения к SQLite:", err);
  } else {
    console.log("Подключение к SQLite успешно установлено.");
  }
});

// Создаем таблицу bookings с колонкой systemId
db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegramUserId TEXT NOT NULL,
    systemId TEXT,
    bookingTime TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) console.error("Ошибка создания таблицы bookings:", err);
});

// Таблица systems для систем бронирования
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

// API для создания записи (бронирования)
app.post('/api/bookings', (req, res) => {
  const { telegramUserId, systemId, bookingDate, bookingTime } = req.body;
  try {
    // Формируем дату-время записи (bookingDate в формате YYYY-MM-DD, bookingTime в формате HH:MM)
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}:00`);
    const bookingDateTimeString = bookingDateTime.toISOString();

    db.run(
      `INSERT INTO bookings (telegramUserId, systemId, bookingTime) VALUES (?, ?, ?)`,
      [telegramUserId, systemId, bookingDateTimeString],
      function(err) {
        if (err) {
          console.error("Ошибка добавления записи:", err);
          res.status(500).json({ error: "Internal server error" });
        } else {
          // Планирование уведомления за час до записи (с учетом часового пояса Екатеринбурга)
          const notificationTime = new Date(bookingDateTime.getTime() - 60 * 60 * 1000);
          const delay = notificationTime.getTime() - Date.now();
          if (delay > 0) {
            setTimeout(() => {
              bot.telegram.sendMessage(telegramUserId, `Напоминание: Ваша запись запланирована на ${bookingDateTime.toLocaleString("ru-RU", {timeZone: "Asia/Yekaterinburg"})}.`);
            }, delay);
          }
          res.status(201).json({ message: "Booking saved", booking: { id: this.lastID, telegramUserId, systemId, bookingTime: bookingDateTimeString } });
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
    `SELECT b.*, s.uniqueName as systemName FROM bookings b LEFT JOIN systems s ON b.systemId = s.id WHERE telegramUserId = ? ORDER BY bookingTime ASC`,
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

// API для поиска системы по уникальному имени
app.get('/api/systems', (req, res) => {
  const { uniqueName } = req.query;
  db.get(
    `SELECT * FROM systems WHERE uniqueName = ?`,
    [uniqueName],
    (err, row) => {
      if (err) {
        console.error("Ошибка выборки системы:", err);
        res.status(500).json({ error: "Internal server error" });
      } else if (!row) {
        res.status(404).json({ error: "System not found" });
      } else {
        res.json(row);
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

// --- Telegram Bot --- //

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// Вспомогательная функция для генерации клавиатуры выбора дней на русском
function getDaysKeyboard(selectedDays) {
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  // Для каждого дня, если выбран — добавляем галочку
  const buttons = days.map(day => {
    const text = selectedDays.includes(day) ? `✅ ${day}` : day;
    return Markup.button.callback(text, `toggle:${day}`);
  });
  // Кнопка "Готово" для завершения выбора
  buttons.push(Markup.button.callback("Готово", "done"));
  return Markup.inlineKeyboard(buttons, { columns: 3 });
}

// Создаем wizard-сцену для создания системы бронирования
const createSystemWizard = new Scenes.WizardScene('createSystemWizard',
  // Шаг 0: уникальное название системы
  async (ctx) => {
    await ctx.reply("Введите уникальное название системы (одно англ. слово):");
    return ctx.wizard.next();
  },
  // Шаг 1: выбор дней недели через кнопки
  async (ctx) => {
    // Инициализируем массив выбранных дней
    ctx.wizard.state.system = { availableDays: [] };
    await ctx.reply("Выберите дни работы системы:", getDaysKeyboard(ctx.wizard.state.system.availableDays));
    return; // Остаемся на этом шаге до получения callback
  },
  // Шаг 1 callback обработчик для выбора дней
  async (ctx) => {
    if (ctx.callbackQuery) {
      const data = ctx.callbackQuery.data;
      if (data.startsWith("toggle:")) {
        const day = data.split(":")[1];
        const sel = ctx.wizard.state.system.availableDays;
        if (sel.includes(day)) {
          // Убираем день, если он уже выбран
          ctx.wizard.state.system.availableDays = sel.filter(d => d !== day);
        } else {
          ctx.wizard.state.system.availableDays.push(day);
        }
        // Обновляем клавиатуру
        await ctx.editMessageReplyMarkup(getDaysKeyboard(ctx.wizard.state.system.availableDays).reply_markup);
        return; // Остаемся на шаге
      } else if (data === "done") {
        if (ctx.wizard.state.system.availableDays.length === 0) {
          await ctx.answerCbQuery("Выберите хотя бы один день");
          return;
        }
        await ctx.answerCbQuery("Дни выбраны");
        await ctx.reply(`Выбраны дни: ${ctx.wizard.state.system.availableDays.join(", ")}`);
        return ctx.wizard.next();
      }
    }
  },
  // Шаг 2: Ввод времени работы (диапазон)
  async (ctx) => {
    // Сохраняем уникальное название, введенное на шаге 0
    if (!ctx.wizard.state.system.uniqueName) {
      ctx.wizard.state.system.uniqueName = ctx.message.text;
    }
    await ctx.reply("Введите время начала и окончания записи в формате HH:MM-HH:MM (например: 10:00-18:00):");
    return ctx.wizard.next();
  },
  // Шаг 3: Сохранение системы
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
    const { uniqueName, availableDays, startTime: st, endTime: et } = ctx.wizard.state.system;
    const telegramUserId = String(ctx.from.id);
    const createdAt = new Date().toISOString();
    db.run(
      `INSERT INTO systems (telegramUserId, uniqueName, availableDays, startTime, endTime, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [telegramUserId, uniqueName, availableDays.join(','), st, et, createdAt],
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

// При старте бота отправляем сообщение с двумя кнопками
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

// Обработка кнопки создания системы
bot.action('create_system', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.enter('createSystemWizard');
});

// Обработка кнопки записи – отправляем ссылку на сайт
bot.action('book', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.reply("Для записи перейдите по ссылке: https://vitalykazantsev.me");
