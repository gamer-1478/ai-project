require('dotenv').config();
const express = require('express');
const app = express();
let port = process.env.PORT || 3000;
const ejs = require('ejs');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const userSchema = require('./schema/userSchema');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4, v4 } = require('uuid');

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
    res.redirect('/')
});

app.listen(port, () => {
    console.log(`app listening on port ${port}!`);
});


async function sendWeeklyEmail(email){
    const weekly = JSON.parse(fs.readFileSync(path.join(__dirname, 'weekly.json'), 'utf8'))
    const emailBody = ejs.render(fs.readFileSync(path.join(__dirname, 'views/weeklyemail.ejs'), 'utf8'), { newsletterItems: weekly.a})
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

//Summarize the following article. Return a json with a 150 word summary, a neutral headline, and the bias in the article in the format of {"body":<body here>, "bias": "neutral,right,left", "headline":<new headline>}. do not return anything other than the json in any shape or form. 
