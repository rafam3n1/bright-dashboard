const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

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

// Endpoint para receber webhooks do n8n/app (ex: cliente entrou na fila)
app.post('/api/webhook/queue', (req, res) => {
  const evento = req.body;
  // TODO: Processar evento e atualizar métricas em memória ou banco
  console.log('Webhook recebido:', evento);
  // Exemplo: evento = { userId, action: 'entered_queue', timestamp }
  res.status(200).json({ ok: true });
});

// Estrutura para endpoints futuros
// app.get('/api/metrics/cluster/:id', ...);
// app.get('/api/metrics/plans', ...);
// app.get('/api/metrics/subscriptions', ...);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend rodando na porta ${PORT}`);
}); 