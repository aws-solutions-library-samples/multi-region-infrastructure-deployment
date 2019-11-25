// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const axios = require('axios');
const moment = require('moment');

const send = async (event) => {

  if (process.env.SEND_METRICS !== 'true') {
    return
  }

  try {
    const metric = {
      Solution: process.env.SOLUTION_ID,
      UUID: process.env.UUID,
      Version: process.env.VERSION,
      TimeStamp: moment().utc().format('YYYY-MM-DD HH:mm:ss.S'),
      Data: event
    };
    const params = {
      method: 'post',
      port: 443,
      url: 'https://metrics.awssolutionsbuilder.com/generic',
      headers: {
          'Content-Type': 'application/json'
      },
      data: metric
    };
    //Send Metrics & retun status code.
    const data = await axios(params);
    return data.status
  } catch (err) {
    //Not returning an error to avoid Metrics affecting the Application
    console.log(err);
  }
};


module.exports = {
  send: send
};
