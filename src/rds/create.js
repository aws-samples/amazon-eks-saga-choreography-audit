'use strict';

const mom = require('moment-timezone')
const mysql = require('mysql2');
const AWS = require('aws-sdk');

const logger = require('../utils/logger')

const TZ = process.env.TZ || 'Asia/Kolkata'

function getToken(dbConfig, ids, cb) {
  var signer = new AWS.RDS.Signer();
  signer.getAuthToken({
    region: dbConfig.region,
    hostname: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.dbuser
  }, (err, token) => {
    if (err) {
      logger.error(`RequestId: ${ids.requestId} - MessageId: ${ids.messageId} - OrderId: ${ids.orderId} - Error obtaining token ${err.code} ${err.message}`)
      cb(err, null)
    } else {
      logger.info(`RequestId: ${ids.requestId} - MessageId: ${ids.messageId} - OrderId: ${ids.orderId} - Obtained token`)
      dbConfig.token = token
      cb(null, dbConfig)
    }
  })
}

function getDbConnection(dbConfig, ids, cb) {
  var conn = mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.dbuser,
    password: dbConfig.token,
    database: dbConfig.db,
    ssl: 'Amazon RDS',
    authPlugins: {
      mysql_clear_password: () => () => Buffer.from(dbConfig.token + '\0')
    }
  });

  conn.connect((err) => {
    if (err) {
      logger.error(`RequestId: ${ids.requestId} - MessageId: ${ids.messageId} - OrderId: ${ids.orderId} - Database connection failed - ${err.code} ${err.message}`)
      cb(err, null)
    } else {
      logger.info(`RequestId: ${ids.requestId} - MessageId: ${ids.messageId} - OrderId: ${ids.orderId} - Database connected.`)
      cb(null, conn)
    }
  })
}

function auditEntry(req, cb) {
  let body = req.payload.msg
  let dbConfig = req.rdsConfig

  let orderId = body.orderId
  let requestId = body.requestId
  let msgId = body.messageId
  let ids = { requestId: requestId, orderId: orderId, messageId: msgId }

  getToken(dbConfig, ids, (iamErr, dbToken) => {
    if (iamErr) {
      cb({ type: 'iam', msg: `Error obtaining token - ${iamErr.code} ${iamErr.message}` })
    } else {
      getDbConnection(dbToken, ids, (dbErr, conn) => {
        if (dbErr) {
          cb({ type: 'dbconn', msg: `Database connection failed - ${dbErr.code} ${dbErr.message}.` })
        } else {
          let q = `INSERT INTO ${dbToken.db}.order_trail (order_id, saga_us, saga_us_status, saga_us_msg, trail_timestamp) VALUES(?,?,?,?,?);`
          let v = [orderId, req.payload.us, req.payload.msgType, body.msg, body.ts]
          conn.query(q, v, (qryErr) => {
            conn.end()
            if (qryErr) {
              logger.error(`RequestId: ${ids.requestId} - MessageId: ${ids.messageId} - OrderId: ${orderId} - Error running query - ${qryErr.code} - ${qryErr.message}`)
              cb({ type: 'dbquery', msg: `Error running query - ${qryErr.code} - ${qryErr.message}` })
            } else {
              logger.info(`RequestId: ${ids.requestId} - MessageId: ${ids.messageId} - OrderId: ${orderId} - Trail updated.`)
              cb(null)
            }
          })
        }
      })
    }
  })
}

module.exports = {
  auditEntry: auditEntry
}