const { createLogger, format, transports } = require('winston');
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [new transports.Console()]
});

function log(msg, level){
  switch(level){
    case 'error':
      logger.error(msg);
      break;
    case 'warn':
      logger.warn(msg);
      break;
    case 'info':
      logger.info(msg);
      break;
    case 'debug':
      logger.debug(msg);
      break;
    default:
      logger.info(msg);
      break;
  }
}


module.exports = {
  log
}
