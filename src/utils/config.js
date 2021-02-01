const logger = require("./logger")

function getAppConfig() {
  let appConfig = {
    rds: {},
    sqs: {}
  }
  if (process.env.TZ) {
    logger.info(`Timezone will be set to ${process.env.TZ}`)
  } else {
    logger.warn(`Timezone will default to Aisa/Kolkata`)
  }
  if (process.env.REGION) {
    appConfig.rds.region = process.env.REGION
    appConfig.sqs.region = process.env.REGION
  } else {
    logger.error(`Environment variable for region was not found.`)
    return {}
  }
  if (process.env.DBHOST) {
    appConfig.rds.host = process.env.DBHOST
  } else {
    logger.error(`Environment variable for host was not found.`)
    return {}
  }
  if (process.env.DBPORT) {
    appConfig.rds.port = parseInt(process.env.DBPORT)
  } else {
    logger.error(`Environment variable for port was not found.`)
    return {}
  }
  if (process.env.DBUSER) {
    appConfig.rds.dbuser = process.env.DBUSER
  } else {
    logger.error(`Environment variable for database user was not found.`)
    return {}
  }
  if (process.env.DBNAME) {
    appConfig.rds.db = process.env.DBNAME
  } else {
    logger.error(`Environment variable for database name was not found.`)
    return {}
  }
  if (process.env.INPT_QUEUE_URL) {
    appConfig.sqs.queueUrl = process.env.INPT_QUEUE_URL
  } else {
    logger.error(`Environment variable for input queue URL was not found.`)
  }

  return appConfig
}

module.exports = {
  getAppConfig: getAppConfig
}