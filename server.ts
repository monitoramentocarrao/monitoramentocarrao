import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { GasStation, SalesRecord, User, DatabaseState } from "./src/types.js";

dotenv.config();

const app = express();
const PORT = 3000;

// Use JSON body parser with generous limit
app.use(express.json({ limit: "50mb" }));

// Database configuration
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "database.json");

// Seed data
function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seedRecords: SalesRecord[] = [];
    
    // Generate some mock sales data for June 10th to June 19th, 2026 (current month)
    const days = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    
    days.forEach(day => {
      const dateStr = `2026-06-${day < 10 ? '0' + day : day}`;
      
      // Station 1 (Urban - Posto Central)
      // Prices: Gasolina R$ 5.80, Diesel S500 R$ 5.90, Diesel S10 R$ 6.10, Etanol R$ 3.90, Lubrificantes R$ 45.00
      const s1GasolinaQty = Math.floor(1000 + Math.random() * 400);
      const s1Diesel500Qty = Math.floor(400 + Math.random() * 200);
      const s1Diesel10Qty = Math.floor(800 + Math.random() * 300);
      const s1EtanolQty = Math.floor(1100 + Math.random() * 500); // urban stations sell more ethanol
      const s1LubsQty = Math.floor(15 + Math.random() * 15);

      const s1GasolinaVal = parseFloat((s1GasolinaQty * 5.82).toFixed(2));
      const s1Diesel5500Val = parseFloat((s1Diesel500Qty * 5.89).toFixed(2));
      const s1Diesel10Val = parseFloat((s1Diesel10Qty * 6.08).toFixed(2));
      const s1EtanolVal = parseFloat((s1EtanolQty * 3.88).toFixed(2));
      const s1LubsVal = parseFloat((s1LubsQty * 48.50).toFixed(2));

      const s1Total = s1GasolinaVal + s1Diesel5500Val + s1Diesel10Val + s1EtanolVal + s1LubsVal;
      const s1AVista = parseFloat((s1Total * 0.20).toFixed(2));
      const s1APrazo = parseFloat((s1Total * 0.15).toFixed(2));
      const s1Cartao = parseFloat((s1Total * 0.45).toFixed(2));
      const s1Pix = parseFloat((s1Total - (s1AVista + s1APrazo + s1Cartao)).toFixed(2));

      seedRecords.push({
        id: `p1_${dateStr}`,
        stationId: "p1",
        date: dateStr,
        sales: {
          gasolina: { quantity: s1GasolinaQty, value: s1GasolinaVal },
          dieselS500: { quantity: s1Diesel500Qty, value: s1Diesel5500Val },
          dieselS10: { quantity: s1Diesel10Qty, value: s1Diesel10Val },
          etanol: { quantity: s1EtanolQty, value: s1EtanolVal },
          lubrificantes: { quantity: s1LubsQty, value: s1LubsVal }
        },
        payments: {
          aVista: s1AVista,
          aPrazo: s1APrazo,
          cartao: s1Cartao,
          pix: s1Pix
        },
        notes: day === 12 ? "Dia chuvoso, fluxo de carros ligeiramente menor." : day === 15 ? "Segunda-feira, excelente fluxo de abastecimento urbano." : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Station 2 (Highway - Posto Trevo)
      // High highway diesel sales, lower Ethanol sales
      const s2GasolinaQty = Math.floor(700 + Math.random() * 300);
      const s2Diesel500Qty = Math.floor(1800 + Math.random() * 600); // High highway diesel sales
      const s2Diesel10Qty = Math.floor(2500 + Math.random() * 800);
      const s2EtanolQty = Math.floor(300 + Math.random() * 150);
      const s2LubsQty = Math.floor(30 + Math.random() * 25);

      const s2GasolinaVal = parseFloat((s2GasolinaQty * 5.75).toFixed(2));
      const s2Diesel5500Val = parseFloat((s2Diesel500Qty * 5.85).toFixed(2));
      const s2Diesel10Val = parseFloat((s2Diesel10Qty * 6.02).toFixed(2));
      const s2EtanolVal = parseFloat((s2EtanolQty * 3.92).toFixed(2));
      const s2LubsVal = parseFloat((s2LubsQty * 46.00).toFixed(2));

      const s2Total = s2GasolinaVal + s2Diesel5500Val + s2Diesel10Val + s2EtanolVal + s2LubsVal;
      const s2AVista = parseFloat((s2Total * 0.15).toFixed(2));
      const s2APrazo = parseFloat((s2Total * 0.35).toFixed(2)); // highway has higher Credit/Invoice sales
      const s2Cartao = parseFloat((s2Total * 0.35).toFixed(2));
      const s2Pix = parseFloat((s2Total - (s2AVista + s2APrazo + s2Cartao)).toFixed(2));

      seedRecords.push({
        id: `p2_${dateStr}`,
        stationId: "p2",
        date: dateStr,
        sales: {
          gasolina: { quantity: s2GasolinaQty, value: s2GasolinaVal },
          dieselS500: { quantity: s2Diesel500Qty, value: s2Diesel5500Val },
          dieselS10: { quantity: s2Diesel10Qty, value: s2Diesel10Val },
          etanol: { quantity: s2EtanolQty, value: s2EtanolVal },
          lubrificantes: { quantity: s2LubsQty, value: s2LubsVal }
        },
        payments: {
          aVista: s2AVista,
          aPrazo: s2APrazo,
          cartao: s2Cartao,
          pix: s2Pix
        },
        notes: day === 14 ? "Fim de semana com tráfego pesado de frotas e caminhões de carga." : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    const initialState: DatabaseState = {
      stations: [
        { id: "p1", name: "Posto Central", cnpj: "12.345.678/0001-99", address: "Av. Paulista, 1000 - São Paulo/SP" },
        { id: "p2", name: "Posto Trevo", cnpj: "98.765.432/0001-11", address: "Rodovia BR-116, Km 45 - Curitiba/PR" }
      ],
      records: seedRecords,
      users: [
        { id: "admin", username: "admin", name: "Administrador", role: "admin", password: "admin" },
        { id: "p1_op", username: "posto1", name: "Operador Posto Central", role: "user", stationId: "p1", password: "p1" },
        { id: "p2_op", username: "posto2", name: "Operador Posto Trevo", role: "user", stationId: "p2", password: "p2" }
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), "utf-8");
  }
}

// Call ensureDatabase
ensureDatabase();

// Helper to read database safely
function getDB(): DatabaseState {
  try {
    ensureDatabase();
    const data = fs.readFileSync(DB_FILE, "utf-8");
    const db: DatabaseState = JSON.parse(data);
    
    let dbUpdated = false;

    // Migrate old database states without 'users'
    if (!db.users || !Array.isArray(db.users)) {
      db.users = [
        { id: "admin", username: "admin", name: "Administrador", role: "admin", password: "admin" },
        { id: "p1_op", username: "posto1", name: "Operador Posto Central", role: "user", stationId: "p1", password: "p1" },
        { id: "p2_op", username: "posto2", name: "Operador Posto Trevo", role: "user", stationId: "p2", password: "p2" }
      ];
      dbUpdated = true;
    }

    // Migrate records without 'payments'
    if (db.records && Array.isArray(db.records)) {
      db.records.forEach(r => {
        if (!r.payments) {
          const totalVal =
            (r.sales.gasolina?.value || 0) +
            (r.sales.dieselS500?.value || 0) +
            (r.sales.dieselS10?.value || 0) +
            (r.sales.etanol?.value || 0) +
            (r.sales.lubrificantes?.value || 0);

          const aVista = parseFloat((totalVal * 0.20).toFixed(2));
          const aPrazo = parseFloat((totalVal * 0.15).toFixed(2));
          const cartao = parseFloat((totalVal * 0.45).toFixed(2));
          const pix = parseFloat((totalVal - (aVista + aPrazo + cartao)).toFixed(2));

          r.payments = { aVista, aPrazo, cartao, pix };
          dbUpdated = true;
        }
      });
    }

    if (dbUpdated) {
      saveDB(db);
    }

    return db;
  } catch (err) {
    console.error("Erro lendo banco de dados:", err);
    return { stations: [], records: [], users: [] };
  }
}

// Helper to write database safely
function saveDB(data: DatabaseState) {
  try {
    ensureDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Erro salvando banco de dados:", err);
    return false;
  }
}

// Initialize Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("GEMINI_API_KEY não localizada. Análises de IA utilizarão respostas inteligentes simuladas locais.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Obter dados completos (Postos e Vendas)
app.get("/api/data", (req, res) => {
  const db = getDB();
  res.json(db);
});

// 2. Criar ou Atualizar Posto de Gasolina
app.post("/api/stations", (req, res) => {
  const db = getDB();
  const { id, name, cnpj, address } = req.body;
  
  if (!name) {
    res.status(400).json({ error: "O nome do posto é obrigatório." });
    return;
  }

  const existingIndex = db.stations.findIndex(s => s.id === id);
  const newStation: GasStation = {
    id: id || `station_${Date.now()}`,
    name,
    cnpj: cnpj || "",
    address: address || ""
  };

  if (existingIndex > -1) {
    db.stations[existingIndex] = newStation;
  } else {
    db.stations.push(newStation);
  }

  if (saveDB(db)) {
    res.status(201).json(newStation);
  } else {
    res.status(500).json({ error: "Erro ao salvar no banco de dados." });
  }
});

// 3. Excluir Posto de Gasolina
app.delete("/api/stations/:id", (req, res) => {
  const db = getDB();
  const { id } = req.params;

  db.stations = db.stations.filter(s => s.id !== id);
  // Remove associated records
  db.records = db.records.filter(r => r.stationId !== id);

  if (saveDB(db)) {
    res.json({ success: true, message: `Posto ${id} e suas vendas coletadas foram removidos.` });
  } else {
    res.status(500).json({ error: "Erro ao atualizar banco de dados." });
  }
});

// 4. Salvar ou atualizar registro de vendas diárias
app.post("/api/records", (req, res) => {
  const db = getDB();
  const record: SalesRecord = req.body;

  if (!record.stationId || !record.date || !record.sales) {
    res.status(400).json({ error: "Campos obrigatórios ausentes: stationId, date ou sales." });
    return;
  }

  // Check if station exists
  const stationExists = db.stations.some(s => s.id === record.stationId);
  if (!stationExists) {
    res.status(400).json({ error: "O Posto selecionado não existe." });
    return;
  }

  // Perform check that sales sum matches payments sum (bater fechamento)
  const totalVal =
    (record.sales.gasolina?.value || 0) +
    (record.sales.dieselS500?.value || 0) +
    (record.sales.dieselS10?.value || 0) +
    (record.sales.etanol?.value || 0) +
    (record.sales.lubrificantes?.value || 0);

  if (!record.payments) {
    const aVista = parseFloat((totalVal * 0.20).toFixed(2));
    const aPrazo = parseFloat((totalVal * 0.15).toFixed(2));
    const cartao = parseFloat((totalVal * 0.45).toFixed(2));
    const pix = parseFloat((totalVal - (aVista + aPrazo + cartao)).toFixed(2));
    record.payments = { 
      aVista, 
      aPrazo, 
      cartao, 
      pix,
      recebimentoNotas: 0,
      faltaSobra: 0,
      despesas: 0,
      expensesDetalhadas: { salario: 0, agua: 0, luz: 0, telefone: 0, internet: 0, manutencao: 0, outros: 0 }
    };
  } else {
    // Expected inflow: Sales + Recebimento de Notas
    const expectedInflow = totalVal + (record.payments.recebimentoNotas || 0);
    // Recorded outflow: Cash, Term, Credit/Debit Card, Pix, and Expenses
    const recordedOutflow =
      (record.payments.aVista || 0) +
      (record.payments.aPrazo || 0) +
      (record.payments.cartao || 0) +
      (record.payments.pix || 0) +
      (record.payments.despesas || 0);

    const faltaSobra = record.payments.faltaSobra || 0;

    const diff = Math.abs((expectedInflow + faltaSobra) - recordedOutflow);
    if (diff > 0.05) { // allow small floating point rounding differences of 5 cents max
      res.status(400).json({
        error: `O fechamento financeiro não bate! Entradas Esperadas (Vendas + Recebimento Notas): R$ ${expectedInflow.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Saídas Registradas (Meios de Pagamento + Despesas): R$ ${recordedOutflow.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Diferença de Falta/Sobra de Caixa: R$ ${((recordedOutflow - expectedInflow)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`
      });
      return;
    }
  }

  // Construct standard ID
  const recordId = `${record.stationId}_${record.date}`;
  const existingIndex = db.records.findIndex(r => r.id === recordId || (r.stationId === record.stationId && r.date === record.date));

  const finalRecord: SalesRecord = {
    ...record,
    id: recordId,
    updatedAt: new Date().toISOString(),
    createdAt: existingIndex > -1 ? db.records[existingIndex].createdAt : new Date().toISOString()
  };

  if (existingIndex > -1) {
    db.records[existingIndex] = finalRecord;
  } else {
    db.records.push(finalRecord);
  }

  if (saveDB(db)) {
    res.json(finalRecord);
  } else {
    res.status(500).json({ error: "Erro ao persistir registro de vendas." });
  }
});

// 5. Excluir registro de venda diária
app.delete("/api/records/:id", (req, res) => {
  const db = getDB();
  const { id } = req.params;

  db.records = db.records.filter(r => r.id !== id);

  if (saveDB(db)) {
    res.json({ success: true, message: "Registro de venda removido." });
  } else {
    res.status(500).json({ error: "Erro ao remover registro de venda." });
  }
});

// 5b. Authenticate User (Login por Senha)
app.post("/api/login", (req, res) => {
  const db = getDB();
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Usuário e senha são obrigatórios." });
    return;
  }

  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user || user.password !== password) {
    res.status(401).json({ error: "Usuário ou senha incorretos." });
    return;
  }

  // Return user without password
  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

// 5c. List Users (Admin only client-validated, server-returned)
app.get("/api/users", (req, res) => {
  const db = getDB();
  // Safe return of user details
  const safeUsers = db.users.map(u => {
    const { password: _, ...safe } = u;
    return { ...safe, password: u.password }; // keep it simple and editable for admin
  });
  res.json(safeUsers);
});

// 5d. Save / Create / Update User
app.post("/api/users", (req, res) => {
  const db = getDB();
  const userData: User = req.body;

  if (!userData.username || !userData.name || !userData.password || !userData.role) {
    res.status(400).json({ error: "Campos obrigatórios ausentes para o cadastro de usuário." });
    return;
  }

  const existingIndex = db.users.findIndex(u => u.id === userData.id || u.username.toLowerCase() === userData.username.toLowerCase());

  const finalUser: User = {
    ...userData,
    id: userData.id || `user_${Date.now()}`
  };

  if (existingIndex > -1) {
    db.users[existingIndex] = finalUser;
  } else {
    db.users.push(finalUser);
  }

  if (saveDB(db)) {
    const { password: _, ...safe } = finalUser;
    res.status(201).json(safe);
  } else {
    res.status(500).json({ error: "Erro ao salvar usuário no banco." });
  }
});

// 5e. Delete User
app.delete("/api/users/:id", (req, res) => {
  const db = getDB();
  const { id } = req.params;

  if (id === "admin") {
    res.status(400).json({ error: "O administrador mestre não pode ser removido." });
    return;
  }

  db.users = db.users.filter(u => u.id !== id);

  if (saveDB(db)) {
    res.json({ success: true, message: "Usuário removido com sucesso." });
  } else {
    res.status(500).json({ error: "Erro ao remover usuário." });
  }
});

// 6. Restaurar banco de dados inteiro (Backup/Import)
app.post("/api/import", (req, res) => {
  const { stations, records, users } = req.body;

  if (!Array.isArray(stations) || !Array.isArray(records)) {
    res.status(400).json({ error: "Formato de dados para importação inválido." });
    return;
  }

  const db = getDB();
  const newDB: DatabaseState = {
    stations,
    records,
    users: Array.isArray(users) && users.length > 0 ? users : db.users
  };

  if (saveDB(newDB)) {
    res.json({ success: true, message: `${stations.length} postos, ${records.length} registros de vendas e ${newDB.users.length} usuários calibrados com faturamento.` });
  } else {
    res.status(500).json({ error: "Falha ao gravar arquivos de importação." });
  }
});

// 7. Geração de Relatório Analítico Mensal via Gemini
app.post("/api/reports/analyze", async (req, res) => {
  const { month, stationId } = req.body; // month: "YYYY-MM", stationId: "consolidated" ou ID específico

  if (!month) {
    res.status(400).json({ error: "O mês de referência é obrigatório." });
    return;
  }

  const db = getDB();
  
  // Filter records for this month
  const monthRecords = db.records.filter(r => r.date.startsWith(month) && (stationId === "consolidated" || r.stationId === stationId));

  if (monthRecords.length === 0) {
    res.json({
      text: `### Relatório Mensal de Combustíveis (${month})
      
      Não foram encontrados registros de vendas para o período e escopo selecionados. Adicione os dados diários de vendas na aba "Registrar Lançamento" para iniciar o processamento analítico.`
    });
    return;
  }

  // Aggregate stats
  const totals = {
    gasolinaQty: 0, gasolinaVal: 0,
    dieselS500Qty: 0, dieselS500Val: 0,
    dieselS10Qty: 0, dieselS10Val: 0,
    etanolQty: 0, etanolVal: 0,
    lubrificantesQty: 0, lubrificantesVal: 0,
    totalVal: 0,
    totalQty: 0
  };

  monthRecords.forEach(r => {
    totals.gasolinaQty += r.sales.gasolina.quantity;
    totals.gasolinaVal += r.sales.gasolina.value;
    
    totals.dieselS500Qty += r.sales.dieselS500.quantity;
    totals.dieselS500Val += r.sales.dieselS500.value;

    totals.dieselS10Qty += r.sales.dieselS10.quantity;
    totals.dieselS10Val += r.sales.dieselS10.value;

    totals.etanolQty += r.sales.etanol.quantity;
    totals.etanolVal += r.sales.etanol.value;

    totals.lubrificantesQty += r.sales.lubrificantes.quantity;
    totals.lubrificantesVal += r.sales.lubrificantes.value;
  });

  totals.totalVal = totals.gasolinaVal + totals.dieselS500Val + totals.dieselS10Val + totals.etanolVal + totals.lubrificantesVal;
  totals.totalQty = totals.gasolinaQty + totals.dieselS500Qty + totals.dieselS10Qty + totals.etanolQty + totals.lubrificantesQty;

  const targetStationName = stationId === "consolidated" 
    ? "Rede Consolidada (Todos os Postos)" 
    : (db.stations.find(s => s.id === stationId)?.name || `ID: ${stationId}`);

  // Calculate average prices realized
  const avgPrices = {
    gasolina: totals.gasolinaQty > 0 ? (totals.gasolinaVal / totals.gasolinaQty).toFixed(2) : "0.00",
    dieselS500: totals.dieselS500Qty > 0 ? (totals.dieselS500Val / totals.dieselS500Qty).toFixed(2) : "0.00",
    dieselS10: totals.dieselS10Qty > 0 ? (totals.dieselS10Val / totals.dieselS10Qty).toFixed(2) : "0.00",
    etanol: totals.etanolQty > 0 ? (totals.etanolVal / totals.etanolQty).toFixed(2) : "0.00",
    lubrificantes: totals.lubrificantesQty > 0 ? (totals.lubrificantesVal / totals.lubrificantesQty).toFixed(2) : "0.00",
  };

  // Check notes for qualitative information
  const userNotes = monthRecords.filter(r => r.notes).map(r => `${r.date}: "${r.notes}"`).join("\n");

  // Construct prompt for Gemini
  const prompt = `Você é um Auditor e Consultor Financeiro focado na gestão estratégica de postos de combustível (gasolina, diesel, etanol, lubrificantes).
Gere uma análise operacional e financeira extremamente profissional e detalhada para o mês de ${month} referente ao Posto/Rede: ${targetStationName}.

Aqui estão as métricas consolidadas de vendas do mês obtidas diretamente do sistema centralizador:

1. GASOLINA COMUM:
   - Volume Total Vendido: ${totals.gasolinaQty.toLocaleString('pt-BR')} Litros
   - Faturamento Bruto: R$ ${totals.gasolinaVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   - Preço Médio Praticado: R$ ${avgPrices.gasolina} / Litro

2. DIESEL S500:
   - Volume Total Vendido: ${totals.dieselS500Qty.toLocaleString('pt-BR')} Litros
   - Faturamento Bruto: R$ ${totals.dieselS500Val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   - Preço Médio Praticado: R$ ${avgPrices.dieselS500} / Litro

3. DIESEL S10:
   - Volume Total Vendido: ${totals.dieselS10Qty.toLocaleString('pt-BR')} Litros
   - Faturamento Bruto: R$ ${totals.dieselS10Val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   - Preço Médio Praticado: R$ ${avgPrices.dieselS10} / Litro

4. ETANOL HIDRATADO:
   - Volume Total Vendido: ${totals.etanolQty.toLocaleString('pt-BR')} Litros
   - Faturamento Bruto: R$ ${totals.etanolVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   - Preço Médio Praticado: R$ ${avgPrices.etanol} / Litro

5. LUBRIFICANTES (CONVENIÊNCIA & PISTA):
   - Quantidade Total Vendida: ${totals.lubrificantesQty.toLocaleString('pt-BR')} Unidades
   - Faturamento Bruto: R$ ${totals.lubrificantesVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   - Preço Médio Praticado: R$ ${avgPrices.lubrificantes} / Unidade

FATURAMENTO TOTAL DO PERÍODO: R$ ${totals.totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
VOLUME TOTAL DE COMBUSTÍVEIS VENDIDO: ${totals.totalQty.toLocaleString('pt-BR')} Litros/Unidades

Registros e ocorrências reportados pela pista durante o mês:
${userNotes || "Nenhuma ocorrência reportada no período."}

Por favor, escreva um relatório rico, estruturado em Markdown elegante usando títulos, subtítulos, tabelas pequenas, e marcadores.
O relatório deve seguir esta estrutura:
1. **Resumo Executivo**: Visão geral sobre a saúde financeira do posto/rede no mês, destacando o faturamento total acumulado e a distribuição de canais de venda (posto urbano vs rodoviário, diesel vs ciclo Otto).
2. **Análise de Mix de Produtos (Ciclo Otto vs. Diesel)**: Discuta a representatividade de cada produto nos volumes totais. Fale sobre a relação de preços entre a Gasolina e o Etanol (se o Etanol está vantajoso, abaixo de 70-73% do preço da gasolina, etc.) e o impacto disso. Discuta a força das vendas de Diesel S10 vs Diesel S500.
3. **Análise de Lubrificantes e Produtos de Maior Margem**: Discuta o papel dos Lubrificantes como chave na rentabilidade periférica de pista e como melhorar o ticket médio por veículo abastecido.
4. **Insights de Pista (Ocorrências e Operações)**: Avalie as notas do período fornecendo análises do impacto climático ou logístico citados pelo usuário.
5. **Recomendações e Plano de Ação**: 3 a 5 recomendações práticas (ex: estoque inteligente, campanhas locais, reajustes, treinamento da equipe de pista para vendas adicionais).

Escreva na terceira pessoa de forma executiva, objetiva e muito inspiradora em português do Brasil.`;

  try {
    if (process.env.GEMINI_API_KEY) {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });
      
      res.json({ text: response.text });
    } else {
      // Return beautiful fallback analysis if key is missing (Local intelligent simulation)
      const gasolinaPercent = ((totals.gasolinaVal / totals.totalVal) * 100).toFixed(1);
      const dieselPercent = (((totals.dieselS500Val + totals.dieselS10Val) / totals.totalVal) * 100).toFixed(1);
      const etanolPercent = ((totals.etanolVal / totals.totalVal) * 100).toFixed(1);
      const lubPercent = ((totals.lubrificantesVal / totals.totalVal) * 100).toFixed(1);
      
      const promptFallback = `### Relatório Operacional Simplificado (${month}) - ${targetStationName}

*(Análise gerada em modo local de contingência)*

#### 1. Resumo Executivo
O faturamento total acumulado do posto foi de **R$ ${totals.totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}**, com movimentação total de **${totals.totalQty.toLocaleString('pt-BR')} litros/unidades** no período. A distribuição de receitas destaca a importância de cada combustível no equilíbrio de caixa da operação.

- **Ciclo Otto (Gasolina + Etanol):** Representa grande fluxo de volume de carros leves.
- **Diesel (S10 + S500):** Crucial para o faturamento de froteiros e caminhões de carga.
- **Lubrificantes:** Responsável por maximizar a margem de contribuição (representa **${lubPercent}%** do faturamento).

#### 2. Análise de Mix de Produtos
- **Gasolina:** Teve uma receita média de **R$ ${totals.gasolinaVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}** com preço médio de **R$ ${avgPrices.gasolina}**.
- **Etanol:** Preço de **R$ ${avgPrices.etanol}**, o que representa cerca de **${((parseFloat(avgPrices.etanol) / parseFloat(avgPrices.gasolina)) * 100).toFixed(1)}%** do preço da gasolina comum. Quando essa proporção está abaixo de 70%, o etanol se torna extremamente competitivo, estimulando maior volume de venda de ciclo Otto hidratado.
- **Diesel S10 vs S500:** O Diesel S10 (preço médio **R$ ${avgPrices.dieselS10}**) continua ganhando espaço sobre o Diesel S500 antigo devido à renovação natural de frotas e às exigências de emissões de motores mais novos.

#### 3. Desempenho de Margem e Lubrificantes
As vendas de lubrificantes somaram **${totals.lubrificantesQty} unidades**, movimentando **R$ ${totals.lubrificantesVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**. Apesar de representarem um volume absoluto menor, os lubrificantes possuem uma margem de contribuição líquida muito superior (frequentemente acima de 30%), sendo fundamentais para compor o lucro líquido do revendedor diante do aperto de margens dos combustíveis comuns.

#### 4. Insights de Ocorrência
Com base nos registros operacionais inseridos pelo gerente da pista:
${userNotes ? `*Ocorrências mapeadas:*\n${userNotes}` : `*Nenhuma barreira de fluxo ou ocorrência climatológica crítica foi reportada nas notas deste período.*`}

#### 5. Recomendações Estratégicas para o Mês Seguinte
1. **Campanha de Incentivo para Lubrificantes:** Desenvolver metas e bônus rápidos para a equipe de frentistas que propuserem sistematicamente a verificação de óleo e água de arrefecimento na pista.
2. **Posicionamento de Preços do Etanol:** Monitorar as usinas locais para manter o preço do etanol sempre dentro do gatilho competitivo de 70% da gasolina, visando fidelizar clientes urbanos e taxistas de aplicativo.
3. **Contratos com Empresas e Transportadoras:** Utilizar o forte volume do Diesel S10 para negociar contratos de fidelização para frotas de entrega locais, garantindo fluxo previsível de caixa aos finais de semana.`;
      
      res.json({ text: promptFallback });
    }
  } catch (error: any) {
    console.error("Erro ao chamar Gemini:", error);
    res.status(500).json({ error: "Erro interno ao processar a inteligência analítica: " + error.message });
  }
});


// ----------------------------------------------------
// VITE OR STATIC SERVING MIDDLEWARE
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Start Server listening on 0.0.0.0:3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[CMC Server] Servidor executando em http://localhost:${PORT}`);
  });
}

startServer();
