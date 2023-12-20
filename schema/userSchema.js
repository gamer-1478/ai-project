const mongoose = require('mongoose'),
    reqString = { type: String, required: true },
    nonreqString = { type: String, required: false },
    reqBoolean = { type: Boolean, required: true, default: false },
    moment = require('moment'),
    now = new Date(),
    dateStringWithTime = moment(now).format('YYYY-MM-DD HH:MM:SS');

const userSchema = new mongoose.Schema({
    email: reqString,
    date: {
        type: String,
        default: dateStringWithTime
    },
    verified: reqBoolean,
    token: reqString,
    premium: reqBoolean,
    buyDate: nonreqString
})

module.exports = mongoose.model("User", userSchema)