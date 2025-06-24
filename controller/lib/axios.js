const path = require('path');
const currentModuleDir = __dirname;
const dotenvPath = path.resolve(currentModuleDir, '../../.env');

require('dotenv').config({ path: dotenvPath });
const axios = require("axios");

const BASE_URL = `https://api.telegram.org/bot${process.env.MY_TOKEN}`; 
function getAxiosInstance() {
    return {
        get(method, params) {
          return axios.get(`/${method}`, {
            baseURL: BASE_URL,
            params,
          });
        },
        post(method, data) {
          return axios({
            method: "post",
            baseURL: BASE_URL,
            url: `/${method}`,
            data,
          });
        },
    };
}

module.exports = { axiosInstance: getAxiosInstance() };
