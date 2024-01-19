const mongoose = require('mongoose'),
    reqString = { type: String, required: true },
    nonreqString = { type: String, required: false },
    reqBoolean = { type: Boolean, required: true, default: false },
    moment = require('moment'),
    now = new Date(),
    dateStringWithTime = moment(now).format('YYYY-MM-DD HH:MM:SS');

const NewsSchema = new mongoose.Schema({
    date: {
        type: String,
        default: dateStringWithTime
    },
    articles: {
        type: Array,
        default: []
    }
})

module.exports = mongoose.model("News", NewsSchema)