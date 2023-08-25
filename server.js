require('dotenv').config();
const express = require('express');
const app = express();
let port = process.env.PORT || 3000;
const ejs = require('ejs');
const expressLayouts = require('express-ejs-layouts');

app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.json({ limit: '1mb' }), express.urlencoded({ extended: true, limit: '1mb' }))
app.use(expressLayouts)
app.use('/', express.static('public'))


app.get('/', (req, res) => {
    res.render('index')
});

app.listen(port, () => {
    console.log(`app listening on port ${port}!`);
});