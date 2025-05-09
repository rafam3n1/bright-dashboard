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
  const [fila, setFila] = useState<Array<{id: number, tipo: string, plano: string, data: string, hora: string}>>([]);
  const [loading, setLoading] = useState(false);

  async function fetchMetrics() {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/metrics/overview');
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      // Em caso de erro, mantém os valores como '--'
    }
    setLoading(false);
  }

  async function fetchFila() {
    try {
      const res = await fetch('http://localhost:3001/api/metrics/fila');
      const data = await res.json();
      setFila(data);
      console.log('Fila atual:', data);
    } catch (err) {
      console.error('Erro ao buscar fila:', err);
    }
  }

  useEffect(() => {
    fetchMetrics();
    fetchFila();
    const interval = setInterval(() => {
      fetchMetrics();
      fetchFila();
    }, 300000); // 5 minutos
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
          <button className="refresh-btn" onClick={() => { fetchMetrics(); fetchFila(); }} disabled={loading}>
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
        <section className="fila-section">
          <h2>Fila de Espera</h2>
          {fila.length === 0 ? (
            <div className="alert-card">Nenhum cliente na fila.</div>
          ) : (
            <div className="fila-list">
              {fila.map((item) => (
                <div key={item.id} className="fila-item">
                  <strong>ID:</strong> {item.id} | <strong>Tipo:</strong> {item.tipo} | <strong>Plano:</strong> {item.plano} | <strong>Data:</strong> {item.data} | <strong>Hora:</strong> {item.hora}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      {/* Comentário: Futuramente, integrar banco de dados para histórico de métricas */}
    </div>
  )
}

export default App
