const cluster = require('cluster');
const os = require('os');
const logger = require('./src/utils/logger'); // Assuming logger handles basic console output

// We want to leave 1 CPU open for OS operations, but at least 1 worker.
const numCPUs = Math.max(1, os.cpus().length - 1);

if (cluster.isPrimary) {
  logger.info(`[Cluster] Primary process ${process.pid} is running`);
  logger.info(`[Cluster] Forking ${numCPUs} workers...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker failure and respawn
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`[Cluster] Worker ${worker.process.pid} died (code: ${code}, signal: ${signal}). Respawning...`);
    cluster.fork();
  });
} else {
  // Workers can share any TCP connection.
  // In this case, it is an HTTP/WebSocket server from server.js
  require('./server.js');
  logger.info(`[Cluster] Worker ${process.pid} started`);
}
