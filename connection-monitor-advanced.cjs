#!/usr/bin/env node

/**
 * Monitor Avançado de Conexões do Banco de Dados
 * Monitora o uso de conexões em tempo real para 30 usuários simultâneos
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hospital_maintenance',
  charset: 'utf8mb4',
  timezone: '+00:00',
  connectionLimit: 200,
  acquireTimeout: 30000,
  timeout: 60000,
  reconnect: true,
  waitForConnections: true,
  queueLimit: 100,
  multipleStatements: false,
  dateStrings: false,
  supportBigNumbers: true,
  bigNumberStrings: false,
  idleTimeout: 60000,
  maxIdle: 2,
  maxReconnects: 3,
  reconnectDelay: 2000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: false
};

let pool;
let monitoringActive = true;

function createPool() {
  if (!pool) {
    console.log('🔄 Criando pool de conexões para monitoramento...');
    pool = mysql.createPool(dbConfig);
    
    pool.on('connection', (connection) => {
      console.log(`✅ Nova conexão: ${connection.threadId}`);
    });
    
    pool.on('error', (err) => {
      console.error('❌ Erro no pool:', err.message);
    });
    
    console.log('✅ Pool criado com sucesso');
  }
  return pool;
}

async function getConnectionStats() {
  try {
    const connection = await pool.getConnection();
    
    // Estatísticas de conexões
    const [connections] = await connection.execute('SHOW STATUS LIKE "Threads_connected"');
    const [maxConnections] = await connection.execute('SHOW VARIABLES LIKE "max_connections"');
    const [maxUsedConnections] = await connection.execute('SHOW STATUS LIKE "Max_used_connections"');
    const [connectionErrors] = await connection.execute('SHOW STATUS LIKE "Connection_errors_max_connections"');
    
    // Estatísticas de performance
    const [queries] = await connection.execute('SHOW STATUS LIKE "Queries"');
    const [uptime] = await connection.execute('SHOW STATUS LIKE "Uptime"');
    
    connection.release();
    
    return {
      currentConnections: parseInt(connections[0].Value),
      maxConnections: parseInt(maxConnections[0].Value),
      maxUsedConnections: parseInt(maxUsedConnections[0].Value),
      connectionErrors: parseInt(connectionErrors[0].Value),
      totalQueries: parseInt(queries[0].Value),
      uptime: parseInt(uptime[0].Value)
    };
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error.message);
    return null;
  }
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function calculateQPS(totalQueries, uptime) {
  return (totalQueries / uptime).toFixed(2);
}

function getConnectionUsageLevel(current, max) {
  const percentage = (current / max) * 100;
  if (percentage < 50) return { level: 'BAIXO', color: '🟢' };
  if (percentage < 75) return { level: 'MÉDIO', color: '🟡' };
  if (percentage < 90) return { level: 'ALTO', color: '🟠' };
  return { level: 'CRÍTICO', color: '🔴' };
}

async function displayStats() {
  const stats = await getConnectionStats();
  if (!stats) return;
  
  const usage = getConnectionUsageLevel(stats.currentConnections, stats.maxConnections);
  const qps = calculateQPS(stats.totalQueries, stats.uptime);
  const connectionPercentage = ((stats.currentConnections / stats.maxConnections) * 100).toFixed(1);
  
  console.clear();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 MONITOR AVANÇADO DE CONEXÕES - SISTEMA DE MANUTENÇÃO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();
  
  console.log('📊 ESTATÍSTICAS DE CONEXÕES:');
  console.log(`   ${usage.color} Conexões Ativas: ${stats.currentConnections}/${stats.maxConnections} (${connectionPercentage}%)`);
  console.log(`   📈 Máximo Usado: ${stats.maxUsedConnections}`);
  console.log(`   ❌ Erros de Conexão: ${stats.connectionErrors}`);
  console.log(`   📊 Nível de Uso: ${usage.level}`);
  console.log();
  
  console.log('⚡ PERFORMANCE:');
  console.log(`   🔄 Queries por Segundo: ${qps} QPS`);
  console.log(`   ⏱️  Uptime: ${formatUptime(stats.uptime)}`);
  console.log(`   📝 Total de Queries: ${stats.totalQueries.toLocaleString()}`);
  console.log();
  
  console.log('🎯 CAPACIDADE PARA 30 USUÁRIOS:');
  const estimatedNeeded = 30 * 4; // 4 conexões por usuário (dashboards)
  const availableForUsers = stats.maxConnections - stats.currentConnections;
  const canSupport = Math.floor(availableForUsers / 4);
  
  console.log(`   📋 Conexões Estimadas Necessárias: ${estimatedNeeded}`);
  console.log(`   🆓 Conexões Disponíveis: ${availableForUsers}`);
  console.log(`   👥 Usuários Suportáveis Agora: ${canSupport}`);
  
  if (canSupport >= 30) {
    console.log('   ✅ Sistema PRONTO para 30 usuários simultâneos');
  } else if (canSupport >= 20) {
    console.log('   🟡 Sistema suporta parcialmente (20+ usuários)');
  } else {
    console.log('   🔴 Sistema LIMITADO - precisa otimização');
  }
  
  console.log();
  console.log('🔧 CONFIGURAÇÃO ATUAL DO POOL:');
  console.log(`   🔗 Connection Limit: ${dbConfig.connectionLimit}`);
  console.log(`   ⏰ Acquire Timeout: ${dbConfig.acquireTimeout}ms`);
  console.log(`   📋 Queue Limit: ${dbConfig.queueLimit}`);
  console.log();
  
  // Alertas
  if (stats.connectionErrors > 0) {
    console.log('🚨 ALERTA: Detectados erros de "Too many connections"!');
  }
  
  if (connectionPercentage > 85) {
    console.log('⚠️  ATENÇÃO: Uso de conexões acima de 85%');
  }
  
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`⏰ Última atualização: ${new Date().toLocaleString('pt-BR')}`);
  console.log('Pressione Ctrl+C para sair');
}

async function startMonitoring() {
  console.log('🚀 Iniciando monitor avançado de conexões...');
  
  try {
    createPool();
    
    // Teste inicial de conexão
    const testStats = await getConnectionStats();
    if (!testStats) {
      console.error('❌ Falha ao conectar com o banco de dados');
      process.exit(1);
    }
    
    console.log('✅ Conexão com banco estabelecida');
    console.log('📊 Iniciando monitoramento em tempo real...\n');
    
    // Atualizar a cada 3 segundos
    const interval = setInterval(async () => {
      if (monitoringActive) {
        await displayStats();
      }
    }, 3000);
    
    // Primeira exibição imediata
    await displayStats();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Parando monitor...');
      monitoringActive = false;
      clearInterval(interval);
      if (pool) {
        pool.end();
      }
      console.log('✅ Monitor finalizado');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Erro ao iniciar monitoramento:', error.message);
    process.exit(1);
  }
}

// Iniciar monitoramento
startMonitoring();