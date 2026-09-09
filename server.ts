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

  // API agendamentos
  app.get("/api/agendamentos", (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM agendamentos').all();
      res.json(rows);
    } catch (err) {
      console.error("Error fetching agendamentos", err);
      res.status(500).json({ error: "Failed to fetch agendamentos" });
    }
  });

  app.post("/api/agendamentos/bulk", (req, res) => {
    try {
      const records = req.body.records;
      if (!Array.isArray(records)) {
        return res.status(400).json({ error: "Records must be an array" });
      }

      // We use a transaction for performance
      const insert = db.prepare(`
        INSERT OR REPLACE INTO agendamentos 
        (id, unidadeSaude, dataCriacaoStr, dataAtendimentoStr, tempoEsperaDias, tipoConsulta, profissional, cboOriginal, cboCorrigido)
        VALUES (@id, @unidadeSaude, @dataCriacaoStr, @dataAtendimentoStr, @tempoEsperaDias, @tipoConsulta, @profissional, @cboOriginal, @cboCorrigido)
      `);
      
      const insertMany = db.transaction((rows) => {
        for (const row of rows) insert.run(row);
      });

      insertMany(records);
      res.json({ success: true, count: records.length });
    } catch (err) {
      console.error("Error inserting agendamentos in bulk", err);
      res.status(500).json({ error: "Failed to save agendamentos" });
    }
  });

  app.put("/api/agendamentos/:id", (req, res) => {
    try {
      const id = req.params.id;
      const data = req.body;
      const update = db.prepare(`
        UPDATE agendamentos 
        SET unidadeSaude = @unidadeSaude, dataCriacaoStr = @dataCriacaoStr, dataAtendimentoStr = @dataAtendimentoStr, 
            tempoEsperaDias = @tempoEsperaDias, tipoConsulta = @tipoConsulta, profissional = @profissional, 
            cboOriginal = @cboOriginal, cboCorrigido = @cboCorrigido
        WHERE id = @id
      `);
      update.run({ ...data, id });
      res.json({ success: true });
    } catch (err) {
      console.error("Error updating agendamento", err);
      res.status(500).json({ error: "Failed to update agendamento" });
    }
  });

  app.delete("/api/agendamentos/:id", (req, res) => {
    try {
      const id = req.params.id;
      db.prepare('DELETE FROM agendamentos WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting agendamento", err);
      res.status(500).json({ error: "Failed to delete agendamento" });
    }
  });

  app.post("/api/agendamentos/delete-bulk", (req, res) => {
    try {
      const ids = req.body.ids;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: "Ids must be an array" });
      }
      
      const deleteStmt = db.prepare('DELETE FROM agendamentos WHERE id = ?');
      const deleteMany = db.transaction((idsToDelete) => {
        for (const id of idsToDelete) deleteStmt.run(id);
      });
      
      deleteMany(ids);
      res.json({ success: true, count: ids.length });
    } catch (err) {
      console.error("Error bulk deleting agendamentos", err);
      res.status(500).json({ error: "Failed to bulk delete agendamentos" });
    }
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
