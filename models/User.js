const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: Number, required: true, unique: true },
    name: String,
    surname: String,
    phone: String,
    iin: String,
    personalAccount: String,
    address: String,
    registrationDate: Date
});

module.exports = mongoose.model('User', userSchema);
