require('dotenv').config();
const express = require('express');
const app = express();
let port = process.env.PORT || 3000;
const ejs = require('ejs');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const userSchema = require('./schema/userSchema');
const newsListSchema = require('./schema/newsListSchema');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4, v4 } = require('uuid');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const { get } = require('http');

app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.json({ limit: '1mb' }), express.urlencoded({ extended: true, limit: '1mb' }))
app.use(expressLayouts)
app.use('/', express.static('public'))

const dbUri = process.env.MONGO_URI
mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true }).then(console.log("Connected to mongodb"))

app.get('/', (req, res) => {
    res.render('index')
});

app.get('/signup', (req, res) => {
    res.render('signup')
});

const transporter = nodemailer.createTransport({
    host: "smtpout.secureserver.net",
    secure: true,
    secureConnection: false, // TLS requires secureConnection to be false
    tls: {
        ciphers: 'SSLv3'
    },
    requireTLS: true,
    port: 465,
    debug: true,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS
    }
});

app.post('/register', async (req, res) => {
    console.log(req.body)

    var findedUser = await userSchema.findOne({ email: req.body.email })

    if (findedUser && findedUser.verified) {
        return res.send({
            success: false,
            message: 'User already exists and is verified'
        })
    }

    const user = await userSchema.create({
        email: req.body.email,
        token: v4()
    })

    if (!user) {
        return res.send({
            success: false,
            message: 'User not created'
        })
    }

    const emailBody = ejs.render(fs.readFileSync(path.join(__dirname, 'views/email.ejs'), 'utf8'), { token: user.token })

    const info = await transporter.sendMail({
        from: '"SnapShot News" <snapshotnews@aayushgarg.net>', // sender address
        to: `${req.body.email}`, // list of receivers
        subject: "Thank You For Registering For Snapshot News!", // Subject line
        html: emailBody
    });

    res.send({
        success: true,
        message: 'Email sent successfully',
        info: info
    })
})

app.get('/verify/:token', async (req, res) => {
    const user = await userSchema.findOne({ token: req.params.token })
    if (!user) {
        return res.send({
            success: false,
            message: 'User not found'
        })
    }
    user.verified = true
    user.save()
    sendWeeklyEmail(user.email)
    res.send({
        success: true,
        message: 'User verified'
    })
});

app.listen(port, () => {
    console.log(`app listening on port ${port}!`);
});

async function sendWeeklyEmail(email){
    var latest = await newsListSchema.find().sort({ _id: -1 });
    if ((latest.length >= 1 && new Date(Date(latest.date)).getTime() <= new Date(Date.now() - 24 * 60 * 60 * 1000).getTime()) || latest.length == 0) {
        const news = await GetListOfNews()
        const newsList = await newsListSchema.create({
            articles: news
        })
        newsList.save()
        latest = await newsListSchema.find().sort({ _id: -1 });
    }

    var a = latest[0].articles.map(element => {
        element = JSON.parse(JSON.parse(JSON.stringify(JSON.parse(element))));
        return element;
    });

    console.log(a)

    const emailBody = ejs.render(fs.readFileSync(path.join(__dirname, 'views/weeklyemail.ejs'), 'utf8'), { newsletterItems: a })
    var curr = new Date; // get current date
    var first = curr.getDate() - curr.getDay(); // First day is the day of the month - the day of the week
    var last = first + 6; // last day is the first day + 6

    var firstday = new Date(curr.setDate(first));
    var lastday = new Date(curr.setDate(last));


    var date = firstday.getDate() + "-" + firstday.getMonth() + "-" + firstday.getFullYear() + " to " + lastday.getDate() + "-" + lastday.getMonth() + "-" + lastday.getFullYear()
    const info = await transporter.sendMail({
        from: '"SnapShot News" <snapshotnews@aayushgarg.net>', // sender address
        to: `${email}`, // list of receivers
        subject: "Here is your " + date + " Newsletter summarising the news in the current week", // Subject line
        html: emailBody
    });

    return info
}

async function GetListOfNews(){
    const response = await fetch(`https://newsapi.org/v2/top-headlines?apiKey=${process.env.NEWSAPI_KEY}&country=in&sort=popularity`)
    const json = await response.json()
    const articles =[]
    for (let i = 0; i < 5; i++) {
        articles.push(JSON.stringify(await summarize(json.articles[i].url)));
    }
    return articles;
}

async function summarize(url){
    //use puppeteer to open the page, get the content and use openai chatgpt to summarize it
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1900, height: 940 });
    await page.goto(url);
    await page.waitForSelector('body');
    const content = await page.evaluate(() => document.querySelector('body').innerText);
    await browser.close();
    //send the content to chatgpt and get the summary
    const response = await fetch('https://jamsapi.hackclub.dev/openai/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
        },
        body: JSON.stringify({
            "model": "gpt-3.5-turbo",
            "messages": [{
                "role": "user",
                "content": ("Summarize the following article. Return a json with a 150 word summary, a neutral headline, and the bias in the article in the format of {\"body\":<body here>, \"bias\": \"neutral,right,left\", \"headline\":<new headline>, \"newssite\":<news site of the article>}. do not return anything other than the json in any shape or form. The article contains garbage info that is not related to the article such as promotional material. Make sure it does not get into the response. \n\n" + content.toString()).slice(0, 4097)
            }]
        }),
    })
    const json = await response.json()
    console.log(json)
    const response1 = json.choices[0].message.content
    return response1
}

setInterval(async () => {
    const users = await userSchema.find({ verified: true })
    users.forEach(async user => {
        sendWeeklyEmail(user.email)
    });
}, 24 * 60 * 60 * 1000);


//Summarize the following article. Return a json with a 150 word summary, a neutral headline, and the bias in the article in the format of {"body":<body here>, "bias": "neutral,right,left", "headline":<new headline>}. do not return anything other than the json in any shape or form. 
