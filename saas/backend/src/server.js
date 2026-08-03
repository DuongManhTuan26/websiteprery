import { createServer } from 'node:http';
import { createApp } from './app.js';
import { attachSockets } from './sockets/index.js';
import { env } from './config/env.js';

const app = createApp();
const server = createServer(app);
const io = attachSockets(server);

app.set('io', io);

server.listen(env.port, () => {
  console.log(`preny-clone backend listening on :${env.port}`);
});
