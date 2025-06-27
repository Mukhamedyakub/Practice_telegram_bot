const users = new Map();
const otpCodes = new Map();
const userSessions = new Map();

function saveUser(userId, userData) {
    users.set(userId, userData);
}

function getUser(userId) {
    return users.get(userId);
}

function isUserRegistered(userId) {
    return users.has(userId);
}

function saveOTP(phone, code) {
    otpCodes.set(phone, { code, timestamp: Date.now() });
}

function getOTP(phone) {
    return otpCodes.get(phone);
}

function deleteOTP(phone) {
    otpCodes.delete(phone);
}

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
    deleteUserSession
};