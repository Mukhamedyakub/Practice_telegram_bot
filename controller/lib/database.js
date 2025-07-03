const User = require("../../models/User");
const otpCodes = new Map();
const userSessions = new Map();
const mongoose = require('mongoose');
const Indication = require("../../models/Indication");

// MongoDB-backed user functions

async function saveUser(userId, userData) {
    if (userData === null) {
        // Logout → delete user
        await User.deleteOne({ userId: userId });
        return;
    }

    await User.findOneAndUpdate(
        { userId: userId },
        { ...userData, userId: userId },
        { upsert: true }
    );
}

async function getUser(userId) {
    return await User.findOne({ userId: userId });
}

async function isUserRegistered(userId) {
    const user = await User.findOne({ userId: userId });
    return !!user;
}

async function saveIndication(indicationData) {
    async function saveIndication(indicationData) {
    const indication = new Indication(indicationData);
    await indication.save();
}
}

// OTP (keep in memory for now)
function saveOTP(phone, code) {
    otpCodes.set(phone, { code, timestamp: Date.now() });
}

function getOTP(phone) {
    return otpCodes.get(phone);
}

function deleteOTP(phone) {
    otpCodes.delete(phone);
}

// Session (keep in memory for now)
function setUserSession(userId, sessionData) {
    userSessions.set(userId, sessionData);
}

function getUserSession(userId) {
    return userSessions.get(userId);
}

function deleteUserSession(userId) {
    userSessions.delete(userId);
}

module.exports = {
    saveUser,
    getUser,
    isUserRegistered,
    saveOTP,
    getOTP,
    deleteOTP,
    setUserSession,
    getUserSession,
    saveIndication,
    deleteUserSession
};
