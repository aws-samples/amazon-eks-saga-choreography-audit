'use strict';
const AWS = require('aws-sdk');

const dbOps = require('../rds/create');
const logger = require('../utils/logger');

let pollFrequency = process.env.POLL_FREQUENCY || 20;

var receiveInputMessages = function (appConfig) {
  let sqsConfig = appConfig.sqs
  AWS.config.update({ region: sqsConfig.region });
  const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
  var params = {
    AttributeNames: [
      "SentTimestamp"
    ],
    MaxNumberOfMessages: 10,
    MessageAttributeNames: [
      "All"
    ],
    QueueUrl: sqsConfig.queueUrl,
    VisibilityTimeout: 20,
    WaitTimeSeconds: 20
  };

  sqs.receiveMessage(params, function (err, data) {
    if (err) {
      logger.error(`RequestId: null - MessageId: null - OrderId: null - Unable to receive message from ${params.QueueUrl} - ${err.code} ${err.message}`)
    } else {
      if (data.Messages) {
        for (var i = 0; i < data.Messages.length; i++) {
          var message = data.Messages[i];
          let payload = JSON.parse(message.Body)
          let inputMsg = payload.msg.msg
          let messageId = message.MessageId
          let requestId = inputMsg.requestId

          if (Object.keys(inputMsg).length === 0) {
            logger.warn(`RequestId: ${requestId} - MessageId: ${messageId} - Order Id: null - Empty message received from ${params.QueueUrl}`)
          } else {
            logger.info(`RequestId: ${requestId} - MessageId: ${messageId} - OrderId: ${inputMsg.orderId} - receieved.`)

            inputMsg.messageId = message.MessageId
            dbOps.auditEntry({
              payload: payload.msg,
              rdsConfig: appConfig.rds,
              snsConfig: appConfig.sns
            }, (dbErr) => {
              if (dbErr) {
                if (dbErr.type === 'iam' || dbErr.type === 'dbConn' || dbErr.type === 'dbquery') {
                  logger.warn(`RequestId: ${inputMsg.requestId} - MessageId: ${messageId} - OrderId: ${inputMsg.orderId} - will be retried.`)
                } else {
                  let deleteParams = {
                    QueueUrl: sqsConfig.queueUrl,
                    ReceiptHandle: message.ReceiptHandle
                  }
                  sqs.deleteMessage(deleteParams, function (sqsErr, data) {
                    if (sqsErr) {
                      logger.error(`RequestId: ${inputMsg.requestId} - MessageId: ${messageId} - OrderId: ${inputMsg.orderId} - Unable to delete message: ${sqsErr.code} ${sqsErr.message}`)
                    } else {
                      logger.warn(`RequestId: ${inputMsg.requestId} - MessageId: ${messageId} - OrderId: ${inputMsg.orderId} - Message deleted.`)
                    }
                  });
                }
              } else {
                let deleteParams = {
                  QueueUrl: sqsConfig.queueUrl,
                  ReceiptHandle: message.ReceiptHandle
                }
                sqs.deleteMessage(deleteParams, function (sqsErr, data) {
                  if (sqsErr) {
                    logger.error(`RequestId: ${inputMsg.requestId} - MessageId: ${messageId} - OrderId: ${inputMsg.orderId} - Unable to delete message: ${sqsErr.code} ${sqsErr.message}`)
                  } else {
                    logger.warn(`RequestId: ${inputMsg.requestId} - MessageId: ${messageId} - OrderId: ${inputMsg.orderId} - Message deleted.`)
                  }
                });
              }
            })
          }
        }
        receiveInputMessages(appConfig);
      } else {
        setTimeout(function () {
          receiveInputMessages(appConfig)
        }, pollFrequency * 1000);
      }
    }
  });
};

module.exports = {
  receiveInputMessages: receiveInputMessages
}