const mongoose = require("mongoose");

const indicationSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  numbers: { type: String, required: true },
  photoPath: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Indication", indicationSchema);
