const express = require(`express`);
const app = express();
const morgan = require("morgan");
const dotenv = require("dotenv").config();
const port = process.env.PORT || 4080;
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');

const certDir = `/etc/letsencrypt/live`;
const domain = `vitalykazantsev.me`;

app.use(morgan("dev"));

app.use(express.static(`public`));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("WELCOME TO THE BASIC EXPRESS APP WITH AN HTTPS SERVER");
});

const options = {
  key: fs.readFileSync(`${certDir}/${domain}/privkey.pem`),
  cert: fs.readFileSync(`${certDir}/${domain}/fullchain.pem`)
};

const server = https.createServer(options, app);
const serverHttp = http.createServer(app)

serverHttp.listen(4081, () => {});

server.listen(4080, () => {
  console.log(`App listening on https://localhost:${port}`);
});

/*let mongoose = require('mongoose');
mongoose.connect('mongodb://91.108.243.98:27017/tgweb');


let usersSchema = new mongoose.Schema({
    userid: String,
    theme: String,
    name: String
});

let User = mongoose.model('users', usersSchema);
*/