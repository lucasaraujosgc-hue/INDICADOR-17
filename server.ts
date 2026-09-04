import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Exemplo de rota da API para testar o banco de dados
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      db: db.open ? "connected" : "disconnected",
      message: "Banco de dados better-sqlite3 inicializado com sucesso"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Modo de produção: serve os arquivos estáticos compilados do React
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

startServer();
