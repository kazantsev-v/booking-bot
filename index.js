const express = require(`express`);
const app = express();
const morgan = require("morgan");
const dotenv = require("dotenv").config();
const port = process.env.PORT || 4080;
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const {Telegraf, Markup } = require('telegraf');

const certDir = `/etc/letsencrypt/live`;
const domain = `vitalykazantsev.me`;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const bot = new Telegraf(TELEGRAM_BOT_TOKEN, {
    polling: {
        autoStart: true
    }
});

bot.start(async (ctx) => {
    ctx.reply("Добро пожаловать!")
});

app.use(morgan("dev"));

app.use(express.static(`public`));

app.use(express.json())


app.get("/", (req, res) => {
  res.send("WELCOME TO THE BASIC EXPRESS APP WITH AN HTTPS SERVER");
});

const options = {
  key: fs.readFileSync(`${certDir}/${domain}/privkey.pem`),
  cert: fs.readFileSync(`${certDir}/${domain}/fullchain.pem`)
};

const server = https.createServer(options, app);
const serverHttp = http.createServer(app)

serverHttp.listen(4081, () => {
    console.log(`HTTP server listening on port 4081`);
  }).on('error', (err) => {
    console.error('HTTP server error:', err);
  });
  
  server.listen(4080, () => {
    console.log(`HTTPS server listening on port 4080`);
  }).on('error', (err) => {
    console.error('HTTPS server error:', err);
  });;
  
bot.launch();

// Остановка сервера и бота при завершении работы
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 

/*let mongoose = require('mongoose');
mongoose.connect('mongodb://91.108.243.98:27017/tgweb');


let usersSchema = new mongoose.Schema({
    userid: String,
    theme: String,
    name: String
});

let User = mongoose.model('users', usersSchema);
*/