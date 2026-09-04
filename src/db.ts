import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Certifique-se de que o diretório data exista
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// O arquivo .db ficará em /data/database.db
const dbPath = path.join(dataDir, 'database.db');
export const db = new Database(dbPath, { verbose: console.log });

// Habilitar o modo WAL (Write-Ahead Logging) para melhor performance
db.pragma('journal_mode = WAL');

// Inicialização de tabelas exemplo (opcional)
db.exec(`
  CREATE TABLE IF NOT EXISTS agendamentos (
    id TEXT PRIMARY KEY,
    unidadeSaude TEXT,
    dataCriacaoStr TEXT,
    dataAtendimentoStr TEXT,
    tempoEsperaDias INTEGER,
    tipoConsulta TEXT,
    profissional TEXT,
    cboOriginal TEXT,
    cboCorrigido TEXT
  );
`);
