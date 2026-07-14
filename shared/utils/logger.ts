import winston from "winston";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
      let metaStr = '';
      if (Object.keys(meta).length) {
        const safeMeta: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(meta)) {
          if (val instanceof Error) {
            safeMeta[key] = { message: val.message, stack: val.stack?.split('\n')[0] };
          } else {
            safeMeta[key] = val;
          }
        }
        try {
          metaStr = JSON.stringify(safeMeta);
        } catch {
          metaStr = '[unserializable metadata]';
        }
      }
      return `[${timestamp}] ${level} [${service || "app"}]: ${message} ${metaStr}`;
    }),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "combined.log",
    }),
  ],
});

export default logger;
