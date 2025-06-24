const axios = require("axios");
MY_TOKEN = "7290742972:AAE-B7zpQGQxTnJ2jwQOnhQO9ta6wUwuzTE";

const BASE_URL = `https://api.telegram.org/bot${MY_TOKEN}`; 
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