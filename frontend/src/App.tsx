import './App.css'
import logoBright from './assets/Logo-rebeca-brightbranca.png'
import { useEffect, useState } from 'react'

function App() {
  const [metrics, setMetrics] = useState({
    maquinasEmUso: '--',
    maquinasDisponiveis: '--',
    filaDeEspera: '--',
    tempoMedioSessao: '--',
    vmsExistentes: '--'
  });
  const [loading, setLoading] = useState(false);

  async function fetchMetrics() {
    setLoading(true);
    try {
      const res = await fetch('https://api-proxmox.brightcloudgames.com.br/api/metrics/overview');
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      // Em caso de erro, mantém os valores como '--'
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 300000); // Atualiza a cada 5 minutos
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-root">
      <header className="dashboard-header">
        <img src={logoBright} alt="Bright Cloud Logo" className="logo-bright" />
        <h1>Bright Cloud Dashboard</h1>
      </header>
      <main className="dashboard-main">
        <section className="metrics-section">
          <h2>Métricas em tempo real</h2>
          <button className="refresh-btn" onClick={fetchMetrics} disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar agora'}
          </button>
          <div className="metrics-cards">
            <div className="metric-card">Máquinas em uso: <span>{metrics.maquinasEmUso}</span></div>
            <div className="metric-card">Máquinas disponíveis: <span>{metrics.maquinasDisponiveis}</span></div>
            <div className="metric-card">Fila de espera: <span>{metrics.filaDeEspera}</span></div>
            <div className="metric-card">Tempo médio de sessão: <span>{metrics.tempoMedioSessao}</span></div>
            <div className="metric-card">VMs Existentes: <span>{metrics.vmsExistentes}</span></div>
          </div>
        </section>
        <section className="alerts-section">
          <h2>Alertas</h2>
          <div className="alert-card">Nenhum alerta no momento.</div>
        </section>
      </main>
      {/* Comentário: Futuramente, integrar banco de dados para histórico de métricas */}
    </div>
  )
}

export default App
