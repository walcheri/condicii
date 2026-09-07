import { createApp } from "./backend/app.js";
const { app, db } = createApp();
const port = Number(process.env.PORT) || 10000;
const server = app.listen(port, "0.0.0.0", () =>
  console.log(`Сайт: http://localhost:${port}`),
);
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
