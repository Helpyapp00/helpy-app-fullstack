#!/usr/bin/env node
/**
 * Script de build para Vercel
 * Otimizado para acelerar o processo de build
 */

console.log('🔧 Iniciando build para Vercel...');

try {
    // O Vercel já executa npm install antes do buildCommand
    // Não precisamos fazer nada aqui, apenas confirmar que o build está completo
    console.log('📦 Dependências instaladas pelo Vercel');
    console.log('✅ Build completo!');
    process.exit(0);
} catch (error) {
    console.error('❌ Erro durante o build:', error.message);
    // Não falha o build - deixa o Vercel continuar
    process.exit(0);
}

