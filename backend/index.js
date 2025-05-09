const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

// Conexão com MySQL
let db;
(async () => {
  db = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'dash',
    password: 'Rafajon0207*',
    database: 'dash',
    port: 3306
  });
  // Criação da tabela (execute manualmente se necessário)
  // await db.execute(`
  //   CREATE TABLE IF NOT EXISTS fila (
  //     id INT PRIMARY KEY,
  //     tipo VARCHAR(50),
  //     plano VARCHAR(50),
  //     data VARCHAR(10),
  //     hora VARCHAR(10),
  //     status VARCHAR(20) DEFAULT 'em_fila',
  //     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  //   );
  // `);
})();

// Configurações dos clusters Proxmox
const proxmoxClusters = [
  {
    name: 'cluster1',
    url: 'https://cluster1.brightcloudgames.com.br/api2/json',
    token: 'root@pam!dash=ae3fcaca-f079-4287-908a-5ffb870b896d'
  },
  {
    name: 'cluster2',
    url: 'https://cluster2.brightcloudgames.com.br/api2/json',
    token: 'root@pam!dash=b6a149c4-0ad2-4f64-b6b2-e3a8e633b87c'
  }
];

async function getProxmoxMetrics() {
  let maquinasEmUso = 0;
  let nodesDisponiveis = 0;
  let vmsExistentes = 0;

  for (const cluster of proxmoxClusters) {
    try {
      const nodesResp = await axios.get(`${cluster.url}/nodes`, {
        headers: { Authorization: `PVEAPIToken=${cluster.token}` },
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 10000
      });
      const nodes = nodesResp.data.data;
      // Contar VMs existentes (todas as VMs, independente do status e do node)
      for (const node of nodes) {
        if (node.status !== 'online') continue;
        try {
          const vmsResp = await axios.get(`${cluster.url}/nodes/${node.node}/qemu`, {
            headers: { Authorization: `PVEAPIToken=${cluster.token}` },
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
            timeout: 10000
          });
          const vms = vmsResp.data.data;
          vmsExistentes += vms.length;
        } catch (err) {
          console.error(`Erro ao buscar VMs do node ${node.node}:`, err.message, err.response?.data || err);
        }
      }
      // Contar maquinasEmUso e nodesDisponiveis apenas nos nodes jogáveis
      for (const node of nodes) {
        if (node.status !== 'online') continue;
        if (node.node === 'BCG0' || node.node === 'BCG3') continue; // Ignora nodes não jogáveis
        try {
          const vmsResp = await axios.get(`${cluster.url}/nodes/${node.node}/qemu`, {
            headers: { Authorization: `PVEAPIToken=${cluster.token}` },
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
            timeout: 10000
          });
          const vms = vmsResp.data.data;
          let runningOnNode = 0;
          for (const vm of vms) {
            try {
              const statusResp = await axios.get(`${cluster.url}/nodes/${node.node}/qemu/${vm.vmid}/status/current`, {
                headers: { Authorization: `PVEAPIToken=${cluster.token}` },
                httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
                timeout: 10000
              });
              const status = statusResp.data.data.status;
              if (status === 'running') {
                maquinasEmUso++;
                runningOnNode++;
              }
            } catch (err) {
              console.error(`Erro ao buscar status da VM ${vm.vmid} no node ${node.node}:`, err.message, err.response?.data || err);
            }
          }
          if (runningOnNode === 0) {
            nodesDisponiveis++;
          }
        } catch (err) {
          console.error(`Erro ao buscar VMs do node ${node.node}:`, err.message, err.response?.data || err);
        }
      }
    } catch (err) {
      console.error(`Erro ao buscar nodes do ${cluster.name}:`, err.message, err.response?.data || err);
    }
  }
  return { maquinasEmUso, maquinasDisponiveis: nodesDisponiveis, vmsExistentes };
}

// Endpoint de teste
app.get('/', (req, res) => {
  res.send('Bright Dashboard Backend rodando!');
});

// Endpoint para overview das métricas (mock inicial)
app.get('/api/metrics/overview', async (req, res) => {
  try {
    const { maquinasEmUso, maquinasDisponiveis, vmsExistentes } = await getProxmoxMetrics();
    // TODO: Integrar com banco de dados para histórico
    res.json({
      maquinasEmUso,
      maquinasDisponiveis,
      vmsExistentes,
      filaDeEspera: 1, // mock
      tempoMedioSessao: 42 // mock
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar métricas do Proxmox' });
  }
});

// Webhook para registrar entrada na fila
app.post('/api/webhook/queue', async (req, res) => {
  const evento = { ...req.body, ...req.query };
  try {
    await db.execute(
      'INSERT INTO fila (id, tipo, plano, data, hora, status) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE tipo=VALUES(tipo), plano=VALUES(plano), data=VALUES(data), hora=VALUES(hora), status=VALUES(status)',
      [evento.id, evento.tipo, evento.plano, evento.data, evento.hora, 'em_fila']
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro ao inserir na fila:', err);
    res.status(500).json({ error: 'Erro ao inserir na fila' });
  }
});

// Endpoint para consultar a fila atual
app.get('/api/metrics/fila', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM fila WHERE status = ? ORDER BY created_at', ['em_fila']);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao consultar a fila' });
  }
});

// Estrutura para endpoints futuros
// app.get('/api/metrics/cluster/:id', ...);
// app.get('/api/metrics/plans', ...);
// app.get('/api/metrics/subscriptions', ...);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend rodando na porta ${PORT}`);
}); 