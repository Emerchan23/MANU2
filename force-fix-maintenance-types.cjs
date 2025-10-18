const mysql = require('mysql2/promise');
require('dotenv').config();

async function forceFix() {
    let connection;
    
    try {
        console.log('🔧 Forçando correção dos tipos de manutenção...');
        
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'hospital_maintenance'
        });

        // Limpar completamente a tabela
        console.log('🗑️ Limpando tabela tipos_manutencao...');
        await connection.execute('TRUNCATE TABLE tipos_manutencao');
        
        // Inserir dados corretos
        console.log('📝 Inserindo dados corretos...');
        await connection.execute(`
            INSERT INTO tipos_manutencao (nome, descricao, categoria) VALUES 
            ('Preventiva', 'Manutenção preventiva programada', 'preventiva'),
            ('Corretiva', 'Manutenção corretiva para reparo', 'corretiva'),
            ('Preditiva', 'Manutenção baseada em condição', 'preditiva'),
            ('Calibração', 'Calibração de equipamentos', 'calibracao'),
            ('Instalação', 'Instalação de novos equipamentos', 'instalacao'),
            ('Desinstalação', 'Remoção de equipamentos', 'desinstalacao'),
            ('Consultoria', 'Serviços de consultoria técnica', 'consultoria')
        `);
        
        console.log('✅ Dados corretos inseridos!');

        // Verificar dados inseridos
        const [data] = await connection.execute('SELECT * FROM tipos_manutencao WHERE ativo = 1 ORDER BY nome');
        
        console.log(`\n📊 Total de registros ativos: ${data.length}`);
        console.log('\n📋 Dados inseridos:');
        data.forEach(row => {
            console.log(`  - ID: ${row.id}, Nome: ${row.nome}, Categoria: ${row.categoria}, Descrição: ${row.descricao}`);
        });

    } catch (error) {
        console.error('❌ Erro ao corrigir tipos_manutencao:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

forceFix();